import React from 'react';
import { FileText, ShieldAlert, UserRound } from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { Decision } from '../types/lore';

interface StaleEvidenceCardProps {
  decision: Decision;
  // Optional animated value for the cost while the hero sequence counts up
  displayCost?: number;
}

const yearOf = (date?: string) => (date ? date.slice(0, 4) : '');

export const StaleEvidenceCard: React.FC<StaleEvidenceCardProps> = ({ decision, displayCost }) => {
  const { openSourceByDocId, updateDecisionReviewStatus, askExpert } = useLore();
  const stale = decision.staleAnalysis;
  if (!stale) return null;

  const cost = displayCost ?? stale.monthlyCost;
  const isVendorBDemo = stale.comparison === 'vendor-b-invoice';
  const showTwin = /maria/i.test(decision.lead);

  return (
    <div className="mnemo-card p-6 md:p-8 border-l-4 border-l-[#C8553D] bg-[#FFF8F6] space-y-6 shadow-[0_8px_32px_rgba(200,85,61,0.08)] stale-card-shimmer">
      {/* Header */}
      <div className="relative z-10 flex items-start justify-between gap-4 pb-4 border-b border-[#C8553D]/20 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#C8553D]/15 text-[#C8553D] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold text-[#12332B] leading-snug">
              Decision stale: {decision.title}
            </h3>
            {stale.assumptionText && (
              <p className="text-[13px] text-[#7A8C86] mt-0.5">
                Broken assumption: <span className="font-medium text-[#C8553D]">{stale.assumptionText}</span>
              </p>
            )}
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-white text-[#C8553D] border border-[#C8553D]/30 text-[13px] font-bold shadow-xs shrink-0">
          Confidence: {stale.confidence}
        </span>
      </div>

      {/* Original reason vs new evidence */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -ml-px w-px bg-[#E3EAE7]" />

        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="font-semibold text-[#7A8C86]">Original reason · {yearOf(stale.originalDate)}</span>
            <button
              onClick={() => openSourceByDocId(stale.originalSourceId)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E3EAE7] text-[12px] font-semibold text-[#3D8D7A] hover:bg-[#E3F0EC] transition-colors shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-[#3D8D7A]" strokeWidth={1.75} />
              <span>Doc {stale.originalSourceId}</span>
            </button>
          </div>
          <div className="bg-[#F7FAF9] p-4 rounded-xl text-[14px] text-[#3F5A52] leading-relaxed italic border border-[#E3EAE7]">
            "{stale.originalReason}"
          </div>
        </div>

        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="font-semibold text-[#C8553D]">New evidence · {yearOf(stale.newDate)}</span>
            {stale.newSourceDocId ? (
              <button
                onClick={() => openSourceByDocId(stale.newSourceDocId!)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#C8553D]/30 text-[12px] font-semibold text-[#C8553D] hover:bg-[#C8553D] hover:text-white transition-colors shadow-xs max-w-[60%]"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{stale.newSourceTitle}</span>
              </button>
            ) : (
              <span className="text-[12px] text-[#7A8C86] truncate max-w-[60%]">{stale.newSourceTitle}</span>
            )}
          </div>

          {isVendorBDemo ? (
            <div className="space-y-2.5">
              <div className="bg-white p-3.5 rounded-xl space-y-1 border border-[#E3EAE7] shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[13px] text-[#12332B]">Vendor B invoice INV-2026-0912</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F7FAF9] text-[11px] font-mono text-[#7A8C86] border border-[#E3EAE7]">2026-09-28</span>
                </div>
                <p className="text-[13px] text-[#3F5A52]">
                  8,000 units at <span className="font-bold text-[#C8553D]">$13.40 / unit</span> (total $107,200.00)
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl space-y-1 border border-[#E3EAE7] shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[13px] text-[#12332B]">Vendor A quote (Doc D5)</span>
                  <button
                    onClick={() => openSourceByDocId('D5')}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E3F0EC] text-[11px] font-semibold text-[#2C6B5C] border border-[#3D8D7A]/30 hover:bg-[#3D8D7A] hover:text-white transition-colors"
                  >
                    <FileText className="w-3 h-3" strokeWidth={1.75} />
                    <span>Doc D5 (2026-09-02)</span>
                  </button>
                </div>
                <p className="text-[13px] text-[#3F5A52]">
                  Quote from Vendor A: <span className="font-semibold text-[#3D8D7A]">$12.80/unit</span>, 3-day delivery
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-xl text-[14px] text-[#12332B] leading-relaxed border border-[#C8553D]/25 shadow-xs">
              "{stale.newEvidence}"
            </div>
          )}

          {stale.explanation && (
            <div className="p-2.5 rounded-lg bg-[#C8553D]/10 border border-[#C8553D]/20">
              <p className="text-[13px] font-semibold text-[#C8553D]">{stale.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cost and actions: AI suggests, people decide */}
      <div className="relative z-10 pt-6 border-t border-[#C8553D]/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          {stale.monthlyCost > 0 ? (
            <>
              <span className="text-[13px] text-[#7A8C86] block font-medium">Estimated cost of keeping this decision</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-serif text-[56px] md:text-[64px] text-[#C8553D] font-normal leading-none tabular-nums">
                  ${Math.round(cost).toLocaleString()}
                </span>
                <span className="font-sans text-[18px] text-[#3F5A52]">/ month</span>
              </div>
              {stale.costFormula && (
                <p className="text-[12px] text-[#7A8C86] mt-1 font-mono">{stale.costFormula}</p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-[#7A8C86] max-w-sm">
              No cost estimate: the documents don't contain enough figures to calculate one.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => updateDecisionReviewStatus(decision.id, 'marked_for_review')}
            className="btn-primary-teal px-5 py-2.5 text-white text-[14px] font-semibold rounded-xl"
          >
            {stale.reviewStatus === 'marked_for_review' ? '✓ Sent for review' : 'Review decision'}
          </button>
          {showTwin && (
            <button
              onClick={() => askExpert(`What should we do about ${decision.title.replace(/^use /i, '')} now?`)}
              className="btn-secondary-teal inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium rounded-xl"
            >
              <UserRound className="w-4 h-4" strokeWidth={1.75} />
              Ask Maria's twin
            </button>
          )}
          <button
            onClick={() => updateDecisionReviewStatus(decision.id, 'dismissed')}
            className="px-4 py-2.5 text-[14px] font-medium rounded-xl text-[#7A8C86] hover:text-[#12332B] hover:bg-white transition-colors active:scale-[0.97]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
