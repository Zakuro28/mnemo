import React from 'react';
import { 
  GitBranch, 
  AlertCircle, 
  AlertTriangle, 
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { DecisionStatus } from '../types/lore';

export const DecisionsView: React.FC = () => {
  const { 
    decisions, 
    selectedDecisionId, 
    setSelectedDecisionId, 
    openSourceByDocId,
    updateDecisionReviewStatus
  } = useLore();

  const activeDecision = decisions.find((d) => d.id === selectedDecisionId) || null;

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
      <div>
        <h1 className="font-serif text-[48px] md:text-[56px] font-normal tracking-tight text-[#12332B] leading-tight">
          Decisions
        </h1>
        <p className="text-[#3F5A52] text-[16px] leading-relaxed max-w-3xl mt-2">
          Track company decisions and their underlying assumptions. Stale choices are flagged when new evidence surfaces.
        </p>
      </div>

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
        <div className="mnemo-card p-6 md:p-8 space-y-8 animate-in fade-in duration-200">
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

          {/* Stale Side-by-Side Card if Stale */}
          {activeDecision.status === 'Stale' && activeDecision.staleAnalysis && (
            <div className="rounded-2xl border-l-4 border-l-[#C8553D] border border-[#C8553D]/30 bg-[#FFF8F6] p-6 space-y-6 shadow-[0_8px_32px_rgba(200,85,61,0.08)] stale-card-shimmer">
              <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-[#C8553D]/20">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#C8553D]" strokeWidth={1.75} />
                  <span className="text-[15px] font-semibold text-[#12332B]">
                    Assumption Contradicted · Decision Stale
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-white text-[#C8553D] border border-[#C8553D]/30 shadow-xs">
                    Confidence: {activeDecision.staleAnalysis.confidence}
                  </span>
                </div>
              </div>

              {/* Side-by-Side: Original Reason vs New Evidence */}
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT: Original Reason */}
                <div className="p-5 rounded-xl bg-white border border-[#E3EAE7] space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-[#7A8C86]">
                      Original reason · 2024
                    </span>
                    <button
                      onClick={() => openSourceByDocId(activeDecision.staleAnalysis!.originalSourceId)}
                      className="text-[#3D8D7A] hover:underline flex items-center gap-1 font-semibold text-[12px]"
                    >
                      Source {activeDecision.staleAnalysis.originalSourceId} <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="bg-[#F7FAF9] p-3.5 rounded-xl text-[14px] text-[#3F5A52] italic border border-[#E3EAE7]">
                    "{activeDecision.staleAnalysis.originalReason}"
                  </div>
                </div>

                {/* RIGHT: New Evidence showing BOTH sources + math */}
                <div className="p-5 rounded-xl bg-white border border-[#C8553D]/30 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-[#C8553D]">
                      New evidence · 2026
                    </span>
                    <span className="text-[#7A8C86] text-[12px]">2 verified sources</span>
                  </div>

                  <div className="space-y-2">
                    {/* Source 1: Vendor B invoice */}
                    <div className="bg-[#F7FAF9] p-3 rounded-xl space-y-1 border border-[#E3EAE7]">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-[#12332B]">Vendor B invoice INV-2026-0912</span>
                        <span className="px-2 py-0.5 rounded-full bg-white text-[11px] font-mono text-[#7A8C86] border border-[#E3EAE7]">
                          2026-09-28
                        </span>
                      </div>
                      <p className="text-[13px] text-[#3F5A52]">
                        8,000 units at <span className="font-bold text-[#C8553D]">$13.40 / unit</span> (total $107,200.00)
                      </p>
                    </div>

                    {/* Source 2: Vendor A quote D5 */}
                    <div className="bg-[#F7FAF9] p-3 rounded-xl space-y-1 border border-[#E3EAE7]">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-[#12332B]">Vendor A quote (Doc D5)</span>
                        <button
                          onClick={() => openSourceByDocId('D5')}
                          className="px-2 py-0.5 rounded-full bg-[#E3F0EC] text-[11px] font-semibold text-[#2C6B5C] border border-[#3D8D7A]/30 hover:bg-[#3D8D7A] hover:text-white transition-colors"
                        >
                          Doc D5 (2026-09-02)
                        </button>
                      </div>
                      <p className="text-[13px] text-[#3F5A52]">
                        Quote from Vendor A: <span className="font-semibold text-[#3D8D7A]">$12.80/unit</span>, 3-day delivery
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#C8553D]/10 border border-[#C8553D]/20">
                    <p className="text-[13px] font-semibold text-[#C8553D]">
                      Vendor B is now $0.60/unit MORE expensive than Vendor A.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost & Suggested Action: "$4,800 / month" in Instrument Serif 64px terracotta */}
              <div className="relative z-10 pt-4 border-t border-[#C8553D]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[13px] text-[#7A8C86] block font-medium">
                    Estimated cost of keeping this decision
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-serif text-[64px] text-[#C8553D] font-normal leading-none inline-block tabular-nums">
                      ${activeDecision.staleAnalysis.monthlyCost.toLocaleString()}
                    </span>
                    <span className="text-[18px] font-sans text-[#3F5A52]">/ month</span>
                  </div>
                  <p className="text-[12px] text-[#7A8C86] mt-1 font-mono">
                    ($13.40 − $12.80) × 8,000 units/month
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateDecisionReviewStatus(activeDecision.id, 'marked_for_review')}
                    className="btn-primary-teal px-5 py-2.5 text-white text-[14px] font-semibold rounded-xl transition-all active:scale-[0.97]"
                  >
                    {activeDecision.staleAnalysis.reviewStatus === 'marked_for_review'
                      ? '✓ Marked for review'
                      : 'Review vendor choice'}
                  </button>
                  <button
                    onClick={() => updateDecisionReviewStatus(activeDecision.id, 'dismissed')}
                    className="btn-secondary-teal px-4 py-2.5 text-[14px] font-medium rounded-xl transition-all active:scale-[0.97]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
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
