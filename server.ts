import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

// Models are tried in order; each has its own free-tier quota (Flash Lite: 500 requests/day).
const GEMINI_MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

// Quota shield: answers are shared by every visitor, and a model that hits a
// rate limit is paused instead of being retried immediately.
const answerCache = new Map<string, any>();
const ANSWER_CACHE_LIMIT = 200;
const QUOTA_PAUSE_MS = 60_000;
const BUSY_PAUSE_MS = 15_000;
const MISSING_MODEL_PAUSE_MS = 24 * 60 * 60_000;
const modelPausedUntil = new Map<string, number>();

function hashKey(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

// Firestore (through the Firebase Admin SDK) keeps the answer cache shared across Cloud Run
// instances and restarts, and stores each workspace's captured decisions and audits.
// On Cloud Run the SDK authenticates with the service's own identity; if Firestore is not
// reachable, everything keeps working from memory.
const FIRESTORE_OP_TIMEOUT_MS = 2500;
const FIRESTORE_RETRY_AFTER_MS = 5 * 60_000;
let db: Firestore | null = null;
let firestoreStatus = 'not configured';
let firestoreFailures = 0;
let firestoreDisabledUntil = 0;

try {
  // The Firestore database lives in the "mnemo-memory" Firebase project; Cloud Run's identity
  // has been granted access to it (Cloud Datastore User)
  const projectId = process.env.FIREBASE_PROJECT_ID || 'mnemo-memory';
  if (process.env.K_SERVICE || process.env.FIREBASE_PROJECT_ID) {
    const app = getApps()[0] || initializeApp({ projectId });
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    firestoreStatus = 'ready';
  }
} catch (err: any) {
  firestoreStatus = `unavailable: ${err?.message || err}`;
}

async function firestoreOp<T>(op: (store: Firestore) => Promise<T>): Promise<T | null> {
  if (!db || Date.now() < firestoreDisabledUntil) return null;
  try {
    const result = await Promise.race([
      op(db),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore timed out')), FIRESTORE_OP_TIMEOUT_MS))
    ]);
    firestoreFailures = 0;
    firestoreStatus = 'connected';
    return result;
  } catch (err: any) {
    firestoreFailures += 1;
    firestoreStatus = `error: ${String(err?.message || err).slice(0, 160)}`;
    console.warn('Firestore operation failed:', err?.message || err);
    // After repeated failures, stop waiting on Firestore for a while so requests stay fast
    if (firestoreFailures >= 3) {
      firestoreDisabledUntil = Date.now() + FIRESTORE_RETRY_AFTER_MS;
      firestoreFailures = 0;
    }
    return null;
  }
}

function rememberAnswer(key: string, value: any) {
  if (answerCache.size >= ANSWER_CACHE_LIMIT) {
    answerCache.delete(answerCache.keys().next().value as string);
  }
  answerCache.set(key, value);
  void firestoreOp((store) =>
    store.collection('answerCache').doc(key).set({ value: JSON.stringify(value), createdAt: FieldValue.serverTimestamp() })
  );
}

async function getCachedAnswer(key: string): Promise<any> {
  if (answerCache.has(key)) return answerCache.get(key);
  const snap = await firestoreOp((store) => store.collection('answerCache').doc(key).get());
  const raw = snap?.exists ? snap.get('value') : null;
  if (typeof raw !== 'string') return undefined;
  try {
    const value = JSON.parse(raw);
    answerCache.set(key, value);
    return value;
  } catch {
    return undefined;
  }
}

function isQuotaError(err: any): boolean {
  return (
    err?.status === 429 ||
    err?.message?.includes('429') ||
    err?.message?.includes('RESOURCE_EXHAUSTED') ||
    err?.message?.includes('quota')
  );
}

// How long to skip a model after this error, or 0 if another model would not help
function modelPauseFor(err: any): number {
  const message = String(err?.message || '');
  if (isQuotaError(err)) return QUOTA_PAUSE_MS;
  if (err?.status === 503 || message.includes('503') || message.includes('UNAVAILABLE')) return BUSY_PAUSE_MS;
  if (err?.status === 404 || message.includes('404') || message.includes('NOT_FOUND')) return MISSING_MODEL_PAUSE_MS;
  return 0;
}

function availableModels(): string[] {
  const now = Date.now();
  return GEMINI_MODELS.filter((m) => (modelPausedUntil.get(m) ?? 0) <= now);
}

function isGeminiPaused(): boolean {
  return availableModels().length === 0;
}

async function withModelFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
  let lastErr: any = new Error('Error 429: quota exceeded (all models paused)');
  for (const model of availableModels()) {
    try {
      return await run(model);
    } catch (err: any) {
      const pause = modelPauseFor(err);
      if (!pause) throw err;
      console.warn(`Gemini model ${model} unavailable, trying the next one:`, err?.message);
      modelPausedUntil.set(model, Date.now() + pause);
      lastErr = err;
    }
  }
  throw lastErr;
}

type GenerateParams = Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>;

// Same calls as ai.models, but each request falls back across GEMINI_MODELS
const gemini = {
  generateContent: (params: GenerateParams) =>
    withModelFallback((model) => ai.models.generateContent({ ...params, model })),
  generateContentStream: (params: GenerateParams) =>
    withModelFallback((model) => ai.models.generateContentStream({ ...params, model }))
};

function normalizeQuestion(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function docSignature(documents: any[]): string {
  return (documents || [])
    .map((d: any) => `${d.id}:${(d.content || '').length}`)
    .join(',');
}

function askCacheKey(query: string, documents: any[]): string {
  return hashKey('ask', normalizeQuestion(query), docSignature(documents));
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  // Verify Firestore with a real write the first time, so the status is never just assumed
  if (firestoreStatus === 'ready') {
    await firestoreOp((store) => store.collection('meta').doc('health').set({ checkedAt: FieldValue.serverTimestamp() }, { merge: true }));
  }
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    models: GEMINI_MODELS,
    available: availableModels(),
    geminiPaused: isGeminiPaused(),
    cachedAnswers: answerCache.size,
    firestore: firestoreStatus,
    timestamp: new Date().toISOString()
  });
});

// WORKSPACE MEMORY (FIRESTORE): each browser gets an anonymous workspace, so visitors never see each other's data
const WORKSPACE_ID = /^[a-zA-Z0-9-]{8,64}$/;
const WORKSPACE_EVENT_TYPES = new Set([
  'decision_captured',
  'document_audited',
  'conflicts_scanned',
  'conflict_sent',
  'review_requested',
  'demo_reset'
]);

