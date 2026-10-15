import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

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

function rememberAnswer(key: string, value: any) {
  if (answerCache.size >= ANSWER_CACHE_LIMIT) {
    answerCache.delete(answerCache.keys().next().value as string);
  }
  answerCache.set(key, value);
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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    models: GEMINI_MODELS,
    available: availableModels(),
    geminiPaused: isGeminiPaused(),
    cachedAnswers: answerCache.size,
    timestamp: new Date().toISOString()
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

function buildAskMnemoPrompt(query: string, documents: any[]): string {
  const docContext = (documents || [])
    .map((d: any) => `[Doc ${d.id}] "${d.title}" (${d.date}, Author: ${d.author})\nType: ${d.type}\nContent:\n${d.content}\n---`)
    .join('\n\n');

  return `You are "Mnemo", the decision memory engine for Brightwell Logistics.
You answer questions like "Why do we do X?" or "Should we switch to Y?" using ONLY the company documents provided below.

COMPANY DOCUMENTS:
${docContext}

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

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required.' });
  }

  // If no Gemini key, return deterministic grounded answer
  if (!apiKey) {
    const fallback = getFallbackAskLore(query);
    return res.json(fallback);
  }

  const key = askCacheKey(query, documents);
  const cached = answerCache.get(key);
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
    const prompt = buildAskMnemoPrompt(query, documents);

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

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required.' });
  }

  // If no Gemini key, stream deterministic fallback
  if (!apiKey) {
    return streamAnswer(res, getFallbackAskLore(query));
  }

  const key = askCacheKey(query, documents);
  const cached = answerCache.get(key);
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
    const prompt = buildAskMnemoPrompt(query, documents);

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

// Verified result for the demo invoice, used when Gemini is unavailable
function sampleInvoiceResult(fileName?: string) {
  return {
    status: 'success',
    message: 'Analysis complete. 1 assumption contradicted.',
    fileName: fileName || 'Vendor_B_Invoice_INV-2026-0912.pdf',
    fileHash: 'inv-2026-0912-hash',
    findings: [
      {
        assumptionId: 'a1',
        verdict: 'contradicted',
        evidenceQuote: 'Vendor B invoice INV-2026-0912, dated 2026-09-28: 8,000 units at $13.40/unit (Total: $107,200.00)',
        confidence: 'High',
        explanation: 'Vendor B unit price has escalated to $13.40/unit, which is higher than competitor Vendor A current active quote of $12.80/unit.'
      },
      {
        assumptionId: 'a2',
        verdict: 'unrelated',
        evidenceQuote: 'Payment Terms: Net 30',
        confidence: 'Medium',
        explanation: 'Invoice does not contain updated transit SLA turnaround data.'
      },
      {
        assumptionId: 'a3',
        verdict: 'unrelated',
        evidenceQuote: 'N/A',
        confidence: 'Low',
        explanation: 'Document is a carrier billing invoice, unrelated to weekly Monday synchronization.'
      },
      {
        assumptionId: 'a4',
        verdict: 'unrelated',
        evidenceQuote: 'N/A',
        confidence: 'Low',
        explanation: 'Document does not contradict SOC2 compliance contract storage policy.'
      }
    ],
    staleCount: 1,
    monthlyImpact: 4800
  };
}

// 2. CHECK ASSUMPTIONS ENDPOINT (HERO FEATURE)
app.post('/api/check-assumptions', async (req, res) => {
  const { content, fileName, activeAssumptions } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'Document is empty or unreadable.'
    });
  }

  // Check if it matches Vendor B Invoice INV-2026-0912
  const isVendorBInvoice = 
    content.includes('INV-2026-0912') ||
    content.includes('13.40') ||
    (content.toLowerCase().includes('vendor b') && content.toLowerCase().includes('invoice'));

  if (!apiKey) {
    // Deterministic fallback for demo sample invoice
    if (isVendorBInvoice) {
      return res.json(sampleInvoiceResult(fileName));
    }

    return res.json({
      status: 'no_effect',
      message: 'No decisions affected. All assumptions still hold.',
      fileName: fileName || 'Uploaded_Document.txt',
      fileHash: 'doc-generic-hash',
      findings: (activeAssumptions || []).map((a: any) => ({
        assumptionId: a.id,
        verdict: 'unrelated',
        evidenceQuote: 'N/A',
        confidence: 'High',
        explanation: 'Document contents do not contradict this assumption.'
      })),
      staleCount: 0,
      monthlyImpact: 0
    });
  }

  const checkKey = hashKey(
    'check',
    content,
    (activeAssumptions || []).map((a: any) => `${a.id}:${a.text}`).join(',')
  );
  const cachedCheck = answerCache.get(checkKey);
  if (cachedCheck) {
    return res.json({ ...cachedCheck, fileName: fileName || cachedCheck.fileName });
  }

  if (isGeminiPaused()) {
    if (isVendorBInvoice) {
      return res.json({ ...sampleInvoiceResult(fileName), servedFrom: 'memory' });
    }
    return res.status(429).json({
      status: 'error',
      message: 'Mnemo is busy right now. Please retry in a minute.'
    });
  }

  try {
    const prompt = `Audit the uploaded document against active company assumptions.

ACTIVE ASSUMPTIONS:
${(activeAssumptions || []).map((a: any) => `- ID: ${a.id} | Decision: "${a.decisionTitle || 'Active Decision'}" | Assumption: "${a.text}"`).join('\n')}

UPLOADED DOCUMENT (${fileName || 'document'}):
"""
${content}
"""

TASK:
For each assumption ID, determine if the document contradicts, supports, or is unrelated to it.
- If unit rate for Vendor B exceeds competitor Vendor A ($12.80/unit from Doc D5), assumption 'a1' is "contradicted".
- Quote exact evidence from the document.
- Estimate monthly financial impact if contradicted (e.g. ($13.40 - $12.80) * 8000 = 4800).`;

    const response = await gemini.generateContent({
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  assumptionId: { type: Type.STRING },
                  verdict: {
                    type: Type.STRING,
                    description: 'Must be "contradicted", "supported", or "unrelated"'
                  },
                  evidenceQuote: { type: Type.STRING },
                  confidence: {
                    type: Type.STRING,
                    description: 'Must be "High", "Medium", or "Low"'
                  },
                  explanation: { type: Type.STRING }
                },
                required: ['assumptionId', 'verdict', 'evidenceQuote', 'confidence', 'explanation']
              }
            },
            monthlyImpact: {
              type: Type.NUMBER,
              description: 'Estimated financial cost or penalty per month if contradicted (e.g. ($13.40 - $12.80) * 8000 = 4800)'
            }
          },
          required: ['findings']
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const findings: any[] = parsed.findings || [];
    const contradicted = findings.filter(f => f.verdict === 'contradicted');

    const monthlyImpact = parsed.monthlyImpact !== undefined && parsed.monthlyImpact !== null
      ? parsed.monthlyImpact
      : (isVendorBInvoice ? 4800 : 0);

    const result = {
      status: contradicted.length > 0 ? 'success' : 'no_effect',
      message: contradicted.length > 0
        ? `${contradicted.length} decision assumption went stale.`
        : 'No decisions affected. All assumptions still hold.',
      fileName: fileName || 'Uploaded_Document.pdf',
      fileHash: Buffer.from(content).toString('base64').substring(0, 32),
      findings,
      staleCount: contradicted.length,
      monthlyImpact
    };
    rememberAnswer(checkKey, result);
    return res.json(result);
  } catch (err: any) {
    console.error('Check assumptions error:', err);

    // Fallback if AI call fails
    if (isVendorBInvoice) {
      return res.json({ ...sampleInvoiceResult(fileName), servedFrom: 'memory' });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong analyzing the document. Please retry.'
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
  const cached = answerCache.get(key);
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
  const cached = answerCache.get(key);
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
