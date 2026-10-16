import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { DecisionStatus } from '../types/lore';
import { StaleEvidenceCard } from './StaleEvidenceCard';
import { CaptureDecisionModal } from './CaptureDecisionModal';

export const DecisionsView: React.FC = () => {
  const {
    decisions,
    selectedDecisionId,
    setSelectedDecisionId,
    openSourceByDocId,
    resetKey
  } = useLore();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const activeDecision = decisions.find((d) => d.id === selectedDecisionId) || null;

  useEffect(() => {
    setIsCaptureOpen(false);
  }, [resetKey]);

  // Bring the opened decision into view
  useEffect(() => {
    if (selectedDecisionId) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, [selectedDecisionId]);

  const renderStatusPill = (status: DecisionStatus) => {
    switch (status) {
      case 'Valid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#3D8D7A]/30 bg-[#3D8D7A]/12 text-[13px] font-medium text-[#3D8D7A]">
            <span className="w-2 h-2 rounded-full bg-[#3D8D7A]" />
            <span>Valid</span>
          </span>
        );
      case 'Watch':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#D99A1E]/30 bg-[#D99A1E]/12 text-[13px] font-semibold text-[#D99A1E]">
            <span className="w-2 h-2 rounded-full bg-[#D99A1E]" />
            <span>Watch</span>
          </span>
        );
      case 'Stale':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#C8553D]/30 bg-[#C8553D]/12 text-[13px] font-bold text-[#C8553D] pulse-ring-stale-terracotta">
            <span className="w-2 h-2 rounded-full bg-[#C8553D]" />
            <span>Stale</span>
          </span>
        );
    }
  };

  const getDotColor = (status: DecisionStatus) => {
    switch (status) {
      case 'Valid':
        return 'bg-[#3D8D7A]';
      case 'Watch':
        return 'bg-[#D99A1E]';
      case 'Stale':
        return 'bg-[#C8553D]';
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-page-enter">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[48px] md:text-[56px] font-normal tracking-tight text-[#12332B] leading-tight">
            Decisions
          </h1>
          <p className="text-[#3F5A52] text-[16px] leading-relaxed max-w-3xl mt-2">
            Track company decisions and their underlying assumptions. Stale choices are flagged when new evidence surfaces.
          </p>
        </div>
        <button
          onClick={() => setIsCaptureOpen(true)}
          className="btn-primary-teal inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-semibold shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" strokeWidth={2.25} />
          Capture a decision
        </button>
      </div>

      <CaptureDecisionModal
        open={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        onCaptured={(id) => {
          setIsCaptureOpen(false);
          setSelectedDecisionId(id);
        }}
      />

      {/* Grid of decision cards (2 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {decisions.map((decision) => {
          const isStale = decision.status === 'Stale';
          const isSelected = selectedDecisionId === decision.id;

          return (
            <div
              key={decision.id}
              onClick={() => setSelectedDecisionId(decision.id)}
              className={`mnemo-card p-6 cursor-pointer flex flex-col justify-between transition-all duration-200 select-none ${
                isStale
                  ? 'border-l-4 border-l-[#C8553D] bg-[#FFF8F6] stale-card-shimmer'
                  : isSelected
                  ? 'ring-2 ring-[#3D8D7A] border-transparent'
                  : ''
              }`}
            >
              <div className="relative z-10">
                {/* Header: Title + Status Pill */}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[20px] font-semibold text-[#12332B] leading-snug">
                    {decision.title}
                  </h3>
                  <div className="shrink-0">{renderStatusPill(decision.status)}</div>
                </div>

                {/* Date + Owner in muted */}
                <p className="text-[13px] text-[#7A8C86] mt-1.5 font-medium">
                  {decision.date} · {decision.lead}
                </p>

                <p className="text-[14px] text-[#3F5A52] mt-3 leading-relaxed line-clamp-2">
                  {decision.summary}
                </p>

                {/* Stale Quoted Evidence Line if Stale */}
                {isStale && decision.staleAnalysis && (
                  <div className="mt-4 p-3.5 rounded-xl bg-white/90 border border-[#C8553D]/30 text-[13px] shadow-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-[#C8553D] mb-1">
                      <AlertCircle className="w-4 h-4 text-[#C8553D] shrink-0" strokeWidth={1.75} />
                      <span>Contradicting Evidence</span>
                    </div>
                    <p className="text-[#3F5A52] italic line-clamp-2">
                      "{decision.staleAnalysis.newEvidence}"
                    </p>
                  </div>
                )}

                {/* Assumptions as small rows with coloured dots */}
                <div className="mt-5 pt-4 border-t border-[#E3EAE7] space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A8C86]">
                    Assumptions
                  </p>
                  {decision.assumptions.map((assump) => (
                    <div key={assump.id} className="flex items-center gap-2.5 text-[13px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getDotColor(assump.status)}`} />
                      <span className="text-[#3F5A52] truncate font-medium">{assump.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="relative z-10 mt-6 pt-4 border-t border-[#E3EAE7] flex items-center justify-between text-[13px] font-medium text-[#7A8C86]">
                <span>{decision.assumptions.length} tracked</span>
                <span className="flex items-center gap-1 text-[#3D8D7A] font-semibold group-hover:text-[#2C6B5C] transition-colors">
                  Inspect decision <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Decision Detail Drawer / Expanded Modal */}
      {activeDecision && (
        <div ref={detailRef} className="mnemo-card p-6 md:p-8 space-y-8 animate-in fade-in duration-200 scroll-mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EDE8C4] pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {renderStatusPill(activeDecision.status)}
                <span className="text-[13px] text-[#7A8C86]">
                  {activeDecision.date} · Lead: {activeDecision.lead}
                </span>
              </div>
              <h2 className="text-[22px] font-semibold text-[#12332B]">
                {activeDecision.title}
              </h2>
              <p className="text-[#3F5A52] text-[15px] mt-1.5 max-w-3xl leading-relaxed">
                {activeDecision.summary}
              </p>
            </div>

            <button
              onClick={() => setSelectedDecisionId(null)}
              className="self-start md:self-center px-4 py-2 text-[13px] font-medium text-[#7A8C86] hover:text-[#12332B] hover:bg-[#E3F0EC] rounded-xl transition-all"
            >
              Close
            </button>
          </div>

          {/* Stale evidence: original reason vs new evidence, built from what Gemini found */}
          {activeDecision.status === 'Stale' && activeDecision.staleAnalysis && (
            <StaleEvidenceCard decision={activeDecision} />
          )}

          {/* Assumptions */}
          <div className="space-y-3">
            <h3 className="text-[18px] font-semibold text-[#12332B]">
              Assumptions
            </h3>
            <div className="divide-y divide-[#E3EAE7] border border-[#E3EAE7] rounded-2xl overflow-hidden bg-white shadow-xs">
              {activeDecision.assumptions.map((assump) => (
                <div key={assump.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getDotColor(assump.status)}`} />
                      <p className="text-[15px] font-semibold text-[#12332B]">
                        {assump.text}
                      </p>
                    </div>
                    <p className="text-[13px] text-[#7A8C86]">
                      Original: {assump.originalReason}
                    </p>
                    <p className="text-[13px] text-[#3F5A52]">
                      Latest: {assump.latestEvidence}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {renderStatusPill(assump.status)}
                    <button
                      onClick={() => openSourceByDocId(assump.sourceDocId)}
                      className="p-1.5 text-[#7A8C86] hover:text-[#3D8D7A] rounded-md transition-colors"
                      title="View source"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reasons */}
          <div className="space-y-3">
            <h3 className="text-[18px] font-semibold text-[#12332B]">
              Reasons & Sources
            </h3>
            <div className="space-y-2">
              {activeDecision.reasons.map((r, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white border border-[#E3EAE7] flex items-center justify-between gap-3 text-[14px] shadow-xs"
                >
                  <div>
                    <p className="font-semibold text-[#12332B]">{r.text}</p>
                    <p className="text-[13px] text-[#7A8C86] italic mt-0.5">"{r.sourceSnippet}"</p>
                  </div>
                  <button
                    onClick={() => openSourceByDocId(r.sourceDocId)}
                    className="shrink-0 px-3 py-1 rounded-full bg-[#E3F0EC] border border-[#3D8D7A]/30 text-[12px] font-semibold text-[#2C6B5C] hover:bg-[#3D8D7A] hover:text-white transition-colors"
                  >
                    Doc {r.sourceDocId}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