app.post('/api/workspace/:id/events', async (req, res) => {
  const id = req.params.id;
  const { type, payload } = req.body || {};
  if (!WORKSPACE_ID.test(id)) return res.status(400).json({ error: 'Invalid workspace id.' });
  if (!WORKSPACE_EVENT_TYPES.has(type)) return res.status(400).json({ error: 'Unknown event type.' });
  const json = JSON.stringify(payload ?? {});
  if (json.length > 200_000) return res.status(413).json({ error: 'Event is too large.' });

  const saved = await firestoreOp(async (store) => {
    const workspace = store.collection('workspaces').doc(id);
    await workspace.set({ lastActiveAt: FieldValue.serverTimestamp(), eventCount: FieldValue.increment(1) }, { merge: true });
    await workspace.collection('events').add({ type, payload: json, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  return res.json({ saved: Boolean(saved), firestore: firestoreStatus });
});

app.get('/api/workspace/:id', async (req, res) => {
  const id = req.params.id;
  if (!WORKSPACE_ID.test(id)) return res.status(400).json({ error: 'Invalid workspace id.' });
  const snap = await firestoreOp((store) =>
    store.collection('workspaces').doc(id).collection('events').orderBy('createdAt', 'desc').limit(20).get()
  );
  if (!snap) return res.json({ available: false, firestore: firestoreStatus, events: [] });
  return res.json({
    available: true,
    firestore: firestoreStatus,
    events: snap.docs.map((d) => ({ type: d.get('type'), createdAt: d.get('createdAt')?.toDate?.()?.toISOString?.() || null }))
  });
});

// Deterministic grounding fallback helper
function getFallbackAskLore(query: string) {
  const q = query.toLowerCase();

  // "Tried before" check for Vendor C
  if (q.includes('vendor c') && (q.includes('switch') || q.includes('use') || q.includes('should') || q.includes('try') || q.includes('hire'))) {
    return {
      found: true,
      decisionTitle: 'Prior Evaluation of Vendor C',
      summary: 'Trial of Vendor C ended on 2023-08-14. 7% of shipments had damaged goods; procurement dropped Vendor C.',
      triedBefore: {
        detected: true,
        idea: 'Switching to Vendor C',
        reason: 'Trial of Vendor C ended on 2023-08-14 because 7% of shipments had damaged goods; procurement dropped Vendor C.',
        sourceDocId: 'D1',
        sourceTitle: 'Vendor C Trial Review & Post-Mortem',
        sourceDate: '2023-08-14',
        snippet: 'Trial of Vendor C ended. 7% of shipments had damaged goods; procurement dropped Vendor C.'
      },
      timeline: [
        {
          id: 'step-1',
          date: '2023-08-14',
          author: 'Maria Tan, Procurement Lead',
          action: 'Trial of Vendor C ended. 7% of shipments had damaged goods; procurement dropped Vendor C.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D1',
              docTitle: 'Vendor C Trial Review & Post-Mortem',
              date: '2023-08-14',
              snippet: 'Trial of Vendor C ended. 7% of shipments had damaged goods; procurement dropped Vendor C.'
            }
          ]
        },
        {
          id: 'step-2',
          date: '2024-03-12',
          author: 'Maria Tan, Daniel Cruz, Priya Nair',
          action: 'Vendor selection: choose Vendor B. Vendor C rejected, see D1.',
          optionsConsidered: ['Vendor A ($12.50/unit, 4-day delivery)', 'Vendor B ($10.00/unit, 2-day delivery)', 'Vendor C (rejected, see D1)'],
          optionsRejected: [
            {
              option: 'Vendor C',
              reason: 'Rejected, see D1 (7% of shipments had damaged goods)'
            }
          ],
          citations: [
            {
              docId: 'D2',
              docTitle: 'Supplier Selection & RFP Final Review',
              date: '2024-03-12',
              snippet: 'Options: Vendor A ($12.50/unit, 4-day delivery), Vendor B ($10.00/unit, 2-day delivery), Vendor C (rejected, see D1). Decision: choose Vendor B. Reasons: 20% cheaper, 2-day delivery.'
            }
          ]
        }
      ]
    };
  }

  // Why do we use Vendor B?
  if (q.includes('vendor b') || q.includes('supplier') || q.includes('vendor') || q.includes('carrier') || q.includes('freight')) {
    return {
      found: true,
      decisionTitle: 'Use Vendor B as primary supplier',
      summary: 'Vendor selection on 2024-03-12 chose Vendor B because it was 20% cheaper ($10.00 vs $12.50/unit) with 2-day delivery.',
      triedBefore: null,
      timeline: [
        {
          id: 'step-1',
          date: '2023-08-14',
          author: 'Maria Tan, Procurement Lead',
          action: 'Trial of Vendor C ended. 7% of shipments had damaged goods; procurement dropped Vendor C.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D1',
              docTitle: 'Vendor C Trial Review & Post-Mortem',
              date: '2023-08-14',
              snippet: 'Trial of Vendor C ended. 7% of shipments had damaged goods; procurement dropped Vendor C.'
            }
          ]
        },
        {
          id: 'step-2',
          date: '2024-03-12',
          author: 'Maria Tan, Daniel Cruz, Priya Nair',
          action: 'Choose Vendor B. Reasons: 20% cheaper, 2-day delivery.',
          optionsConsidered: ['Vendor A ($12.50/unit, 4-day delivery)', 'Vendor B ($10.00/unit, 2-day delivery)', 'Vendor C (rejected, see D1)'],
          optionsRejected: [
            {
              option: 'Vendor A',
              reason: '$12.50/unit, 4-day delivery (20% more expensive than Vendor B)'
            },
            {
              option: 'Vendor C',
              reason: 'Rejected, see D1 (7% of shipments had damaged goods)'
            }
          ],
          citations: [
            {
              docId: 'D2',
              docTitle: 'Supplier Selection & RFP Final Review',
              date: '2024-03-12',
              snippet: 'Options: Vendor A ($12.50/unit, 4-day delivery), Vendor B ($10.00/unit, 2-day delivery), Vendor C (rejected, see D1). Decision: choose Vendor B. Reasons: 20% cheaper, 2-day delivery.'
            }
          ]
        },
        {
          id: 'step-3',
          date: '2024-03-15',
          author: 'Daniel Cruz, Ops Director',
          action: 'Approved. Vendor B contract signed, 8,000 units/month.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D3',
              docTitle: 'Vendor B Contract Execution Notice',
              date: '2024-03-15',
              snippet: 'Approved. Vendor B contract signed, 8,000 units/month.'
            }
          ]
        },
        {
          id: 'step-4',
          date: '2026-07-30',
          author: 'Operations Quality & Telematics Team',
          action: 'Vendor B average delivery time is now 5 days.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D4',
              docTitle: 'Operations Carrier SLA & Delivery Audit Report',
              date: '2026-07-30',
              snippet: 'Vendor B average delivery time is now 5 days.'
            }
          ]
        }
      ]
    };
  }

  // Why Monday syncs?
  if (q.includes('sync') || q.includes('monday') || q.includes('cadence') || q.includes('meeting')) {
    return {
      found: true,
      decisionTitle: 'Weekly ops sync on Mondays',
      summary: 'Cross-functional ops syncs run every Monday at 09:30 AM to eliminate weekend fulfillment lag and align warehouse handoffs.',
      triedBefore: null,
      timeline: [
        {
          id: 'step-sync-1',
          date: '2025-01-10',
          author: 'Daniel Cruz, Ops Director',
          action: 'All cross-functional ops syncs scheduled every Monday at 09:30 AM. The sync sets dispatch quotas, reviews maintenance windows and validates carrier availability before shift handovers.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D6',
              docTitle: 'Operations Cadence & Synchronization Guideline',
              date: '2025-01-10',
              snippet: 'Weekly ops sync scheduled Mondays at 09:30 AM to coordinate fleet dispatch before shift rotations.'
            }
          ]
        }
      ]
    };
  }

  // Why shared drive?
  if (q.includes('drive') || q.includes('contract') || q.includes('soc2') || q.includes('storage') || q.includes('legal')) {
    return {
      found: true,
      decisionTitle: 'Use shared drive for contracts',
      summary: 'All executed vendor agreements must be archived in the encrypted Corporate Shared Drive for SOC2 compliance.',
      triedBefore: null,
      timeline: [
        {
          id: 'step-drive-1',
          date: '2024-11-05',
          author: 'Priya Nair, Finance & Legal Lead',
          action: 'All executed vendor agreements and addenda must be archived in the encrypted Corporate Shared Drive (/Legal/Executed_Agreements) to satisfy SOC2 audit requirements.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D7',
              docTitle: 'Information Governance & SOC2 Contract Storage Policy',
              date: '2024-11-05',
              snippet: 'All executed vendor agreements must be archived in the encrypted Corporate Shared Drive for SOC2 compliance.'
            }
          ]
        }
      ]
    };
  }

  // Not found in records
  return {
    found: false,
    message: "I couldn't find this in your company's records."
  };
}

