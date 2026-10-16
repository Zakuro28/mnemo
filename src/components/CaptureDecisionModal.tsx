import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, ClipboardPaste, Eye, Quote, RefreshCw, Sparkles, X } from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { CAPTURE_EXAMPLE_TEXT } from '../data/seedData';
import { ExtractedDecision } from '../types/lore';

interface CaptureDecisionModalProps {
  open: boolean;
  onClose: () => void;
  onCaptured: (decisionId: string) => void;
}

const STEPS = ['Reading the text...', 'Finding the decision...', 'Pulling out reasons and assumptions...', 'Checking every quote against the text...'];

export const CaptureDecisionModal: React.FC<CaptureDecisionModalProps> = ({ open, onClose, onCaptured }) => {
  const { addCapturedDecision, registerAbortController } = useLore();
  const [text, setText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ExtractedDecision | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      controllerRef.current?.abort();
      setIsExtracting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!isExtracting) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [isExtracting]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const extract = async () => {
    const input = text.trim();
    if (input.length < 40) {
      setErrorMsg('Paste at least a few sentences that describe a decision.');
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const unregister = registerAbortController(controller);
    setIsExtracting(true);
    setStep(0);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch('/api/extract-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (controller.signal.aborted) return;
      setResult(data);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setErrorMsg(err?.message || 'Gemini could not read this text. Please retry.');
    } finally {
      unregister();
      if (!controller.signal.aborted) setIsExtracting(false);
    }
  };

  const save = () => {
    if (!result?.found) return;
    const decision = addCapturedDecision(result, text.trim());
    setText('');
    setResult(null);
    onCaptured(decision.id);
  };

  const reset = () => {
    setResult(null);
    setErrorMsg(null);
  };

  // Rendered on <body> so the page's entrance transform can't trap the fixed overlay
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12332B]/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="capture-title">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-[#E3EAE7]"
        style={{ animation: 'pageEnterFadeUp 220ms cubic-bezier(0.23, 1, 0.32, 1) both' }}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 md:px-8 pt-6 pb-4 border-b border-[#E3EAE7] flex items-start justify-between gap-4 z-10">
          <div>
            <h2 id="capture-title" className="font-serif text-[30px] font-normal text-[#12332B] leading-tight">Capture a decision</h2>
            <p className="text-[14px] text-[#7A8C86] mt-1">
              Paste any email, memo or meeting note. Gemini finds the decision and the assumptions it depends on, so Mnemo can watch them.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-[#7A8C86] hover:text-[#12332B] hover:bg-[#F7FAF9] transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 md:px-8 py-6 space-y-5">
          {!result?.found && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="capture-text" className="text-[13px] font-semibold text-[#12332B]">Text with a decision in it</label>
                  <button
                    type="button"
                    onClick={() => { setText(CAPTURE_EXAMPLE_TEXT); setErrorMsg(null); }}
                    disabled={isExtracting}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#3D8D7A] hover:text-[#2C6B5C] disabled:opacity-50"
                  >
                    <ClipboardPaste className="w-4 h-4" strokeWidth={1.75} />
                    Paste an example
                  </button>
                </div>
                <textarea
                  id="capture-text"
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={isExtracting}
                  rows={10}
                  placeholder={'e.g. "We decided to switch our courier to FastShip from March because they are 15% cheaper and deliver next day..."'}
                  className="w-full rounded-2xl border border-[#E3EAE7] bg-[#F7FAF9] focus:bg-white px-4 py-3 text-[14px] leading-relaxed text-[#12332B] placeholder:text-[#9AABA5] focus:outline-none focus:border-[#3D8D7A] focus:ring-3 focus:ring-[#3D8D7A]/20 transition-colors resize-y font-mono"
                />
                <p className="text-[12px] text-[#7A8C86]">Use only text you're allowed to share. Nothing is saved until you click Save.</p>
              </div>

              {result && !result.found && (
                <div className="p-4 rounded-2xl bg-[#F7FAF9] border border-dashed border-[#B9C9C3] text-[14px] text-[#3F5A52]">
                  <p className="font-semibold text-[#12332B]">No decision found</p>
                  <p className="mt-0.5">{result.message || 'Mnemo needs a decision with stated reasons to watch.'}</p>
                </div>
              )}

              {errorMsg && (
                <div className="p-4 rounded-2xl bg-[#FFF8F6] border border-[#C8553D]/40 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#C8553D] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <p className="text-[14px] text-[#12332B]">{errorMsg}</p>
                </div>
              )}

              {isExtracting && (
                <div className="p-4 rounded-2xl bg-[#F3F8F6] border border-[#3D8D7A]/25 space-y-2">
                  {STEPS.map((s, i) => (
                    <div key={s} className={`flex items-center gap-2.5 text-[13px] ${i < step ? 'text-[#2C6B5C]' : i === step ? 'text-[#12332B] font-semibold' : 'text-[#7A8C86]/60'}`}>
                      <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {i < step ? <Check className="w-3.5 h-3.5 text-[#3D8D7A]" strokeWidth={3} /> : i === step ? <span className="w-2 h-2 rounded-full bg-[#3D8D7A] animate-ping" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#7A8C86]/40" />}
                      </span>
                      {s}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[14px] font-medium text-[#7A8C86] hover:text-[#12332B] hover:bg-[#F7FAF9] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={extract}
                  disabled={isExtracting || !text.trim()}
                  className="btn-primary-teal inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isExtracting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isExtracting ? 'Capturing...' : 'Capture with Gemini'}
                </button>
              </div>
            </>
          )}

          {result?.found && (
            <div className="space-y-5" style={{ animation: 'pageEnterFadeUp 240ms cubic-bezier(0.23, 1, 0.32, 1) both' }}>
              <div className="p-5 rounded-2xl bg-[#F3F8F6] border border-[#3D8D7A]/30">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#2C6B5C]">Decision found</p>
                <h3 className="text-[20px] font-semibold text-[#12332B] mt-1 leading-snug">{result.title}</h3>
                <p className="text-[13px] text-[#7A8C86] mt-1">
                  {[result.date, result.lead].filter(Boolean).join(' · ') || 'Date and owner not stated'}
                </p>
                {result.summary && <p className="text-[14px] text-[#3F5A52] mt-2 leading-relaxed">{result.summary}</p>}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A8C86] flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                  Assumptions Mnemo will watch
                </p>
                {(result.assumptions || []).map((a, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-[#E3EAE7] bg-white" style={{ animation: `pageEnterFadeUp 220ms cubic-bezier(0.23, 1, 0.32, 1) ${80 + i * 70}ms both` }}>
                    <p className="text-[14px] font-semibold text-[#12332B] flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#3D8D7A] mt-1.5 shrink-0" />
                      {a.text}
                    </p>
                    <p className="text-[12.5px] text-[#7A8C86] italic mt-1 ml-4 flex items-start gap-1.5">
                      <Quote className="w-3 h-3 shrink-0 mt-0.5" strokeWidth={2} />
                      {a.quote}
                    </p>
                  </div>
                ))}
              </div>

              {(result.reasons || []).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A8C86]">Reasons</p>
                  <ul className="space-y-1 text-[14px] text-[#3F5A52] list-disc pl-5 marker:text-[#3D8D7A]">
                    {result.reasons!.map((r, i) => <li key={i}>{r.text}</li>)}
                  </ul>
                </div>
              )}

              {(result.options || []).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A8C86]">Options considered</p>
                  <div className="flex flex-wrap gap-2">
                    {result.options!.map((o, i) => (
                      <span key={i} title={o.reason} className={`px-3 py-1 rounded-full text-[13px] border ${o.accepted ? 'bg-[#3D8D7A]/12 border-[#3D8D7A]/30 text-[#2C6B5C] font-semibold' : 'bg-[#F7FAF9] border-[#E3EAE7] text-[#7A8C86] line-through decoration-[#C8553D]/50'}`}>
                        {o.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[12px] text-[#7A8C86]">
                Every quote above was checked word for word against your text. Anything Gemini couldn't quote was left out.
                {result.servedFrom === 'memory' && ' (Served from verified memory while Gemini is busy.)'}
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={reset} className="px-4 py-2.5 rounded-xl text-[14px] font-medium text-[#7A8C86] hover:text-[#12332B] hover:bg-[#F7FAF9] transition-colors">
                  Back
                </button>
                <button onClick={save} className="btn-primary-teal inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold">
                  <Check className="w-4 h-4" strokeWidth={2.25} />
                  Save to company memory
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
