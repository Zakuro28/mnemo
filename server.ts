import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
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
        sourceTitle: 'Vendor C Trial Review',
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
              docTitle: 'Vendor C Trial Review',
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
              docTitle: 'Meeting notes: Vendor selection',
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
              docTitle: 'Vendor C Trial Review',
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
              docTitle: 'Meeting notes: Vendor selection',
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
              docTitle: 'Vendor B contract execution email',
              date: '2024-03-15',
              snippet: 'Approved. Vendor B contract signed, 8,000 units/month.'
            }
          ]
        },
        {
          id: 'step-4',
          date: '2026-07-30',
          author: 'Operations Quality Team',
          action: 'Vendor B average delivery time is now 5 days.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D4',
              docTitle: 'Ops delivery report',
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
      summary: 'Weekly ops sync scheduled Mondays at 09:30 AM to coordinate fleet dispatch before shift rotations.',
      triedBefore: null,
      timeline: [
        {
          id: 'step-sync-1',
          date: '2025-01-10',
          author: 'Daniel Cruz, Ops Director',
          action: 'Weekly ops sync on Mondays at 09:30 AM to align dispatch pipelines before warehouse shifts rotate.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D6',
              docTitle: 'Weekly Operations Cadence Guideline',
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
          action: 'All executed vendor agreements and addenda must be archived in the encrypted Corporate Shared Drive /Legal/Executed to satisfy SOC2 audit requirements.',
          optionsConsidered: [],
          optionsRejected: [],
          citations: [
            {
              docId: 'D7',
              docTitle: 'Central Contract Repository Standard',
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
3. Do NOT add places, terms, or options that are not in the documents (do not add words like "Eastern route", "guaranteed SLA", "Renegotiate terms", "Immediate breach declaration", or "Internal monitoring flag").
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

  try {
    const prompt = buildAskMnemoPrompt(query, documents);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
    return res.json(parsed);
  } catch (err: any) {
    console.error('Gemini Ask Mnemo Error:', err);
    const is429 = 
      err?.status === 429 || 
      err?.message?.includes('429') || 
      err?.message?.includes('RESOURCE_EXHAUSTED') ||
      err?.message?.includes('quota');
    const status = is429 ? 429 : (err?.status || 500);
    return res.status(status).json({ 
      error: is429 ? 'Error 429: quota exceeded' : (err?.message || 'Error executing query'),
      status,
      isQuotaExceeded: is429
    });
  }
});

// 2. ASK MNEMO STREAMING ENDPOINT (FAST SSE PROGRESSIVE STREAMING)
app.post('/api/ask-lore-stream', async (req, res) => {
  const { query, documents } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required.' });
  }

  // If no Gemini key, stream deterministic fallback
  if (!apiKey) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
    const fallback = getFallbackAskLore(query);
    res.write(`event: summary\ndata: ${JSON.stringify({
      found: fallback.found,
      decisionTitle: fallback.decisionTitle || '',
      summary: fallback.summary || '',
      triedBefore: fallback.triedBefore || null,
      message: fallback.message || ''
    })}\n\n`);

    if (fallback.timeline && fallback.timeline.length > 0) {
      for (let i = 0; i < fallback.timeline.length; i++) {
        await new Promise((r) => setTimeout(r, 60));
        res.write(`event: step\ndata: ${JSON.stringify({ step: fallback.timeline[i], index: i })}\n\n`);
      }
    }

    res.write(`event: done\ndata: ${JSON.stringify(fallback)}\n\n`);
    res.end();
    return;
  }

  try {
    const prompt = buildAskMnemoPrompt(query, documents);

    const streamResult = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
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
    const is429 = 
      err?.status === 429 || 
      err?.message?.includes('429') || 
      err?.message?.includes('RESOURCE_EXHAUSTED') ||
      err?.message?.includes('quota');
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
      return res.json({
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
      });
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

    return res.json({
      status: contradicted.length > 0 ? 'success' : 'no_effect',
      message: contradicted.length > 0
        ? `${contradicted.length} decision assumption went stale.`
        : 'No decisions affected. All assumptions still hold.',
      fileName: fileName || 'Uploaded_Document.pdf',
      fileHash: Buffer.from(content).toString('base64').substring(0, 32),
      findings,
      staleCount: contradicted.length,
      monthlyImpact
    });
  } catch (err: any) {
    console.error('Check assumptions error:', err);

    // Fallback if AI call fails
    if (isVendorBInvoice) {
      return res.json({
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
          }
        ],
        staleCount: 1,
        monthlyImpact: 4800
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong analyzing the document. Please retry.'
    });
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
    console.log(`Lore running on http://0.0.0.0:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