// Common schema for Ask Mnemo
const ASK_MNEMO_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    found: { type: Type.BOOLEAN },
    message: { type: Type.STRING },
    decisionTitle: { type: Type.STRING },
    summary: { type: Type.STRING },
    triedBefore: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN },
        idea: { type: Type.STRING },
        reason: { type: Type.STRING },
        sourceDocId: { type: Type.STRING },
        sourceTitle: { type: Type.STRING },
        sourceDate: { type: Type.STRING },
        snippet: { type: Type.STRING }
      }
    },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          date: { type: Type.STRING },
          author: { type: Type.STRING },
          action: { type: Type.STRING },
          optionsConsidered: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          optionsRejected: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                option: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ['option', 'reason']
            }
          },
          citations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                docId: { type: Type.STRING },
                docTitle: { type: Type.STRING },
                date: { type: Type.STRING },
                snippet: { type: Type.STRING }
              },
              required: ['docId', 'docTitle', 'date', 'snippet']
            }
          }
        },
        required: ['id', 'date', 'author', 'action', 'optionsConsidered', 'citations']
      }
    }
  },
  required: ['found']
};

function buildAskMnemoPrompt(query: string, documents: any[], decisionTitles: string[] = []): string {
  const docContext = (documents || [])
    .map((d: any) => `[Doc ${d.id}] "${d.title}" (${d.date}, Author: ${d.author})\nType: ${d.type}\nContent:\n${d.content}\n---`)
    .join('\n\n');

  return `You are "Mnemo", the decision memory engine for Brightwell Logistics.
You answer questions like "Why do we do X?" or "Should we switch to Y?" using ONLY the company documents provided below.

COMPANY DOCUMENTS:
${docContext}

KNOWN DECISIONS (when the answer is about one of these, use its exact title as decisionTitle):
${(decisionTitles || []).map((t) => `- ${t}`).join('\n') || '(none)'}

USER QUESTION:
"${query}"

CRITICAL RULES:
1. Answer ONLY from the provided Brightwell Logistics documents above. NEVER invent, hallucinate, or extrapolate reasons.
2. Use only facts stated in the provided documents. If a field is not stated, leave it empty (empty array []).
3. Do NOT add places, terms, options, numbers or people that are not written in the documents.
4. Only populate optionsConsidered or optionsRejected when the document explicitly lists multiple options. Otherwise leave optionsConsidered and optionsRejected as empty arrays [].
5. Keep output small and fast: max 6 timeline steps, short sentences.
6. If the user's question or topic is NOT covered in the documents, return:
   found: false
   message: "I couldn't find this in your company's records."
7. "TRIED BEFORE" CHECK: If the user proposes an idea (e.g., "Should we switch to Vendor C?", "Can we use Vendor C?"), check if that vendor or strategy was trialed and failed in the documents (e.g. Doc D1 where Vendor C had 7% damaged goods and was dropped). If so, populate "triedBefore" with detected: true, the idea, why it failed, sourceDocId: "D1", sourceTitle: "Vendor C Trial Review", sourceDate: "2023-08-14", and the exact quote snippet.
8. If found, format the explanation as a clear chronological decision timeline:
   - decisionTitle: Short, crisp title of the decision
   - summary: 1-2 sentence executive summary
   - timeline: array of steps (chronological order, max 6 steps)
     Each step must contain: id, date, author, action, optionsConsidered, optionsRejected, citations (exact quote snippets).
`;
}

