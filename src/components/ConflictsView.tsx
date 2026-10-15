import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Send,
  ShieldCheck,
  Swords,
  Undo2
} from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { ConfidenceLevel, ConflictScanResult, PolicyConflict, PolicySide } from '../types/lore';

const SCAN_STEPS = [
  'Reading policies...',
  'Comparing rules side by side...',
  'Checking records for impact...'
];

// Keeps the scan animation on screen long enough to read, even when the answer is cached
const MIN_SCAN_MS = 1200;

const RISK_STYLES: Record<ConfidenceLevel, string> = {
  High: 'border-[#C8553D]/30 bg-[#C8553D]/12 text-[#C8553D]',
  Medium: 'border-[#D99A1E]/30 bg-[#D99A1E]/12 text-[#D99A1E]',
  Low: 'border-[#3D8D7A]/30 bg-[#3D8D7A]/12 text-[#3D8D7A]'
};

const ownerName = (owner: string) => owner.split(',')[0].trim();

// Highlights durations like "3 business days" so the clash is visible at a glance
const highlightDurations = (text: string) =>
  text.split(/(\d+(?:\.\d+)?[\s-](?:business days?|days?))/gi).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-semibold text-[#C8553D] bg-[#C8553D]/10 px-1 rounded">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

export const ConflictsView: React.FC = () => {
  const {
    documents,
    conflictScan,
    setConflictScan,
    conflictActions,
    setConflictAction,
    openSourceByDocId,
    addToast,
    registerAbortController,
    resetKey
  } = useLore();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const policies = documents.filter((d) => d.type === 'policy' || d.type === 'memo');

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    setIsScanning(false);
    setErrorMsg(null);
  }, [resetKey]);

  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      setScanStep((prev) => Math.min(prev + 1, SCAN_STEPS.length - 1));
    }, 450);
    return () => clearInterval(interval);
  }, [isScanning]);

  const runScan = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const unregister = registerAbortController(controller);

    setIsScanning(true);
    setScanStep(0);
    setErrorMsg(null);

    try {
      const startedAt = Date.now();
      const res = await fetch('/api/scan-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents }),
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const data: ConflictScanResult = await res.json();

      const remaining = MIN_SCAN_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }
      if (controller.signal.aborted) return;

      setConflictScan(data);
      const found = data.conflicts.length;
      addToast({
        type: found > 0 ? 'warning' : 'success',
        title: found > 0 ? `${found} policy conflict${found > 1 ? 's' : ''} found` : 'No conflicts found'
      });
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Conflict scan error:', err);
      setErrorMsg(err?.message || 'Scan failed');
    } finally {
      unregister();
      if (!controller.signal.aborted) {
        setIsScanning(false);
      }
    }
  };

  const sendForApproval = (conflict: PolicyConflict) => {
    setConflictAction(conflict.id, 'sent');
    addToast({
      type: 'success',
      title: 'Sent for approval',
      description: `${ownerName(conflict.sideA.owner)} and ${ownerName(conflict.sideB.owner)} will review the merged rule.`
    });
  };

  const copyFix = async (conflict: PolicyConflict) => {
    try {
      await navigator.clipboard.writeText(conflict.suggestedFix);
      addToast({ type: 'success', title: 'Suggested fix copied' });
    } catch {
      addToast({ type: 'warning', title: 'Could not copy', description: 'Select the text and copy it manually.' });
    }
  };

  const activeConflicts = conflictScan?.conflicts.filter((c) => conflictActions[c.id] !== 'dismissed') ?? [];

  const renderSide = (side: PolicySide, label: string) => (
    <div className="p-5 rounded-2xl bg-white border border-[#E3EAE7] space-y-3 shadow-xs flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wider text-[#7A8C86]">{label}</span>
        <button
          onClick={() => openSourceByDocId(side.docId)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E3F0EC] hover:bg-[#3D8D7A] hover:text-white text-[#12332B] border border-[#3D8D7A]/30 text-[12px] font-medium transition-colors active:scale-[0.97] group"
        >
          <FileText className="w-3.5 h-3.5 text-[#3D8D7A] group-hover:text-white" strokeWidth={1.75} />
          Doc {side.docId}
        </button>
      </div>
      <p className="text-[14px] font-semibold text-[#12332B] leading-snug">{side.docTitle}</p>
      <blockquote className="flex-1 p-3.5 rounded-xl bg-[#F7FAF9] border border-[#E3EAE7] text-[15px] text-[#3F5A52] leading-relaxed">
        "{highlightDurations(side.quote)}"
      </blockquote>
      <p className="text-[13px] text-[#7A8C86]">Owner: {side.owner}</p>
    </div>
  );

  const renderConflict = (conflict: PolicyConflict, index: number) => {
    const action = conflictActions[conflict.id];

    if (action === 'dismissed') {
      return (
        <div
          key={conflict.id}
          className="p-4 rounded-2xl border border-dashed border-[#E3EAE7] bg-white/60 flex items-center justify-between gap-4 text-[14px]"
        >
          <span className="text-[#7A8C86]">
            Dismissed: <span className="font-medium text-[#3F5A52]">{conflict.topic}</span>
          </span>
          <button
            onClick={() => setConflictAction(conflict.id, null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#3D8D7A] hover:bg-[#E3F0EC] transition-colors active:scale-[0.97]"
          >
            <Undo2 className="w-4 h-4" strokeWidth={1.75} />
            Undo
          </button>
        </div>
      );
    }

    return (
      <div
        key={conflict.id}
        className="mnemo-card p-6 md:p-8 space-y-6"
        style={{ animation: `pageEnterFadeUp 260ms cubic-bezier(0.23, 1, 0.32, 1) ${index * 80}ms both` }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#C8553D]/12 border border-[#C8553D]/25 text-[#C8553D] flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-[22px] font-semibold text-[#12332B] leading-snug">{conflict.topic}</h2>
              <p className="text-[14px] text-[#7A8C86] mt-0.5">
                Two policies give different rules for the same process.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[13px] font-semibold ${RISK_STYLES[conflict.risk] || RISK_STYLES.Medium}`}>
              <span className="w-2 h-2 rounded-full bg-current" />
              {conflict.risk} risk
            </span>
            <span className="px-3 py-1 rounded-full border border-[#E3EAE7] bg-white text-[13px] font-medium text-[#3F5A52]">
              Confidence: {conflict.confidence}
            </span>
          </div>
        </div>

        {/* Side-by-side rules */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          {renderSide(conflict.sideA, 'Rule A')}
          <div className="flex items-center justify-center">
            <span className="w-10 h-10 rounded-full bg-[#12332B] text-white text-[13px] font-bold flex items-center justify-center shadow-sm">
              vs
            </span>
          </div>
          {renderSide(conflict.sideB, 'Rule B')}
        </div>

        {/* What the conflict has cost */}
        {conflict.impact && (
          <div className="relative z-10 p-4 rounded-2xl bg-[#FFF8F6] border border-[#C8553D]/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#C8553D] shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-[13px] font-bold uppercase tracking-wider text-[#C8553D]">Why it matters</p>
                <p className="text-[15px] text-[#3F5A52] mt-0.5 leading-relaxed">{conflict.impact}</p>
              </div>
            </div>
            {conflict.impactDocId && (
              <button
                onClick={() => openSourceByDocId(conflict.impactDocId!)}
                className="shrink-0 self-start md:self-center inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#C8553D]/30 text-[12px] font-semibold text-[#C8553D] hover:bg-[#C8553D] hover:text-white transition-colors active:scale-[0.97]"
              >
                <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
                Doc {conflict.impactDocId}
              </button>
            )}
          </div>
        )}

        {/* Drafted fix: AI suggests, owners decide */}
        <div className="relative z-10 p-5 rounded-2xl bg-[#F3F8F6] border border-[#3D8D7A]/30 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[13px] font-bold uppercase tracking-wider text-[#2C6B5C]">Suggested fix</p>
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#3D8D7A]/30 text-[12px] font-medium text-[#2C6B5C]">
              AI draft · needs owner approval
            </span>
          </div>
          <p className="text-[16px] text-[#12332B] leading-relaxed">{conflict.suggestedFix}</p>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {action === 'sent' ? (
              <>
                <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3D8D7A]/12 border border-[#3D8D7A]/30 text-[14px] font-semibold text-[#2C6B5C]">
                  <Check className="w-4 h-4" strokeWidth={2.25} />
                  Sent to {ownerName(conflict.sideA.owner)} & {ownerName(conflict.sideB.owner)}
                </span>
                <button
                  onClick={() => setConflictAction(conflict.id, null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#7A8C86] hover:text-[#12332B] hover:bg-white transition-colors active:scale-[0.97]"
                >
                  <Undo2 className="w-4 h-4" strokeWidth={1.75} />
                  Undo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => sendForApproval(conflict)}
                  className="btn-primary-teal inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold"
                >
                  <Send className="w-4 h-4" strokeWidth={2} />
                  Send to owners for approval
                </button>
                <button
                  onClick={() => copyFix(conflict)}
                  className="btn-secondary-teal inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-medium"
                >
                  <Copy className="w-4 h-4" strokeWidth={1.75} />
                  Copy text
                </button>
                <button
                  onClick={() => setConflictAction(conflict.id, 'dismissed')}
                  className="px-4 py-2.5 rounded-xl text-[14px] font-medium text-[#7A8C86] hover:text-[#12332B] hover:bg-white transition-colors active:scale-[0.97]"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16 animate-page-enter">
      <div>
        <h1 className="font-serif text-[48px] md:text-[56px] font-normal tracking-tight text-[#12332B] leading-tight">
          Conflicts
        </h1>
        <p className="text-[#3F5A52] text-[16px] leading-relaxed max-w-3xl mt-2">
          Mnemo compares every policy and memo, and flags rules that contradict each other before they cost you.
        </p>
      </div>

      {/* Scan panel: shown before the first scan and while scanning */}
      {(!conflictScan || isScanning) && (
        <div className="mnemo-card p-6 md:p-8">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E3F0EC] border border-[#3D8D7A]/30 text-[#3D8D7A] flex items-center justify-center shrink-0 relative overflow-hidden">
                <ScanSearch className="w-6 h-6" strokeWidth={1.75} />
                {isScanning && (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-[#3D8D7A] animate-scan-sweep-down" />
                )}
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#12332B]">
                  {isScanning ? SCAN_STEPS[scanStep] : `Scan ${policies.length} policies for conflicts`}
                </h2>
                <p className="text-[14px] text-[#7A8C86] mt-0.5">
                  {isScanning
                    ? 'Gemini is checking every rule against every other rule.'
                    : 'Finds rules that say different things about the same process.'}
                </p>
              </div>
            </div>

            <button
              onClick={runScan}
              disabled={isScanning}
              className={`btn-primary-teal inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold shrink-0 ${isScanning ? 'cursor-wait opacity-90' : ''}`}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2} />
                  Scanning...
                </>
              ) : (
                <>
                  <ScanSearch className="w-4 h-4" strokeWidth={2} />
                  Scan for conflicts
                </>
              )}
            </button>
          </div>

          {/* Policies being compared */}
          <div className="relative z-10 mt-6 pt-6 border-t border-[#E3EAE7] grid grid-cols-1 md:grid-cols-3 gap-3">
            {policies.map((doc, idx) => (
              <button
                key={doc.id}
                onClick={() => openSourceByDocId(doc.id)}
                className="text-left p-4 rounded-xl border border-[#E3EAE7] bg-[#F7FAF9] hover:bg-white hover:border-[#3D8D7A]/50 transition-colors active:scale-[0.98]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-mono font-semibold text-[#7A8C86]">{doc.id} · {doc.date}</span>
                  {isScanning && (
                    <span
                      className="w-5 h-5 rounded-full bg-[#3D8D7A] text-white flex items-center justify-center"
                      style={{ animation: `logoNodePop 300ms cubic-bezier(0.23, 1, 0.32, 1) ${300 + idx * 250}ms both` }}
                    >
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p className="text-[14px] font-semibold text-[#12332B] mt-2 leading-snug">{doc.title}</p>
                <p className="text-[12px] text-[#7A8C86] mt-1">{doc.author}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {errorMsg && !isScanning && (
        <div className="p-6 rounded-2xl bg-[#FFF8F6] border border-[#C8553D]/40 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#C8553D] shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="font-semibold text-[#12332B] text-[15px]">The scan didn't finish — Retry</p>
              <p className="text-[12px] font-mono text-[#7A8C86] mt-1">{errorMsg}</p>
            </div>
          </div>
          <button
            onClick={runScan}
            className="px-4 py-2 bg-[#C8553D] hover:bg-[#b0452f] text-white text-[13px] font-semibold rounded-xl transition-colors active:scale-[0.97] flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {conflictScan && !isScanning && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-[15px] text-[#3F5A52]">
                <span className="font-semibold text-[#12332B]">
                  {activeConflicts.length} conflict{activeConflicts.length === 1 ? '' : 's'}
                </span>{' '}
                across {policies.length} policies
              </p>
              {conflictScan.servedFrom === 'memory' && (
                <span
                  title="Gemini is busy, so this verified result was served from Mnemo's memory."
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#3F5A52] bg-white border border-[#E3EAE7] px-2.5 py-1 rounded-full"
                >
                  <FileText className="w-3 h-3 text-[#3D8D7A]" strokeWidth={1.75} />
                  Verified memory
                </span>
              )}
            </div>
            <button
              onClick={runScan}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#7A8C86] hover:text-[#12332B] hover:bg-[#E3F0EC] rounded-lg transition-colors active:scale-[0.97]"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
              Scan again
            </button>
          </div>

          {conflictScan.conflicts.length === 0 ? (
            <div className="mnemo-card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#E3F0EC] text-[#3D8D7A] mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h3 className="font-serif text-[28px] font-normal text-[#12332B] mt-4">No conflicts found.</h3>
              <p className="text-[#7A8C86] text-[15px] mt-1">Your policies agree with each other.</p>
            </div>
          ) : (
            conflictScan.conflicts.map((conflict, idx) => renderConflict(conflict, idx))
          )}
        </div>
      )}
    </div>
  );
};
