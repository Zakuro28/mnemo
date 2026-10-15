import React, { useState, useRef, useEffect } from 'react';
import { 
  FileUp, 
  FileSearch,
  FileText, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  AlertTriangle, 
  RefreshCw, 
  ShieldAlert,
  Sparkles,
  Check,
  UserRound
} from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { SAMPLE_INVOICE_DATA } from '../data/seedData';
import { AssumptionCheckFinding } from '../types/lore';

export const UploadView: React.FC = () => {
  const { 
    decisions, 
    uploadedFiles, 
    applyAssumptionExpiry, 
    openSourceByDocId,
    updateDecisionReviewStatus,
    addToast,
    resetKey,
    registerAbortController,
    askExpert
  } = useLore();

  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFile, setCurrentFile] = useState<{ name: string; content: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Icon stage: 'uploading' for 900ms, then swaps to 'searching'
  const [iconMode, setIconMode] = useState<'uploading' | 'searching'>('uploading');
  // Step-by-step progress index (0..3)
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [animationPhase, setAnimationPhase] = useState<number>(0);
  const [checkedAssumptionIds, setCheckedAssumptionIds] = useState<{ [id: string]: 'contradicted' | 'supported' | 'unrelated' }>({});
  const [displayCost, setDisplayCost] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [decisionChipStatus, setDecisionChipStatus] = useState<'Valid' | 'Watch' | 'Stale'>('Valid');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset page when demo is reset: no result card, drop zone empty
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentFile(null);
    setIsAnalyzing(false);
    setErrorMessage(null);
    setIsTimedOut(false);
    setAnimationPhase(0);
    setCheckedAssumptionIds({});
    setDisplayCost(0);
    setAnalysisResult(null);
    setDecisionChipStatus('Valid');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [resetKey]);

  const totalAssumptionsCount = decisions.flatMap((d) => d.assumptions).length || 4;

  const AUDIT_STEPS = [
    'Reading invoice...',
    'Extracting prices and dates...',
    `Checking ${totalAssumptionsCount} assumptions...`,
    'Comparing with past decisions...'
  ];

  // Drive step index and icon mode while analyzing
  useEffect(() => {
    if (!isAnalyzing) {
      setIconMode('uploading');
      setCurrentStepIndex(0);
      return;
    }

    // After 900ms, swap to FileSearch icon with scanning line
    const iconTimer = setTimeout(() => {
      setIconMode('searching');
    }, 900);

    // Increment audit steps every 1000ms
    const stepTimer = setInterval(() => {
      setCurrentStepIndex((prev) => Math.min(prev + 1, AUDIT_STEPS.length - 1));
    }, 1000);

    return () => {
      clearTimeout(iconTimer);
      clearInterval(stepTimer);
    };
  }, [isAnalyzing, AUDIT_STEPS.length]);

  // Animate count-up for cost
  useEffect(() => {
    if (animationPhase >= 4) {
      const targetCost = 4800;
      const duration = 800;
      const steps = 30;
      const stepDuration = duration / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayCost(Math.round(targetCost * eased));

        if (currentStep >= steps) {
          setDisplayCost(targetCost);
          clearInterval(timer);
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }
  }, [animationPhase]);

  const runHeroAnimation = (findings: AssumptionCheckFinding[], fileName: string, monthlyImpact: number) => {
    setAnimationPhase(1); // scanning line sweeps down on invoice
    setCheckedAssumptionIds({});
    setDecisionChipStatus('Valid');
    setDisplayCost(0);

    // Step 2: Assumption check rows fill in with staggered checks (450ms in)
    setTimeout(() => {
      setAnimationPhase(2);

      const allAssumptions = decisions.flatMap((d) => d.assumptions);
      allAssumptions.forEach((assump, idx) => {
        setTimeout(() => {
          const finding = findings.find((f) => f.assumptionId === assump.id);
          const verdict = finding ? finding.verdict : 'unrelated';
          setCheckedAssumptionIds((prev) => ({
            ...prev,
            [assump.id]: verdict
          }));
        }, idx * 120);
      });
    }, 450);

    // Step 3: Decision chip transitions to Stale with pulse ring (1100ms in)
    setTimeout(() => {
      setAnimationPhase(3);
      setDecisionChipStatus('Stale');
    }, 1100);

    // Step 4: Side-by-side card slides in & cost count-up plays (1500ms in)
    setTimeout(() => {
      setAnimationPhase(4);
      setIsAnalyzing(false);

      applyAssumptionExpiry(findings, monthlyImpact, fileName);
    }, 1500);
  };

  const handleProcessFile = async (name: string, content: string) => {
    setErrorMessage(null);
    setIsTimedOut(false);

    if (!content || !content.trim()) {
      setErrorMessage('The file appears to be empty or unreadable.');
      return;
    }

    if (uploadedFiles.includes(name)) {
      setErrorMessage(`Already checked: "${name}" has already been processed.`);
      addToast({
        type: 'warning',
        title: 'Already checked',
        description: `"${name}" was previously analyzed.`
      });
      return;
    }

    setCurrentFile({ name, content });
    setIsAnalyzing(true);
    setAnimationPhase(1); // Start showing the document card immediately

    // Send ONLY what the check needs: id, text, decisionTitle
    const activeAssumptions = decisions.flatMap((d) =>
      d.assumptions.map((a) => ({
        id: a.id,
        text: a.text,
        decisionTitle: d.title
      }))
    );

    // 20-second timeout
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const unregister = registerAbortController(controller);
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, 20000);

    try {
      const res = await fetch('/api/check-assumptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          content,
          fileName: name,
          activeAssumptions
        })
      });

      clearTimeout(timeoutTimer);

      if (!res.ok) {
        throw new Error('Analysis request failed');
      }

      const data = await res.json();
      setAnalysisResult(data);

      const hasContradiction = data.findings?.some((f: any) => f.verdict === 'contradicted');

      if (hasContradiction) {
        runHeroAnimation(data.findings, name, data.monthlyImpact || 4800);
      } else {
        setIsAnalyzing(false);
        setAnimationPhase(0);
        addToast({
          type: 'info',
          title: 'Audit Complete',
          description: 'No decisions affected. All assumptions still hold.'
        });
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      console.error('File check error:', err);
      setIsAnalyzing(false);
      setAnimationPhase(0);

      if (err.name === 'AbortError') {
        setIsTimedOut(true);
        setErrorMessage('This is taking longer than usual — Retry');
      } else {
        setErrorMessage('Something went wrong analyzing the document. Please retry.');
      }
    } finally {
      unregister();
    }
  };

  const handleUseSampleInvoice = () => {
    // Send plain text representation for maximum speed
    handleProcessFile(SAMPLE_INVOICE_DATA.fileName, SAMPLE_INVOICE_DATA.textRepresentation);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (isAnalyzing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessFile(file.name, text);
    };
    reader.onerror = () => {
      setErrorMessage('Could not read the uploaded file.');
    };
    reader.readAsText(file);
  };

  const vendorBDecision = decisions.find((d) => d.id === 'dec-vendor-b');
  const allAssumptions = decisions.flatMap((d) => d.assumptions);

  return (
    <div className="space-y-8 pb-16 animate-page-enter">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-[48px] md:text-[56px] font-normal tracking-tight text-[#12332B] leading-tight">
          Upload & Audit
        </h1>
        <p className="text-[#3F5A52] text-[16px] leading-relaxed max-w-3xl mt-2">
          Drop in recent invoices or rate cards. Mnemo automatically verifies new evidence against active company assumptions.
        </p>
      </div>

      {/* Large Drop Zone: #F3F8F6 background, dashed #3D8D7A at 40%; on drag-over #E3F0EC and border solid */}
      <div className="mnemo-card p-8 text-center flex flex-col items-center justify-center space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isAnalyzing) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => {
            if (!isAnalyzing) fileInputRef.current?.click();
          }}
          className={`w-full py-10 px-6 rounded-2xl transition-all select-none ${
            isAnalyzing
              ? 'border-2 border-solid border-[#3D8D7A]/60 bg-[#F3F8F6] cursor-wait'
              : isDragging
              ? 'border-2 border-solid border-[#3D8D7A] bg-[#E3F0EC] shadow-[0_0_24px_rgba(61,141,122,0.18)] cursor-pointer'
              : 'border-2 border-dashed border-[#3D8D7A]/40 hover:border-[#3D8D7A] bg-[#F3F8F6] hover:bg-[#E3F0EC]/50 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.csv,.json,image/*"
            className="hidden"
            disabled={isAnalyzing}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                readFile(e.target.files[0]);
              }
            }}
          />

          {/* Animated Icon Container */}
          <div className="relative mb-3 flex items-center justify-center">
            {isAnalyzing && (
              /* Thin teal progress ring rotating fast (800ms per turn) */
              <div 
                className="absolute -inset-2 rounded-2xl border-2 border-[#3D8D7A] border-t-transparent animate-fast-ring pointer-events-none" 
              />
            )}

            <div className="relative w-14 h-14 rounded-2xl bg-[#E3F0EC] border border-[#3D8D7A]/30 text-[#3D8D7A] flex items-center justify-center overflow-hidden">
              {isAnalyzing ? (
                iconMode === 'uploading' ? (
                  /* FileUp arrow moves up and fades in a loop (translateY 4px -> -4px, 900ms) */
                  <div className="animate-arrow-float-fade flex items-center justify-center">
                    <FileUp className="w-7 h-7" strokeWidth={1.75} />
                  </div>
                ) : (
                  /* Swaps to FileSearch with teal scanning line sweeping down over it (1.2s loop) */
                  <div className="relative flex items-center justify-center w-full h-full">
                    <FileSearch className="w-7 h-7 text-[#3D8D7A]" strokeWidth={1.75} />
                    <div className="absolute inset-x-1 top-0 h-1 rounded-full bg-[#3D8D7A] shadow-[0_0_8px_#3D8D7A] animate-scan-sweep-down pointer-events-none" />
                  </div>
                )
              ) : (
                <FileUp className="w-7 h-7" strokeWidth={1.75} />
              )}
            </div>
          </div>

          <h3 className="text-[18px] font-semibold text-[#12332B]">
            {isAnalyzing ? 'Auditing in progress...' : 'Drop a document here'}
          </h3>

          {!isAnalyzing ? (
            <p className="text-[13px] text-[#7A8C86] mt-1">
              Supports PDF, plain text, or image rate cards
            </p>
          ) : (
            /* Step-by-step status text changing every ~1s with small teal checks */
            <div className="mt-4 w-full max-w-sm mx-auto space-y-2 text-left bg-white/80 p-3.5 rounded-xl border border-[#E3EAE7] shadow-xs animate-in fade-in duration-200">
              {AUDIT_STEPS.map((stepText, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 text-[13px] transition-all duration-200 ${
                      isCompleted
                        ? 'text-[#2C6B5C] font-medium'
                        : isCurrent
                        ? 'text-[#12332B] font-semibold'
                        : 'text-[#7A8C86]/50'
                    }`}
                  >
                    <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5 text-[#3D8D7A] stroke-[3]" />
                      ) : isCurrent ? (
                        <span className="w-2 h-2 rounded-full bg-[#3D8D7A] animate-ping" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7A8C86]/40" />
                      )}
                    </span>
                    <span className="truncate">{stepText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Primary Action Button (no faded look while analyzing: full teal with 90% opacity) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={handleUseSampleInvoice}
            disabled={isAnalyzing}
            className={`btn-primary-teal px-6 py-2.5 font-semibold text-[14px] rounded-xl transition-all flex items-center gap-2 shadow-sm ${
              isAnalyzing 
                ? 'opacity-90 bg-[#3D8D7A] cursor-wait text-white' 
                : 'active:scale-[0.97] text-white hover:bg-[#2C6B5C]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" style={{ animationDuration: '650ms' }} />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Use sample invoice</span>
              </>
            )}
          </button>
          <span className="text-[13px] text-[#7A8C86]">
            Vendor B INV-2026-0912 ($13.40/unit)
          </span>
        </div>
      </div>

      {/* Friendly Timeout / Error Card: Never a frozen screen */}
      {errorMessage && (
        <div className="p-6 rounded-2xl bg-[#FFF8F6] border border-[#C8553D]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8553D]/15 text-[#C8553D] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#C8553D]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold text-[#12332B] text-[15px]">
                {isTimedOut ? 'This is taking longer than usual — Retry' : errorMessage}
              </p>
              <p className="text-[#7A8C86] text-[13px] mt-0.5">
                {isTimedOut
                  ? 'The audit exceeded the 20-second timeout without a response. You can retry immediately.'
                  : 'Please check the document and retry.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (currentFile) {
                handleProcessFile(currentFile.name, currentFile.content);
              } else {
                handleUseSampleInvoice();
              }
            }}
            className="px-4 py-2 bg-[#C8553D] hover:bg-[#b0452f] text-white text-[13px] font-semibold rounded-xl transition-all active:scale-[0.97] shrink-0 self-start sm:self-auto shadow-xs"
          >
            Retry Audit
          </button>
        </div>
      )}

      {/* Calm State if No Decisions Affected */}
      {analysisResult && analysisResult.status === 'no_effect' && !isAnalyzing && (
        <div className="mnemo-card p-10 text-center animate-in fade-in duration-200">
          <CheckCircle2 className="w-8 h-8 text-[#3D8D7A] mx-auto mb-3" />
          <h3 className="font-serif text-[28px] font-normal text-[#12332B]">
            No decisions affected. All assumptions still hold.
          </h3>
          <p className="text-[14px] text-[#7A8C86] mt-2 max-w-md mx-auto">
            The uploaded file "{analysisResult.fileName}" was verified against active corporate assumptions with no contradictions.
          </p>
        </div>
      )}

      {/* Document & Assumption Verification Area (Shown immediately while working so screen is NEVER empty) */}
      {(isAnalyzing || animationPhase > 0) && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Phase 1: Invoice Card with Glowing Teal Line Sweep */}
          <div className="relative overflow-hidden mnemo-card p-6">
            {/* The scanning line */}
            {(isAnalyzing || animationPhase === 1) && (
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#3D8D7A] to-transparent shadow-[0_0_12px_#3D8D7A] animate-scanner-line-teal pointer-events-none z-10" />
            )}

            <div className="flex items-start justify-between flex-wrap gap-2 pb-4 border-b border-[#E3EAE7]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E3F0EC] border border-[#3D8D7A]/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#3D8D7A]" strokeWidth={1.75} />
                </div>
                <div>
                  <h4 className="text-[16px] font-semibold text-[#12332B]">
                    {currentFile?.name || SAMPLE_INVOICE_DATA.fileName}
                  </h4>
                  <p className="text-[13px] text-[#7A8C86]">
                    Evaluating against corporate assumptions in memory...
                  </p>
                </div>
              </div>

              {/* Decision Chip Status Transition */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold transition-all duration-300 ${
                    decisionChipStatus === 'Stale'
                      ? 'bg-[#C8553D]/12 text-[#C8553D] border border-[#C8553D]/40 pulse-ring-stale-terracotta'
                      : 'bg-[#3D8D7A]/12 text-[#3D8D7A] border border-[#3D8D7A]/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      decisionChipStatus === 'Stale' ? 'bg-[#C8553D]' : 'bg-[#3D8D7A]'
                    }`}
                  />
                  <span>Use Vendor B as primary supplier: {decisionChipStatus}</span>
                </span>
              </div>
            </div>

            {/* Clean Mini-Invoice Card */}
            <div className="mt-4 p-4 bg-[#F7FAF9] border border-[#E3EAE7] rounded-xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-[13px] shadow-xs">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#7A8C86] block font-semibold">Vendor</span>
                <span className="font-semibold text-[#12332B] truncate block mt-0.5">Vendor B Logistics Ltd.</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#7A8C86] block font-semibold">Invoice No.</span>
                <span className="font-mono font-semibold text-[#12332B] block mt-0.5">INV-2026-0912</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#7A8C86] block font-semibold">Date</span>
                <span className="font-medium text-[#3F5A52] block mt-0.5">2026-09-28</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#7A8C86] block font-semibold">Units</span>
                <span className="font-medium text-[#3F5A52] block mt-0.5">8,000 units</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#7A8C86] block font-semibold">Unit Price</span>
                <span className="font-bold text-[#C8553D] px-2 py-0.5 bg-[#C8553D]/10 rounded-md border border-[#C8553D]/30 inline-block mt-0.5">
                  $13.40 / unit
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#7A8C86] block font-semibold">Total</span>
                <span className="font-semibold text-[#12332B] block mt-0.5">$107,200.00</span>
              </div>
            </div>
          </div>

          {/* Assumption Verification Rows (Skeleton shimmer while waiting, fills in upon results) */}
          <div className="mnemo-card p-6 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3EAE7]">
              <h4 className="text-[15px] font-semibold text-[#12332B]">
                Assumption Verification
              </h4>
              {isAnalyzing && (
                <span className="text-[12px] text-[#3D8D7A] font-medium flex items-center gap-1.5 animate-skeleton-pulse">
                  <span className="w-2 h-2 rounded-full bg-[#3D8D7A]" />
                  <span>Auditing against company memory...</span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              {allAssumptions.map((assump) => {
                const check = checkedAssumptionIds[assump.id];
                const isContradicted = check === 'contradicted';
                const isSupported = check === 'supported';
                const isUnrelated = check === 'unrelated';
                const isChecked = Boolean(check);

                return (
                  <div
                    key={assump.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all duration-200 ${
                      isContradicted
                        ? 'bg-[#FFF8F6] border-[#C8553D]/40'
                        : isChecked
                        ? 'bg-[#E3F0EC]/40 border-[#E3EAE7]'
                        : 'bg-[#F7FAF9] border-[#E3EAE7] animate-skeleton-pulse'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isContradicted ? (
                        <XCircle className="w-5 h-5 text-[#C8553D] shrink-0" strokeWidth={2} />
                      ) : isSupported ? (
                        <CheckCircle2 className="w-5 h-5 text-[#3D8D7A] shrink-0" strokeWidth={2} />
                      ) : isUnrelated ? (
                        <MinusCircle className="w-5 h-5 text-[#7A8C86] shrink-0" strokeWidth={2} />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-[#3D8D7A] border-t-transparent animate-spin shrink-0" />
                      )}
                      <span className={`text-[14px] truncate ${isContradicted ? 'font-semibold text-[#C8553D]' : 'text-[#12332B]'}`}>
                        {assump.text}
                      </span>
                    </div>

                    <span className="text-[12px] shrink-0">
                      {isContradicted ? (
                        <span className="font-bold text-[#C8553D]">Contradicted</span>
                      ) : isSupported ? (
                        <span className="font-semibold text-[#3D8D7A]">Supported</span>
                      ) : isUnrelated ? (
                        <span className="text-[#7A8C86]">Unrelated</span>
                      ) : (
                        <span className="text-[#3D8D7A] font-medium">Checking...</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phase 4: Stale Result Card with BOTH sources, comparison, and math */}
          {animationPhase >= 4 && vendorBDecision && (
            <div className="mnemo-card p-6 md:p-8 border-l-4 border-l-[#C8553D] bg-[#FFF8F6] space-y-6 shadow-[0_8px_32px_rgba(200,85,61,0.08)] stale-card-shimmer">
              {/* Header */}
              <div className="relative z-10 flex items-center justify-between pb-4 border-b border-[#C8553D]/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#C8553D]/15 text-[#C8553D] flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#12332B]">
                      Decision Stale: Use Vendor B as primary supplier
                    </h3>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-white text-[#C8553D] border border-[#C8553D]/30 text-[13px] font-bold shadow-xs">
                  Confidence: High
                </span>
              </div>

              {/* Two columns with vertical divider */}
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                {/* Vertical Divider in Desktop */}
                <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -ml-px w-px bg-[#E3EAE7]" />

                {/* Left Column: Original Reason */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-[#7A8C86]">
                      Original reason · 2024
                    </span>
                    <button
                      onClick={() => openSourceByDocId('D2')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E3EAE7] text-[12px] font-semibold text-[#3D8D7A] hover:bg-[#E3F0EC] transition-colors shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#3D8D7A]" strokeWidth={1.75} />
                      <span>Doc D2 (2024-03-12)</span>
                    </button>
                  </div>
                  <div className="bg-[#F7FAF9] p-4 rounded-xl text-[14px] text-[#3F5A52] leading-relaxed italic border border-[#E3EAE7]">
                    "Vendor selection meeting. Options: Vendor A ($12.50/unit, 4-day), Vendor B ($10.00/unit, 2-day), Vendor C (rejected, see D1). Decision: choose Vendor B. Reasons: 20% cheaper, 2-day delivery."
                  </div>
                </div>

                {/* Right Column: New Evidence showing BOTH sources */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-[#C8553D]">
                      New evidence · 2026
                    </span>
                    <span className="text-[12px] text-[#7A8C86]">2 verified sources</span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Source 1: Vendor B invoice */}
                    <div className="bg-white p-3.5 rounded-xl space-y-1 border border-[#E3EAE7] shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[13px] text-[#12332B]">Vendor B invoice INV-2026-0912</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F7FAF9] text-[11px] font-mono text-[#7A8C86] border border-[#E3EAE7]">
                          2026-09-28
                        </span>
                      </div>
                      <p className="text-[13px] text-[#3F5A52]">
                        8,000 units at <span className="font-bold text-[#C8553D]">$13.40 / unit</span> (total $107,200.00)
                      </p>
                    </div>

                    {/* Source 2: Vendor A quote D5 */}
                    <div className="bg-white p-3.5 rounded-xl space-y-1 border border-[#E3EAE7] shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[13px] text-[#12332B]">Vendor A quote (Doc D5)</span>
                        <button
                          onClick={() => openSourceByDocId('D5')}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E3F0EC] text-[11px] font-semibold text-[#2C6B5C] border border-[#3D8D7A]/30 hover:bg-[#3D8D7A] hover:text-white transition-colors"
                        >
                          <FileText className="w-3 h-3 text-[#3D8D7A]" strokeWidth={1.75} />
                          <span>Doc D5 (2026-09-02)</span>
                        </button>
                      </div>
                      <p className="text-[13px] text-[#3F5A52]">
                        Quote from Vendor A: <span className="font-semibold text-[#3D8D7A]">$12.80/unit</span>, 3-day delivery
                      </p>
                    </div>
                  </div>

                  {/* One-line comparison */}
                  <div className="p-2.5 rounded-lg bg-[#C8553D]/10 border border-[#C8553D]/20">
                    <p className="text-[13px] font-semibold text-[#C8553D]">
                      Vendor B is now $0.60/unit MORE expensive than Vendor A.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom: Cost in big Instrument Serif 64px terracotta + Math + Mark for review / Dismiss */}
              <div className="relative z-10 pt-6 border-t border-[#C8553D]/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="text-[13px] text-[#7A8C86] block font-medium">
                    Estimated cost of keeping this decision
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-serif text-[64px] text-[#C8553D] font-normal leading-none tabular-nums">
                      ${displayCost.toLocaleString()}
                    </span>
                    <span className="font-sans text-[18px] text-[#3F5A52]">/ month</span>
                  </div>
                  {/* Math in small muted text */}
                  <p className="text-[12px] text-[#7A8C86] mt-1 font-mono">
                    ($13.40 − $12.80) × 8,000 units/month
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateDecisionReviewStatus('dec-vendor-b', 'marked_for_review')}
                    className="btn-primary-teal px-5 py-2.5 text-white text-[14px] font-semibold rounded-xl transition-all active:scale-[0.97]"
                  >
                    Review vendor choice
                  </button>
                  <button
                    onClick={() => askExpert('What should we do about Vendor B now?')}
                    className="btn-secondary-teal inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium rounded-xl"
                  >
                    <UserRound className="w-4 h-4" strokeWidth={1.75} />
                    Ask Maria's twin
                  </button>
                  <button
                    onClick={() => updateDecisionReviewStatus('dec-vendor-b', 'dismissed')}
                    className="btn-secondary-teal px-4 py-2.5 text-[14px] font-medium rounded-xl transition-all active:scale-[0.97]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