// 1. ASK MNEMO ENDPOINT (FAST FLASH CALL)
app.post('/api/ask-lore', async (req, res) => {
  const { query, documents } = req.body;
  const decisionTitles: string[] = Array.isArray(req.body?.decisionTitles) ? req.body.decisionTitles.map(String).slice(0, 50) : [];

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required.' });
  }

  // If no Gemini key, return deterministic grounded answer
  if (!apiKey) {
    const fallback = getFallbackAskLore(query);
    return res.json(fallback);
  }

  const key = askCacheKey(query, documents);
  const cached = await getCachedAnswer(key);
  if (cached) {
    return res.json(cached);
  }

  if (isGeminiPaused()) {
    const fallback = getFallbackAskLore(query);
    if (fallback.found) {
      return res.json({ ...fallback, servedFrom: 'memory' });
    }
    return res.status(429).json({
      error: 'Error 429: quota exceeded',
      status: 429,
      isQuotaExceeded: true
    });
  }

  try {
    const prompt = buildAskMnemoPrompt(query, documents, decisionTitles);

    const response = await gemini.generateContent({
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
        responseSchema: ASK_MNEMO_SCHEMA
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    rememberAnswer(key, parsed);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Gemini Ask Mnemo Error:', err);
    const fallback = getFallbackAskLore(query);
    if (fallback.found) {
      return res.json({ ...fallback, servedFrom: 'memory' });
    }
    const is429 = isQuotaError(err);
    const status = is429 ? 429 : (err?.status || 500);
    return res.status(status).json({ 
      error: is429 ? 'Error 429: quota exceeded' : (err?.message || 'Error executing query'),
      status,
      isQuotaExceeded: is429
    });
  }
});

function openEventStream(res: express.Response) {
  if (res.headersSent) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
}

// Streams a complete answer (cached or grounded fallback) in the same event format as Gemini
async function streamAnswer(res: express.Response, answer: any) {
  openEventStream(res);
  res.write(`event: summary\ndata: ${JSON.stringify({
    found: answer.found,
    decisionTitle: answer.decisionTitle || '',
    summary: answer.summary || '',
    triedBefore: answer.triedBefore || null,
    message: answer.message || ''
  })}\n\n`);

  if (answer.timeline && answer.timeline.length > 0) {
    for (let i = 0; i < answer.timeline.length; i++) {
      await new Promise((r) => setTimeout(r, 60));
      res.write(`event: step\ndata: ${JSON.stringify({ step: answer.timeline[i], index: i })}\n\n`);
    }
  }

  res.write(`event: done\ndata: ${JSON.stringify(answer)}\n\n`);
  res.end();
}

// 2. ASK MNEMO STREAMING ENDPOINT (FAST SSE PROGRESSIVE STREAMING)
app.post('/api/ask-lore-stream', async (req, res) => {
  const { query, documents } = req.body;
  const decisionTitles: string[] = Array.isArray(req.body?.decisionTitles) ? req.body.decisionTitles.map(String).slice(0, 50) : [];

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required.' });
  }

  // If no Gemini key, stream deterministic fallback
  if (!apiKey) {
    return streamAnswer(res, getFallbackAskLore(query));
  }

  const key = askCacheKey(query, documents);
  const cached = await getCachedAnswer(key);
  if (cached) {
    return streamAnswer(res, cached);
  }

  if (isGeminiPaused()) {
    const fallback = getFallbackAskLore(query);
    if (fallback.found) {
      return streamAnswer(res, { ...fallback, servedFrom: 'memory' });
    }
    return res.status(429).json({
      error: 'Error 429: quota exceeded',
      status: 429,
      isQuotaExceeded: true
    });
  }

  try {
    const prompt = buildAskMnemoPrompt(query, documents, decisionTitles);

    const streamResult = await gemini.generateContentStream({
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
        responseSchema: ASK_MNEMO_SCHEMA
      }
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let fullText = '';
    let summarySent = false;

    for await (const chunk of streamResult) {
      const chunkText = chunk.text || '';
      fullText += chunkText;

      // Extract summary early if not sent yet
      if (!summarySent) {
        const summaryMatch = fullText.match(/"summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        const titleMatch = fullText.match(/"decisionTitle"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (summaryMatch && summaryMatch[1]) {
          summarySent = true;
          const summary = summaryMatch[1].replace(/\\"/g, '"');
          const decisionTitle = titleMatch ? titleMatch[1].replace(/\\"/g, '"') : 'Decision Timeline';
          res.write(`event: summary\ndata: ${JSON.stringify({
            found: true,
            decisionTitle,
            summary
          })}\n\n`);
        }
      }
    }

    // Parse complete object
    const parsed = JSON.parse(fullText.trim() || '{}');
    rememberAnswer(key, parsed);

    // Send summary if not already sent
    if (!summarySent) {
      res.write(`event: summary\ndata: ${JSON.stringify({
        found: parsed.found,
        decisionTitle: parsed.decisionTitle || '',
        summary: parsed.summary || '',
        triedBefore: parsed.triedBefore || null,
        message: parsed.message || ''
      })}\n\n`);
    }

    // Stream timeline steps
    if (parsed.timeline && Array.isArray(parsed.timeline)) {
      for (let i = 0; i < parsed.timeline.length; i++) {
        res.write(`event: step\ndata: ${JSON.stringify({ step: parsed.timeline[i], index: i })}\n\n`);
      }
    }

    res.write(`event: done\ndata: ${JSON.stringify(parsed)}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('Gemini Ask Mnemo Stream Error:', err);
    const fallback = getFallbackAskLore(query);
    if (fallback.found) {
      return streamAnswer(res, { ...fallback, servedFrom: 'memory' });
    }
    const is429 = isQuotaError(err);
    const status = is429 ? 429 : (err?.status || 500);

    if (!res.headersSent) {
      return res.status(status).json({
        error: is429 ? 'Error 429: quota exceeded' : (err?.message || 'Error executing stream'),
        status,
        isQuotaExceeded: is429
      });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: is429 ? 'Error 429: quota exceeded' : (err?.message || 'Error executing stream'),
        status,
        isQuotaExceeded: is429
      })}\n\n`);
      res.end();
    }
  }
});

// Verified results for the two demo documents, used when Gemini is unavailable
const LEASE_NOTICE_MARKER = 'Hub North Lease Renewal Notice';

function sampleInvoiceResult(fileName?: string) {
  return {
    status: 'success',
    message: '1 decision assumption went stale.',
    fileName: fileName || 'Vendor_B_Invoice_INV-2026-0912.pdf',
    fileHash: 'inv-2026-0912',
    documentSummary: 'Vendor B invoice INV-2026-0912 dated 2026-09-28: 8,000 units at $13.40/unit, total $107,200.00.',
    documentText: 'INVOICE: INV-2026-0912 | VENDOR: Vendor B Logistics Ltd. | DATE: September 28, 2026 | Quantity: 8,000 units | Rate: $13.40 / unit | TOTAL AMOUNT DUE: $107,200.00',
    findings: [
      {
        assumptionId: 'a1',
        verdict: 'contradicted',
        evidenceQuote: 'Rate: $13.40 / unit',
        confidence: 'High',
        explanation: "Vendor B now charges $13.40/unit, more than Vendor A's current quote of $12.80/unit (D5)."
      }
    ],
    staleCount: 1,
    monthlyImpact: 4800,
    costFormula: '($13.40 − $12.80) × 8,000 units/month'
  };
}

function sampleLeaseResult(fileName: string | undefined, activeAssumptions: any[]) {
  const findings = (activeAssumptions || []).map((a: any) => {
    const text = String(a.text || '').toLowerCase();
    if (/cheaper|rent|lease|cost/.test(text) && /hub/.test(text)) {
      return {
        assumptionId: a.id,
        verdict: 'contradicted',
        evidenceQuote: 'From 1 November 2026, Hub North rent is $13,500 per month.',
        confidence: 'High',
        explanation: 'Hub North will cost $13,500/month plus $1,800/month for security, more than Hub South at $12,200/month with security included.'
      };
    }
    if (/security|24\/7|guard|staff/.test(text)) {
      return {
        assumptionId: a.id,
        verdict: 'contradicted',
        evidenceQuote: 'The on-site 24/7 security contract ends on 31 October 2026. Weekend security will then be billed separately at $1,800 per month.',
        confidence: 'High',
        explanation: 'Hub North will no longer include 24/7 security staff from November 2026.'
      };
    }
    return { assumptionId: a.id, verdict: 'unrelated', evidenceQuote: '', confidence: 'High', explanation: 'The lease notice does not mention this.' };
  });
  const contradicted = findings.filter((f: any) => f.verdict === 'contradicted').length;
  return {
    status: contradicted > 0 ? 'success' : 'no_effect',
    message: contradicted > 0 ? `${contradicted} decision assumption went stale.` : 'No decisions affected. All assumptions still hold.',
    fileName: fileName || 'Hub_North_Lease_Renewal_Notice.txt',
    fileHash: 'hub-north-lease-2026',
    documentSummary: 'Hub North lease renewal notice dated 2026-10-01: rent rises to $13,500/month and 24/7 security ends on 31 October 2026.',
    documentText: 'Hub North rent from 1 Nov 2026: $13,500/month. Hub South quote: $12,200/month including weekend security. Hub North 24/7 security contract ends 31 Oct 2026; weekend security then $1,800/month.',
    findings,
    staleCount: contradicted,
    monthlyImpact: contradicted > 0 ? 3100 : 0,
    costFormula: contradicted > 0 ? '($13,500 + $1,800) − $12,200 per month' : ''
  };
}

const CHECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    documentSummary: { type: Type.STRING, description: 'One sentence: what the document is, who sent it, its date and key figures.' },
    documentText: { type: Type.STRING, description: 'Transcription of the key lines and figures of the document, max 800 characters.' },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          assumptionId: { type: Type.STRING },
          verdict: { type: Type.STRING, description: 'Must be "contradicted", "supported", or "unrelated"' },
          evidenceQuote: { type: Type.STRING, description: 'Exact text from the NEW document; empty when unrelated' },
          confidence: { type: Type.STRING, description: 'Must be "High", "Medium", or "Low"' },
          explanation: { type: Type.STRING, description: 'One plain sentence; name any company record used, e.g. D5' }
        },
        required: ['assumptionId', 'verdict', 'evidenceQuote', 'confidence', 'explanation']
      }
    },
    monthlyImpact: { type: Type.NUMBER, description: 'Monthly cost of keeping the contradicted decision, only when the documents give the prices and volumes to compute it; otherwise 0' },
    costFormula: { type: Type.STRING, description: 'The calculation behind monthlyImpact, e.g. "($13.40 − $12.80) × 8,000 units/month"; empty when monthlyImpact is 0' }
  },
  required: ['documentSummary', 'findings', 'monthlyImpact']
};

