import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  ArrowRight, 
  FileText, 
  RefreshCw, 
  User, 
  RotateCcw 
} from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { AskLoreResponse, TimelineStep } from '../types/lore';
import { getCachedAnswer, setCachedAnswer } from '../services/askCache';

interface AskLoreViewProps {
  initialQuery?: string;
}

const SAMPLE_QUESTIONS = [
  { label: 'Why do we use Vendor B?', question: 'Why do we use Vendor B as primary supplier?' },
  { label: 'Should we switch to Vendor C?', question: 'Should we switch to Vendor C?' },
  { label: 'Why weekly sync on Mondays?', question: 'Why do we have weekly ops sync on Mondays?' },
  { label: 'Why did we reject Vendor A?', question: 'Why did we reject Vendor A in the 2024 RFP?' },
  { label: 'Why use shared drive for contracts?', question: 'Why do we use a shared drive for contracts?' }
];

export const AskLoreView: React.FC<AskLoreViewProps> = ({ initialQuery = '' }) => {
  const { documents, openSourceByDocId, addToast, resetKey, registerAbortController } = useLore();
  const [query, setQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [response, setResponse] = useState<AskLoreResponse | null>(null);
  const [streamingSteps, setStreamingSteps] = useState<TimelineStep[]>([]);
  const [streamingSummary, setStreamingSummary] = useState<{
    found?: boolean;
    decisionTitle?: string;
    summary?: string;
    triedBefore?: any;
    message?: string;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);

  const loadingStatuses = [
    'Reading documents...',
    'Tracing the decision...',
    'Checking sources...'
  ];

  // Rotate loading text
  useEffect(() => {
    let interval: any;
    if (isLoading && !isRetrying) {
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => (prev + 1) % loadingStatuses.length);
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isLoading, isRetrying]);

  // Reset Demo: clear everything visible in Ask Mnemo
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (unregisterRef.current) {
      unregisterRef.current();
      unregisterRef.current = null;
    }
    setQuery('');
    setResponse(null);
    setStreamingSteps([]);
    setStreamingSummary(null);
    setHasSearched(false);
    setErrorMsg(null);
    setRawError(null);
    setIsTimedOut(false);
    setIsLoading(false);
    setIsRetrying(false);
  }, [resetKey]);

  const handleAsk = async (questionToAsk?: string, isRetryAttempt = false) => {
    const q = (questionToAsk !== undefined ? questionToAsk : query).trim();
    if (!q) return;

    if (!isRetryAttempt) {
      setQuery(q);
      setErrorMsg(null);
      setRawError(null);
      setIsTimedOut(false);
      setHasSearched(true);

      // 1. INSTANT ANSWER FROM CACHE
      const cached = getCachedAnswer(q);
      if (cached) {
        setResponse(cached);
        setStreamingSteps([]);
        setStreamingSummary(null);
        setIsLoading(false);
        setIsRetrying(false);
        return;
      }
    }

    // 2. LIVE EXECUTION WITH SINGLE ACTIVE REQUEST + 30s TIMEOUT UNTIL FIRST CHUNK
    setIsLoading(true);
    setLoadingStepIndex(0);
    if (!isRetryAttempt) {
      setStreamingSteps([]);
      setStreamingSummary(null);
      setResponse(null);
    }

    // Only ONE request at a time: cancel old in-flight request if user asks again
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (unregisterRef.current) {
      unregisterRef.current();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    unregisterRef.current = registerAbortController(controller);

    // Timeout: 30 seconds, measured until the FIRST streamed chunk arrives, not full answer
    let firstChunkArrived = false;
    let timeoutTimer: any = setTimeout(() => {
      if (!firstChunkArrived) {
        // Abort due to timeout
        try {
          (controller as any)._timedOut = true;
          controller.abort('timeout');
        } catch {
          controller.abort();
        }
      }
    }, 30000);

    const markFirstChunk = () => {
      if (!firstChunkArrived) {
        firstChunkArrived = true;
        clearTimeout(timeoutTimer);
      }
    };

    try {
      const streamRes = await fetch('/api/ask-lore-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, documents }),
        signal: controller.signal
      });

      // Check HTTP status errors (like 429 rate limit)
      if (!streamRes.ok) {
        let errText = '';
        try {
          const errJson = await streamRes.json();
          errText = errJson.error || errJson.message || `HTTP ${streamRes.status}`;
        } catch {
          errText = await streamRes.text().catch(() => `HTTP ${streamRes.status}`);
        }

        const is429Status = 
          streamRes.status === 429 || 
          errText.includes('429') || 
          errText.includes('RESOURCE_EXHAUSTED') ||
          errText.includes('quota');

        if (is429Status) {
          throw new Error(errText || 'Error 429: quota exceeded');
        } else {
          throw new Error(errText || `Request failed with status ${streamRes.status}`);
        }
      }

      if (!streamRes.body) {
        throw new Error('Streaming response body is missing');
      }

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';
      let finalResult: AskLoreResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // First streamed chunk arrived! Clear the 30s timeout immediately
        markFirstChunk();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (!dataStr) continue;
            try {
              const parsedData = JSON.parse(dataStr);
              if (currentEvent === 'error') {
                throw new Error(parsedData.error || 'Gemini stream error');
              } else if (currentEvent === 'summary') {
                setStreamingSummary({
                  found: parsedData.found,
                  decisionTitle: parsedData.decisionTitle,
                  summary: parsedData.summary,
                  triedBefore: parsedData.triedBefore,
                  message: parsedData.message
                });
              } else if (currentEvent === 'step') {
                if (parsedData.step) {
                  setStreamingSteps((prev) => [...prev, parsedData.step]);
                }
              } else if (currentEvent === 'done') {
                finalResult = parsedData;
              }
            } catch (parseErr: any) {
              if (currentEvent === 'error') {
                throw parseErr;
              }
              console.warn('Error parsing SSE chunk:', parseErr);
            }
          }
        }
      }

      clearTimeout(timeoutTimer);

      if (finalResult) {
        // Cache answer ONLY after a real query succeeds
        setCachedAnswer(q, finalResult);
        setResponse(finalResult);
        setStreamingSteps([]);
        setStreamingSummary(null);
        setIsLoading(false);
        setIsRetrying(false);
      } else {
        throw new Error('Incomplete stream response from memory engine');
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);

      // If aborted by user starting a newer query or demo reset, silently exit
      const isManualAbort = controller.signal.aborted && !(controller as any)._timedOut && controller.signal.reason !== 'timeout';
      if (isManualAbort) {
        return;
      }

      const isTimeout = (controller as any)._timedOut || controller.signal.reason === 'timeout' || err.name === 'AbortError';

      // 429 / RESOURCE_EXHAUSTED / 503 check: automatic 1-time retry after 3 seconds
      const isRateLimit = 
        err?.message?.includes('429') || 
        err?.message?.includes('RESOURCE_EXHAUSTED') || 
        err?.message?.includes('quota') ||
        err?.message?.includes('503') ||
        err?.message?.includes('UNAVAILABLE');

      if (isRateLimit && !isRetryAttempt && !controller.signal.aborted) {
        setIsRetrying(true);
        // Wait 3 seconds, showing "Busy — retrying..."
        await new Promise((r) => setTimeout(r, 3000));
        if (controller.signal.aborted) return;
        setIsRetrying(false);
        return handleAsk(q, true);
      }

      // Fallback attempt: if not a timeout and not retried yet, try standard non-streaming endpoint
      if (!isTimeout && !isRetryAttempt && !controller.signal.aborted) {
        try {
          const fallbackRes = await fetch('/api/ask-lore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, documents }),
            signal: controller.signal
          });

          if (!fallbackRes.ok) {
            let fbErr = '';
            try {
              const fbJson = await fallbackRes.json();
              fbErr = fbJson.error || `HTTP ${fallbackRes.status}`;
            } catch {
              fbErr = await fallbackRes.text().catch(() => `HTTP ${fallbackRes.status}`);
            }
            throw new Error(fbErr);
          }

          const fallbackData: AskLoreResponse = await fallbackRes.json();
          setCachedAnswer(q, fallbackData);
          setResponse(fallbackData);
          setStreamingSteps([]);
          setStreamingSummary(null);
          setIsLoading(false);
          setIsRetrying(false);
          return;
        } catch (fbErr: any) {
          // If fallback also had 429 and we haven't retried yet
          const fbRateLimit = 
            fbErr?.message?.includes('429') || 
            fbErr?.message?.includes('RESOURCE_EXHAUSTED') || 
            fbErr?.message?.includes('quota');

          if (fbRateLimit && !isRetryAttempt && !controller.signal.aborted) {
            setIsRetrying(true);
            await new Promise((r) => setTimeout(r, 3000));
            if (controller.signal.aborted) return;
            setIsRetrying(false);
            return handleAsk(q, true);
          }
        }
      }

      // Log the full error with console.error so we can see what is failing
      console.error('Ask Mnemo error:', err);

      setIsLoading(false);
      setIsRetrying(false);
      setIsTimedOut(isTimeout);
      setErrorMsg(isTimeout ? 'Taking longer than usual — Retry' : 'Something went wrong — Retry');
      let cleanErrMsg = err?.message || (typeof err === 'string' ? err : 'Error 429: quota exceeded');
      try {
        const parsed = JSON.parse(cleanErrMsg);
        if (parsed.error) {
          if (typeof parsed.error === 'object' && parsed.error.message) {
            cleanErrMsg = `Error ${parsed.error.code || ''}: ${parsed.error.message}`;
          } else if (typeof parsed.error === 'string') {
            cleanErrMsg = parsed.error;
          }
        }
      } catch {
        // preserve as string
      }

      setRawError(cleanErrMsg);
    } finally {
      if (unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (initialQuery && !hasSearched) {
      handleAsk(initialQuery);
    }
  }, [initialQuery]);

  // Active display data (supports progressive reveal during streaming)
  const displayFound = response ? response.found : streamingSummary?.found;
  const displayTitle = response ? response.decisionTitle : streamingSummary?.decisionTitle;
  const displaySummary = response ? response.summary : streamingSummary?.summary;
  const displayTriedBefore = response ? response.triedBefore : streamingSummary?.triedBefore;
  const displayTimeline = response ? (response.timeline || []) : streamingSteps;
  const isProgressiveStreaming = isLoading && Boolean(streamingSummary || streamingSteps.length > 0);

  return (
    <div className="space-y-8 pb-16 animate-page-enter">
      {/* Hero Section */}
      <div className="space-y-2">
        <h1 className="font-serif text-[48px] md:text-[56px] font-normal tracking-tight text-[#12332B] leading-tight">
          Ask Mnemo
        </h1>
        <p className="text-[#3F5A52] text-[16px] leading-relaxed max-w-3xl">
          Ask why we do X or propose an idea. Mnemo reconstructs the exact historical decision chain with citations.
        </p>
      </div>

      {/* Large Search Box: 56px tall, 16px radius, white with teal focus ring */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="h-14 bg-white border border-[#E3EAE7] rounded-2xl flex items-center px-4 gap-3 shadow-[0_4px_20px_rgba(18,51,43,0.06)] focus-within:border-[#3D8D7A] focus-within:ring-3 focus-within:ring-[#3D8D7A]/20 transition-all"
        >
          <Sparkles className="w-5 h-5 text-[#3D8D7A] shrink-0" strokeWidth={1.75} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask why we do something (e.g. 'Why do we use Vendor B as primary supplier?')"
            className="flex-1 bg-transparent text-[15px] text-[#12332B] placeholder:text-[#7A8C86] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className={`h-10 px-5 text-white font-semibold text-[14px] rounded-xl active:scale-[0.97] transition-all flex items-center gap-2 whitespace-nowrap shadow-xs ${
              isLoading
                ? 'bg-[#3D8D7A] opacity-90 cursor-wait'
                : !query.trim()
                ? 'bg-[#3D8D7A] opacity-50 cursor-not-allowed'
                : 'btn-primary-teal'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span className="text-white">
                  {isRetrying ? 'Retrying...' : 'Tracing...'}
                </span>
              </>
            ) : (
              <>
                <span>Ask</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </>
            )}
          </button>
        </form>

        {/* Suggested Questions as Soft Pill Chips */}
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[#7A8C86] font-medium mr-1">Suggested:</span>
          {SAMPLE_QUESTIONS.map((sq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAsk(sq.question)}
              className="px-3 py-1 rounded-full bg-[#E3F0EC] hover:bg-[#D3EBE3] text-[#2C6B5C] hover:text-[#12332B] font-medium transition-colors border border-[#E3EAE7] active:scale-[0.97]"
            >
              {sq.label}
            </button>
          ))}
        </div>
      </div>

      {/* 30s Timeout or Error Card with Real Error Line */}
      {errorMsg && !isLoading && (
        <div className="p-6 rounded-2xl bg-[#FFF8F6] border border-[#C8553D]/40 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#C8553D] shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="font-semibold text-[#12332B] text-[15px]">
                {errorMsg}
              </p>
              <p className="text-[#3F5A52] text-[13px] mt-0.5">
                {isTimedOut 
                  ? 'The decision memory query exceeded 30 seconds before responding. Click Retry to re-query.' 
                  : 'Unable to reach the decision memory engine. Please retry.'}
              </p>
              {rawError && (
                <p className="text-[12px] font-mono text-[#7A8C86] mt-2 select-all break-words">
                  {rawError}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => handleAsk(query)}
            className="px-4 py-2 bg-[#C8553D] hover:bg-[#b0452f] text-white text-[13px] font-semibold rounded-xl transition-all active:scale-[0.97] flex items-center gap-1.5 shrink-0 self-start md:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Thinking / Waiting State: 3 bouncing teal dots + rotating status text (or 'Busy — retrying...') */}
      {isLoading && !isProgressiveStreaming && (
        <div className="mnemo-card p-6 space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 font-semibold text-[14px] text-[#12332B]">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3D8D7A] bounce-dot-1" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#3D8D7A] bounce-dot-2" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#3D8D7A] bounce-dot-3" />
            </div>
            <span className="text-[#3D8D7A] font-medium">
              {isRetrying ? 'Busy — retrying...' : loadingStatuses[loadingStepIndex]}
            </span>
          </div>

          <div className="space-y-3">
            <div className="h-6 bg-[#E3F0EC] rounded-md w-2/3 animate-pulse" />
            <div className="h-4 bg-[#E3F0EC]/60 rounded-md w-full animate-pulse" />
            <div className="h-4 bg-[#E3F0EC]/60 rounded-md w-4/5 animate-pulse" />
          </div>

          <div className="pt-6 border-t border-[#E3EAE7] space-y-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex gap-4 items-start">
                <div className="w-3 h-3 rounded-full bg-[#3D8D7A]/40 mt-2 shrink-0 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#E3F0EC] rounded w-1/4 animate-pulse" />
                  <div className="h-4 bg-[#E3F0EC]/60 rounded w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response View (Supports instant cached, completed, and progressive streaming) */}
      {(response || isProgressiveStreaming) && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Amber "Heads up: tried before" card with soft amber edge */}
          {displayTriedBefore && displayTriedBefore.detected && (
            <div className="p-6 rounded-2xl bg-white border border-[#D99A1E]/50 shadow-[0_4px_24px_rgba(217,154,30,0.12)] animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#D99A1E]/15 text-[#D99A1E] border border-[#D99A1E]/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-[#D99A1E]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#D99A1E]">
                    Heads up: tried before
                  </span>
                  <h3 className="text-[17px] font-bold text-[#12332B] mt-1">
                    "{displayTriedBefore.idea}" failed in prior trials
                  </h3>
                  <p className="text-[14px] text-[#3F5A52] mt-1.5 leading-relaxed">
                    {displayTriedBefore.reason}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#D99A1E]/20 flex items-center justify-between flex-wrap gap-2">
                    <button
                      onClick={() => openSourceByDocId(displayTriedBefore.sourceDocId)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7FAF9] border border-[#D99A1E]/40 text-[#12332B] text-[13px] font-medium hover:bg-[#E3F0EC] transition-colors active:scale-[0.97]"
                    >
                      <FileText className="w-4 h-4 text-[#D99A1E]" strokeWidth={1.75} />
                      <span>{displayTriedBefore.sourceTitle} ({displayTriedBefore.sourceDate})</span>
                    </button>
                    <span className="text-[13px] italic text-[#7A8C86]">
                      "{displayTriedBefore.snippet}"
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Not Found State */}
          {displayFound === false ? (
            <div className="mnemo-card p-10 text-center">
              <h3 className="font-serif text-[28px] font-normal text-[#12332B]">
                I couldn't find this in your company's records.
              </h3>
              <p className="text-[#7A8C86] text-[15px] mt-2 max-w-md mx-auto">
                Mnemo answers only from verified company documents and never invents reasons.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => handleAsk('Why do we use Vendor B as primary supplier?')}
                  className="btn-primary-teal px-4 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97]"
                >
                  Try: "Why do we use Vendor B as primary supplier?"
                </button>
              </div>
            </div>
          ) : (
            /* Vertical Timeline with Teal Line that draws downward */
            <div className="mnemo-card p-6 space-y-6">
              <div className="border-b border-[#E3EAE7] pb-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[20px] font-semibold text-[#12332B]">
                    {displayTitle || 'Decision Timeline'}
                  </h2>
                  {isLoading && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3D8D7A] bg-[#E3F0EC] px-2.5 py-1 rounded-full">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Streaming timeline...
                    </span>
                  )}
                </div>
                {displaySummary && (
                  <p className="text-[#3F5A52] text-[15px] mt-1.5 leading-relaxed">
                    {displaySummary}
                  </p>
                )}
              </div>

              {/* Vertical line with dots */}
              {displayTimeline && displayTimeline.length > 0 && (
                <div className="relative pl-6 border-l-2 border-[#3D8D7A] timeline-line-draw space-y-8 my-2">
                  {displayTimeline.map((step, idx) => {
                    const hasOptionsConsidered = step.optionsConsidered && step.optionsConsidered.length > 0;
                    const hasOptionsRejected = step.optionsRejected && step.optionsRejected.length > 0;
                    const showOptionsBox = hasOptionsConsidered || hasOptionsRejected;

                    return (
                      <div
                        key={step.id || idx}
                        className="relative transition-all"
                        style={{
                          animation: `pageEnterFadeUp 220ms cubic-bezier(0.23, 1, 0.32, 1) ${idx * 60}ms both`
                        }}
                      >
                        {/* Teal Dot */}
                        <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#3D8D7A] border-2 border-white shadow-xs" />

                        <div className="bg-white border border-[#E3EAE7] rounded-2xl p-6 space-y-4 shadow-xs">
                          {/* Header: Date + People in 14px */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#12332B] font-mono">
                                {step.date}
                              </span>
                              <span className="text-[#7A8C86]">·</span>
                              <span className="text-[#3F5A52] font-medium flex items-center gap-1.5">
                                <User className="w-4 h-4 text-[#3D8D7A]" strokeWidth={1.75} />
                                {step.author}
                              </span>
                            </div>
                          </div>

                          {/* Decision Title: 18px semibold in #12332B */}
                          <h3 className="text-[18px] font-semibold text-[#12332B] leading-snug">
                            {step.action}
                          </h3>

                          {/* Options considered and rejected */}
                          {showOptionsBox && (
                            <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-[14px]">
                              {hasOptionsConsidered && (
                                <div className="p-3.5 rounded-xl bg-[#F7FAF9] border border-[#E3EAE7]">
                                  <span className="font-semibold text-[#12332B] block mb-1.5 text-[13px]">
                                    Options Considered:
                                  </span>
                                  <ul className="list-disc list-inside space-y-1 text-[#3F5A52]">
                                    {step.optionsConsidered.map((opt, oi) => (
                                      <li key={oi}>{opt}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {hasOptionsRejected && (
                                <div className="p-3.5 rounded-xl bg-[#F7FAF9] border border-[#E3EAE7]">
                                  <span className="font-semibold text-[#C8553D] block mb-1.5 text-[13px]">
                                    Options Rejected:
                                  </span>
                                  <div className="space-y-1.5">
                                    {step.optionsRejected.map((rej, ri) => (
                                      <div key={ri} className="text-[#3F5A52]">
                                        <span className="font-medium text-[#12332B]">{rej.option}: </span>
                                        <span className="text-[#7A8C86] italic">{rej.reason}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Citation Chips: pop in last with animation delay */}
                          {step.citations && step.citations.length > 0 && (
                            <div className="pt-1 flex flex-wrap items-center gap-2">
                              <span className="text-[13px] text-[#7A8C86] font-medium">Citations:</span>
                              {step.citations.map((cite, ci) => (
                                <button
                                  key={ci}
                                  onClick={() => openSourceByDocId(cite.docId)}
                                  style={{
                                    animation: `logoNodePop 250ms cubic-bezier(0.23, 1, 0.32, 1) ${idx * 60 + 150}ms both`
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E3F0EC] hover:bg-[#3D8D7A] hover:text-white text-[#12332B] border border-[#3D8D7A]/30 text-[13px] font-medium transition-all active:scale-[0.97] shadow-xs group"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#3D8D7A] group-hover:text-white" strokeWidth={1.75} />
                                  <span>{cite.docTitle}</span>
                                  <span className="text-[#7A8C86] group-hover:text-white/80 text-[12px]">({cite.date})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shimmer placeholder below arriving steps while stream is still running */}
              {isLoading && (
                <div className="pt-4 border-t border-[#E3EAE7] flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3D8D7A] animate-ping" />
                  <span className="text-[13px] text-[#7A8C86] italic">
                    Retrieving next decision point...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