const MAX_FILE_BASE64 = 9_000_000;
const VERDICTS = new Set(['contradicted', 'supported', 'unrelated']);
const CONFIDENCES = new Set(['High', 'Medium', 'Low']);

// 2. CHECK ASSUMPTIONS ENDPOINT (HERO FEATURE)
app.post('/api/check-assumptions', async (req, res) => {
  const { fileName, activeAssumptions, documents, fileData } = req.body || {};
  const content: string = typeof req.body?.content === 'string' ? req.body.content : '';
  const hasFile = Boolean(fileData?.data && fileData?.mimeType);

  if (!hasFile && !content.trim()) {
    return res.status(400).json({ status: 'error', message: 'Document is empty or unreadable.' });
  }
  if (hasFile && String(fileData.data).length > MAX_FILE_BASE64) {
    return res.status(413).json({ status: 'error', message: 'File is too large. Please upload a file under 6 MB.' });
  }

  const assumptions: any[] = Array.isArray(activeAssumptions) ? activeAssumptions : [];
  const isVendorBInvoice = content.includes('INV-2026-0912');
  const isLeaseNotice = content.includes(LEASE_NOTICE_MARKER);
  const verifiedFallback = () =>
    isVendorBInvoice ? sampleInvoiceResult(fileName) : isLeaseNotice ? sampleLeaseResult(fileName, assumptions) : null;

  if (!apiKey) {
    const fallback = verifiedFallback();
    if (fallback) return res.json(fallback);
    return res.status(503).json({ status: 'error', message: 'Gemini is not configured on this server.' });
  }

  const source = hasFile ? String(fileData.data) : content;
  const fileHash = hashKey('file', source).slice(0, 24);
  const checkKey = hashKey(
    'check',
    source,
    assumptions.map((a: any) => `${a.id}:${a.text}`).join(','),
    docSignature(documents || [])
  );
  const cachedCheck = await getCachedAnswer(checkKey);
  if (cachedCheck) {
    return res.json({ ...cachedCheck, fileName: fileName || cachedCheck.fileName });
  }

  if (isGeminiPaused()) {
    const fallback = verifiedFallback();
    if (fallback) return res.json({ ...fallback, servedFrom: 'memory' });
    return res.status(429).json({ status: 'error', message: 'Mnemo is busy right now. Please retry in a minute.' });
  }

  try {
    const records = (Array.isArray(documents) ? documents : [])
      .map((d: any) => `[${d.id}] "${d.title}" (${d.date})\n${String(d.content || '').slice(0, 1500)}`)
      .join('\n---\n');

    const prompt = `You are Mnemo's assumption watcher. Each active assumption below is a condition that a past company decision depended on.

ACTIVE ASSUMPTIONS:
${assumptions.map((a: any) => `- ID: ${a.id} | Decision: "${a.decisionTitle || 'Decision'}" | Assumption: "${a.text}"`).join('\n')}

COMPANY RECORDS (latest known facts, use them for comparisons such as competitor quotes):
${records || '(none)'}

NEW DOCUMENT: ${fileName || 'document'}
${hasFile ? '(attached as a file)' : `"""\n${content.slice(0, 30000)}\n"""`}

TASK:
1. documentSummary: one sentence on what the new document is (type, sender, date, key figures). documentText: transcribe its key lines and figures.
2. For EVERY assumption ID give a verdict:
   - "contradicted": the new document, alone or combined with the company records, shows the assumption is no longer true.
   - "supported": the new document confirms the assumption still holds.
   - "unrelated": the new document says nothing about it.
   evidenceQuote: exact text copied from the NEW document (empty when unrelated). explanation: one plain sentence, naming any company record you used.
3. monthlyImpact: the extra monthly cost of keeping a contradicted decision instead of the best alternative named in the documents, only when the documents give the figures to compute it, otherwise 0. Use per-unit price × monthly volume, or compare monthly prices directly (add any new monthly charges the document introduces). costFormula: the calculation.
Never invent numbers, names or dates.`;

    const response = await gemini.generateContent({
      contents: hasFile
        ? [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: String(fileData.mimeType), data: String(fileData.data) } }] }]
        : prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: CHECK_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const knownIds = new Set(assumptions.map((a: any) => a.id));
    const findings = (parsed.findings || [])
      .filter((f: any) => knownIds.has(f.assumptionId))
      .map((f: any) => ({
        assumptionId: f.assumptionId,
        verdict: VERDICTS.has(f.verdict) ? f.verdict : 'unrelated',
        evidenceQuote: String(f.evidenceQuote || ''),
        confidence: CONFIDENCES.has(f.confidence) ? f.confidence : 'Medium',
        explanation: String(f.explanation || '')
      }));
    const contradicted = findings.filter((f: any) => f.verdict === 'contradicted');
    const monthlyImpact = contradicted.length > 0 ? Math.max(0, Math.round(Number(parsed.monthlyImpact) || 0)) : 0;

    const result = {
      status: contradicted.length > 0 ? 'success' : 'no_effect',
      message: contradicted.length > 0
        ? `${contradicted.length} decision assumption went stale.`
        : 'No decisions affected. All assumptions still hold.',
      fileName: fileName || 'Uploaded document',
      fileHash,
      documentSummary: String(parsed.documentSummary || ''),
      documentText: String(parsed.documentText || '').slice(0, 1200),
      findings,
      staleCount: contradicted.length,
      monthlyImpact,
      costFormula: monthlyImpact > 0 ? String(parsed.costFormula || '') : ''
    };
    rememberAnswer(checkKey, result);
    return res.json(result);
  } catch (err: any) {
    console.error('Check assumptions error:', err);
    const fallback = verifiedFallback();
    if (fallback) return res.json({ ...fallback, servedFrom: 'memory' });
    return res.status(isQuotaError(err) ? 429 : 500).json({
      status: 'error',
      message: isQuotaError(err)
        ? 'Mnemo is busy right now. Please retry in a minute.'
        : 'Something went wrong analyzing the document. Please retry.'
    });
  }
});

// 2b. CAPTURE A DECISION ENDPOINT (EXTRACTION)
const EXTRACT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    found: { type: Type.BOOLEAN },
    message: { type: Type.STRING },
    title: { type: Type.STRING, description: 'Short imperative title, e.g. "Use Vendor B as primary supplier"' },
    date: { type: Type.STRING, description: 'Decision date as YYYY-MM-DD if stated, else empty' },
    lead: { type: Type.STRING, description: 'Who made or announced the decision, with role if stated' },
    summary: { type: Type.STRING },
    reasons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { text: { type: Type.STRING }, quote: { type: Type.STRING } },
        required: ['text', 'quote']
      }
    },
    assumptions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: 'A checkable condition the decision depends on, phrased as a statement that is true today' },
          quote: { type: Type.STRING }
        },
        required: ['text', 'quote']
      }
    },
    options: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          accepted: { type: Type.BOOLEAN },
          reason: { type: Type.STRING }
        },
        required: ['name', 'accepted', 'reason']
      }
    }
  },
  required: ['found', 'title', 'summary', 'reasons', 'assumptions', 'options']
};

const CAPTURE_EXAMPLE_MARKER = 'Decision: weekend dispatch moves to Hub North';

function fallbackExtraction() {
  return {
    found: true,
    title: 'Move weekend dispatch to Hub North',
    date: '2025-05-06',
    lead: 'Daniel Cruz, Ops Director',
    summary: 'All weekend dispatch moves to Hub North from 1 June 2025, because it has 24/7 security staff and lower rent than Hub South.',
    reasons: [
      { text: 'Hub North has 24/7 security staff, so weekend guards at Hub South are no longer needed', quote: 'Hub North has 24/7 security staff on site, so we no longer need to pay weekend guards at Hub South.' },
      { text: 'Hub North rent is $3,000 per month cheaper than Hub South', quote: 'Its lease is $3,000 per month cheaper than Hub South ($9,000 vs $12,000).' }
    ],
    assumptions: [
      { text: 'Hub North is cheaper to run than Hub South', quote: 'Its lease is $3,000 per month cheaper than Hub South ($9,000 vs $12,000).' },
      { text: 'Hub North has 24/7 security staff on site', quote: 'Hub North has 24/7 security staff on site' }
    ],
    options: [
      { name: 'Hub North', accepted: true, reason: 'Cheaper lease and 24/7 security on site' },
      { name: 'Keep weekends at Hub South', accepted: false, reason: 'The overtime security cost made it the more expensive option.' }
    ]
  };
}

const normalizeText = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

app.post('/api/extract-decision', async (req, res) => {
  const text: string = typeof req.body?.text === 'string' ? req.body.text : '';
  if (text.trim().length < 40) {
    return res.status(400).json({ error: 'Paste at least a few sentences that describe a decision.' });
  }
  if (text.length > 20000) {
    return res.status(413).json({ error: 'That text is too long. Paste up to 20,000 characters.' });
  }

  const isExample = text.includes(CAPTURE_EXAMPLE_MARKER);
  if (!apiKey) {
    if (isExample) return res.json(fallbackExtraction());
    return res.status(503).json({ error: 'Gemini is not configured on this server.' });
  }

  const key = hashKey('extract', text);
  const cached = await getCachedAnswer(key);
  if (cached) return res.json(cached);

  if (isGeminiPaused()) {
    if (isExample) return res.json({ ...fallbackExtraction(), servedFrom: 'memory' });
    return res.status(429).json({ error: 'Mnemo is busy right now. Please retry in a minute.' });
  }

  try {
    const prompt = `You are Mnemo's decision extractor. Read the text below (an email, memo, meeting note or chat) and capture the ONE main decision it records.

TEXT:
"""
${text}
"""

RULES:
1. Use ONLY the text. Never invent names, dates, numbers, options or reasons.
2. reasons: why the decision was made. assumptions: the checkable conditions the decision depends on, each phrased as a statement that is true today (e.g. "Vendor B is cheaper than Vendor A"), so a later document can prove it false.
3. Every reason and assumption needs a quote copied EXACTLY from the text.
4. options: the alternatives mentioned, with accepted true for the chosen one and the stated reason for each.
5. If the text records no decision, set found false and explain briefly in message.`;

    const response = await gemini.generateContent({
      contents: prompt,
      config: { temperature: 0, responseMimeType: 'application/json', responseSchema: EXTRACT_SCHEMA }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const haystack = normalizeText(text);
    const grounded = (items: any[]) =>
      (items || []).filter((it: any) => it?.text && it?.quote && haystack.includes(normalizeText(String(it.quote))));
    const reasons = grounded(parsed.reasons);
    const assumptions = grounded(parsed.assumptions);

    if (!parsed.found || assumptions.length === 0) {
      const result = {
        found: false,
        message: parsed.message || 'No decision with checkable reasons was found in this text.'
      };
      rememberAnswer(key, result);
      return res.json(result);
    }

    const result = {
      found: true,
      title: String(parsed.title || 'Captured decision'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || '') ? parsed.date : '',
      lead: String(parsed.lead || ''),
      summary: String(parsed.summary || ''),
      reasons,
      assumptions,
      options: (parsed.options || []).filter((o: any) => o?.name)
    };
    rememberAnswer(key, result);
    return res.json(result);
  } catch (err: any) {
    console.error('Extract decision error:', err);
    if (isExample) return res.json({ ...fallbackExtraction(), servedFrom: 'memory' });
    return res.status(isQuotaError(err) ? 429 : 500).json({
      error: isQuotaError(err) ? 'Mnemo is busy right now. Please retry in a minute.' : 'Gemini could not read this text. Please retry.'
    });
  }
});

// 3. POLICY CONFLICTS ENDPOINT (CONTRADICTION RADAR)
const POLICY_SIDE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    docId: { type: Type.STRING },
    docTitle: { type: Type.STRING },
    owner: { type: Type.STRING },
    quote: { type: Type.STRING }
  },
  required: ['docId', 'docTitle', 'owner', 'quote']
};

const CONFLICTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    conflicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          topic: { type: Type.STRING },
          risk: { type: Type.STRING, description: 'Must be "High", "Medium", or "Low"' },
          confidence: { type: Type.STRING, description: 'Must be "High", "Medium", or "Low"' },
          sideA: POLICY_SIDE_SCHEMA,
          sideB: POLICY_SIDE_SCHEMA,
          impact: { type: Type.STRING },
          impactDocId: { type: Type.STRING },
          suggestedFix: { type: Type.STRING }
        },
        required: ['id', 'topic', 'risk', 'confidence', 'sideA', 'sideB', 'impact', 'suggestedFix']
      }
    }
  },
  required: ['conflicts']
};

// Verified result for the demo policies, used when Gemini is unavailable
function fallbackConflicts() {
  return {
    conflicts: [
      {
        id: 'conflict-approval-window',
        topic: 'Purchase approval window',
        risk: 'High',
        confidence: 'High',
        sideA: {
          docId: 'D8',
          docTitle: 'Employee Handbook §4.2: Purchase Approvals',
          owner: 'Lena Ortiz, HR Director',
          quote: 'Purchase requests up to $50,000 are approved within 3 business days of submission.'
        },
        sideB: {
          docId: 'D9',
          docTitle: 'Finance Procurement Policy FIN-PROC-07',
          owner: 'Priya Nair, Finance & Legal Lead',
          quote: 'The approval window is 5 business days from submission, including the Finance review.'
        },
        impact: 'Two urgent replacement-carrier orders sat in approval for 5 business days because Ops planned on 3. Buffer stock at the Northern hub ran out on August 10.',
        impactDocId: 'D10',
        suggestedFix: 'Purchase requests are approved within 5 business days of submission, including Finance review (FIN-PROC-07). Managers must plan supplier orders and replacement carriers on this 5-day window. This replaces the 3-day window in Employee Handbook §4.2.'
      }
    ]
  };
}

app.post('/api/scan-conflicts', async (req, res) => {
  const documents: any[] = Array.isArray(req.body?.documents) ? req.body.documents : [];

  if (!apiKey) {
    return res.json(fallbackConflicts());
  }

  const key = hashKey('conflicts', docSignature(documents));
  const cached = await getCachedAnswer(key);
  if (cached) {
    return res.json(cached);
  }

  if (isGeminiPaused()) {
    return res.json({ ...fallbackConflicts(), servedFrom: 'memory' });
  }

  try {
    const docContext = documents
      .map((d: any) => `[Doc ${d.id}] "${d.title}" (${d.date}, Author: ${d.author})\nType: ${d.type}\nContent:\n${d.content}\n---`)
      .join('\n\n');

    const prompt = `You are "Mnemo", the policy conflict radar for Brightwell Logistics.

COMPANY DOCUMENTS:
${docContext}

TASK:
Find rules in documents of type "policy" or "memo" that directly contradict each other
(for example two different numbers, deadlines or owners for the same process).
For each real contradiction:
- sideA and sideB: the two documents, their author as owner, and an exact quote of the conflicting rule.
- risk: High if it has already caused harm in the records, Medium if it could, Low otherwise.
- confidence: how sure you are it is a real contradiction (High, Medium, Low).
- impact: one or two sentences on the harm, using ONLY facts from the documents; impactDocId is the document that records the harm (empty if none).
- suggestedFix: one corrected rule written as policy text that both owners could approve.
Rules: use ONLY the documents above, quote exactly, never invent documents, numbers or people.
If there are no contradictions, return an empty conflicts array.`;

    const response = await gemini.generateContent({
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: CONFLICTS_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const knownIds = new Set(documents.map((d: any) => d.id));
    const conflicts = (parsed.conflicts || []).filter(
      (c: any) => knownIds.has(c.sideA?.docId) && knownIds.has(c.sideB?.docId)
    );
    const result = { conflicts };
    rememberAnswer(key, result);
    return res.json(result);
  } catch (err: any) {
    console.error('Scan conflicts error:', err);
    return res.json({ ...fallbackConflicts(), servedFrom: 'memory' });
  }
});

// 4. EXPERT TWIN ENDPOINT (EXIT TWIN)
const EXPERTS: Record<string, { name: string; role: string; docIds: string[] }> = {
  maria: {
    name: 'Maria Tan',
    role: 'Procurement Lead (2019-2026)',
    docIds: ['D1', 'D2', 'D11']
  }
};

const EXPERT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    covered: { type: Type.BOOLEAN },
    answer: { type: Type.STRING },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          docId: { type: Type.STRING },
          docTitle: { type: Type.STRING },
          date: { type: Type.STRING },
          snippet: { type: Type.STRING }
        },
        required: ['docId', 'docTitle', 'date', 'snippet']
      }
    }
  },
  required: ['covered', 'answer', 'citations']
};

const EXIT_INTERVIEW = { docId: 'D11', docTitle: 'Exit Interview: Maria Tan, Procurement Lead', date: '2026-09-20' };

// Verified answers from Maria's records, used when Gemini is unavailable
function fallbackExpertAnswer(question: string) {
  const q = question.toLowerCase();

  if (q.includes('delay') || q.includes('late') || q.includes('slow')) {
    return {
      covered: true,
      answer: "When a carrier ran late two weeks in a row, I asked them for a written recovery plan within 48 hours and tracked it every week at the Monday ops sync. Meanwhile I split orders: urgent Tier-1 orders went to our backup carrier, Vendor A, even at a higher rate, and bulk orders stayed with the main carrier. That kept customers whole while we fixed the contract.",
      citations: [
        { ...EXIT_INTERVIEW, snippet: 'I asked the carrier for a written recovery plan within 48 hours, and I tracked it every week at the Monday ops sync.' },
        { ...EXIT_INTERVIEW, snippet: 'Urgent Tier-1 orders went to our backup carrier, which was Vendor A, even at a higher rate, and bulk orders stayed with the main carrier.' }
      ]
    };
  }

  if (q.includes('vendor c') || q.includes('trial') || q.includes('new carrier') || q.includes('evaluate')) {
    return {
      covered: true,
      answer: "Never sign without a paid trial first. Our 90-day trial with Vendor C showed 7% of shipments damaged, against a tolerance under 0.8%, so we dropped them in August 2023.",
      citations: [
        { ...EXIT_INTERVIEW, snippet: "A 90-day trial is how we caught Vendor C's 7% damage rate in 2023." },
        { docId: 'D1', docTitle: 'Vendor C Trial Review & Post-Mortem', date: '2023-08-14', snippet: 'Exactly 7% of shipments experienced documented cargo damage during transit (our strict company tolerance is < 0.8%).' }
      ]
    };
  }

  if (q.includes('vendor b') || q.includes('re-bid') || q.includes('rebid') || q.includes('successor') || q.includes('contract')) {
    return {
      covered: true,
      answer: "Re-bid the contract. We chose Vendor B in 2024 because it was 20% cheaper ($10.00 vs $12.50 per unit) with 2-day delivery. Check both against today's numbers. If they no longer hold, the original reason for choosing Vendor B is gone.",
      citations: [
        { ...EXIT_INTERVIEW, snippet: "Re-bid the contract. Vendor B won in 2024 on price and speed, so check both against today's numbers." },
        { docId: 'D2', docTitle: 'Supplier Selection & RFP Final Review', date: '2024-03-12', snippet: '20% lower unit rate ($10.00 vs $12.50). Fast 2-day delivery turnaround.' }
      ]
    };
  }

  if (q.includes('approval') || q.includes('approve')) {
    return {
      covered: true,
      answer: "The approval rules were the thing I didn't get to. HR says 3 days and Finance says 5, and that gap has delayed urgent orders. Someone needs to merge them into one rule.",
      citations: [
        { ...EXIT_INTERVIEW, snippet: 'HR says 3 days and Finance says 5, and that gap has delayed urgent orders. Someone needs to merge them into one rule.' }
      ]
    };
  }

  return {
    covered: false,
    answer: "That isn't in my records, so I won't guess. I can help with supplier delays, carrier trials, the Vendor B contract or purchase approvals.",
    citations: []
  };
}

app.post('/api/ask-expert', async (req, res) => {
  const { expertId, question, documents } = req.body || {};
  const expert = EXPERTS[expertId];

  if (!expert) {
    return res.status(404).json({ error: 'Expert not found.' });
  }
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required.' });
  }

  if (!apiKey) {
    return res.json(fallbackExpertAnswer(question));
  }

  const key = hashKey('expert', expertId, normalizeQuestion(question));
  const cached = await getCachedAnswer(key);
  if (cached) {
    return res.json(cached);
  }

  const sendFallbackOrError = (err?: any) => {
    const fallback = fallbackExpertAnswer(question);
    if (fallback.covered) {
      return res.json({ ...fallback, servedFrom: 'memory' });
    }
    const is429 = !err || isQuotaError(err);
    return res.status(is429 ? 429 : (err?.status || 500)).json({
      error: is429 ? 'Error 429: quota exceeded' : 'Gemini is unavailable right now. Please retry.',
      isQuotaExceeded: is429
    });
  };

  if (isGeminiPaused()) {
    return sendFallbackOrError();
  }

  try {
    const expertDocs = (Array.isArray(documents) ? documents : []).filter((d: any) => expert.docIds.includes(d.id));
    const docContext = expertDocs
      .map((d: any) => `[Doc ${d.id}] "${d.title}" (${d.date})\nContent:\n${d.content}\n---`)
      .join('\n\n');

    const prompt = `You are the expert twin of ${expert.name}, ${expert.role} at Brightwell Logistics.
She has left the company. You answer her colleagues' questions in first person, like a warm,
practical colleague handing over her know-how.

${expert.name.toUpperCase()}'S RECORDS (your ONLY knowledge):
${docContext}

QUESTION FROM A COLLEAGUE:
"${question}"

RULES:
1. Use ONLY the records above. Never invent facts, numbers, people, or advice she didn't give.
2. Answer in at most 80 words, plain English, first person ("I", "we").
3. Cite every record you used: docId, docTitle, date and an exact quote as snippet.
4. If the records don't answer the question, set covered=false, cite nothing, and answer:
   "That isn't in my records, so I won't guess." followed by one short line on what you can help with.`;

    const response = await gemini.generateContent({
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
        responseSchema: EXPERT_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const citations = (parsed.citations || []).filter((c: any) => expert.docIds.includes(c.docId));
    // An answer without a valid citation is treated as not covered, never shown as fact
    const result = Boolean(parsed.covered) && citations.length > 0
      ? { covered: true, answer: parsed.answer || '', citations }
      : fallbackExpertAnswer('');
    rememberAnswer(key, result);
    return res.json(result);
  } catch (err: any) {
    console.error('Ask expert error:', err);
    return sendFallbackOrError(err);
  }
});

// Setup Vite or static serving
async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = process.env.PORT || 3000;
  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Mnemo running on http://0.0.0.0:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
