import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  GitBranch, 
  FileText, 
  AlertTriangle, 
  DollarSign,
  ChevronRight, 
  ShieldCheck,
  Activity,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { TryDemoGuide } from './TryDemoGuide';

interface OverviewViewProps {
  onAskQuery: (query: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onAskQuery }) => {
  const { 
    decisions, 
    documents, 
    staleCount, 
    watchCount,
    validCount,
    moneyAtRisk, 
    setActiveView, 
    setSelectedDecisionId,
    uploadedFiles,
    activityFeed,
    resetKey
  } = useLore();

  const [searchQuery, setSearchQuery] = useState('');
  const [btnOffset, setBtnOffset] = useState({ x: 0, y: 0 });
  const askBtnRef = useRef<HTMLButtonElement>(null);

  // Animated stat counters (count up once on mount or when stats change)
  const [counts, setCounts] = useState({
    decisions: 0,
    sources: 0,
    stale: 0,
    money: 0
  });

  useEffect(() => {
    setSearchQuery('');
    setCounts({
      decisions: decisions.length,
      sources: documents.length,
      stale: staleCount,
      money: moneyAtRisk
    });
  }, [resetKey]);

  useEffect(() => {
    const duration = 650;
    const steps = 25;
    const stepTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = Math.min(1, step / steps);
      const ease = 1 - Math.pow(1 - progress, 3);

      setCounts({
        decisions: Math.round(decisions.length * ease),
        sources: Math.round(documents.length * ease),
        stale: Math.round(staleCount * ease),
        money: Math.round(moneyAtRisk * ease)
      });

      if (step >= steps) {
        clearInterval(timer);
        setCounts({
          decisions: decisions.length,
          sources: documents.length,
          stale: staleCount,
          money: moneyAtRisk
        });
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [decisions.length, documents.length, staleCount, moneyAtRisk]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onAskQuery(searchQuery.trim());
  };

  // Magnetic button pull (max 6px, spring-like)
  const handleBtnMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!askBtnRef.current) return;
    const rect = askBtnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = (e.clientX - centerX) * 0.25;
    const rawY = (e.clientY - centerY) * 0.25;
    const clampedX = Math.max(-6, Math.min(6, rawX));
    const clampedY = Math.max(-6, Math.min(6, rawY));
    setBtnOffset({ x: clampedX, y: clampedY });
  };

  const handleBtnMouseLeave = () => {
    setBtnOffset({ x: 0, y: 0 });
  };


  const headlineWords = ["Your", "company", "never", "forgets"];

  return (
    <div className="space-y-10 pb-16 animate-page-enter">
      {/* Hero card in white (#FFFFFF) with 1px border #E3EAE7, soft shadow, plus subtle teal glow in top-right corner */}
      <section 
        className="bg-[#FFFFFF] border border-[#E3EAE7] rounded-3xl p-8 md:p-12 shadow-[0_8px_32px_rgba(18,51,43,0.05)] relative overflow-hidden"
        style={{
          background: 'radial-gradient(circle 420px at 100% 0%, rgba(61, 141, 122, 0.06) 0%, rgba(255, 255, 255, 0) 70%), #FFFFFF'
        }}
      >
        {/* Subtle decorative background ring */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-[#3D8D7A]/6 pointer-events-none blur-2xl" />

        <div className="max-w-3xl mx-auto text-center space-y-5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F7FAF9] border border-[#E3EAE7] text-[13px] text-[#2C6B5C] font-medium shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#3D8D7A]" />
            <span>Active corporate memory • Brightwell Logistics</span>
          </div>

          {/* Staggered Rising Headline + Underline on "why" */}
          <h1 className="font-serif text-[48px] md:text-[62px] font-normal tracking-tight text-[#12332B] leading-[1.08]">
            {headlineWords.map((word, i) => (
              <span
                key={word}
                className="inline-block mr-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {word}
              </span>
            ))}
            <span className="font-serif italic text-[#3D8D7A] draw-underline inline-block">
              why
            </span>
            <span className="text-[#12332B]">.</span>
          </h1>

          <p className="text-[#3F5A52] text-[17px] leading-relaxed max-w-2xl mx-auto">
            Mnemo turns archived communications, memos, and contracts into living decision memory that alerts you before outdated assumptions cost you money.
          </p>

          {/* Large "Ask Mnemo" search bar (white, teal focus ring) */}
          <form onSubmit={handleSearchSubmit} className="pt-2 max-w-2xl mx-auto">
            <div className="relative group">
              <div className="h-14 bg-white border border-[#E3EAE7] rounded-2xl flex items-center px-4 shadow-[0_4px_20px_rgba(18,51,43,0.06)] group-focus-within:border-[#3D8D7A] group-focus-within:ring-3 group-focus-within:ring-[#3D8D7A]/20 transition-all">
                <Sparkles className="w-5 h-5 text-[#3D8D7A] shrink-0 mr-3" strokeWidth={1.75} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask Mnemo: 'Why do we use Vendor B?' or propose a new idea..."
                  className="w-full bg-transparent text-[#12332B] placeholder-[#7A8C86] text-[15px] focus:outline-none"
                />
                <button
                  ref={askBtnRef}
                  type="submit"
                  onMouseMove={handleBtnMouseMove}
                  onMouseLeave={handleBtnMouseLeave}
                  style={{
                    transform: `translate(${btnOffset.x}px, ${btnOffset.y}px)`,
                    transition: btnOffset.x === 0 ? 'transform 200ms cubic-bezier(0.23,1,0.32,1)' : 'none'
                  }}
                  className="btn-primary-teal px-5 py-2.5 rounded-xl text-[14px] font-semibold shrink-0 ml-2 flex items-center gap-1.5 active:scale-[0.97]"
                >
                  <span>Ask</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap text-[13px]">
              <span className="text-[#7A8C86] font-medium">Try:</span>
              {[
                { label: 'Why Vendor B?', q: 'Why do we use Vendor B as primary supplier?' },
                { label: 'Switch to Vendor C?', q: 'Should we switch to Vendor C?' },
                { label: 'Monday ops sync', q: 'Why do we have weekly ops sync on Mondays?' }
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onAskQuery(chip.q)}
                  className="px-3 py-1 rounded-full bg-[#F7FAF9] hover:bg-white text-[#3F5A52] hover:text-[#12332B] border border-[#E3EAE7] transition-colors shadow-xs active:scale-[0.97]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* Bento Stats (4 cards, numbers count up) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Decisions tracked */}
        <div 
          onClick={() => setActiveView('decisions')}
          className="mnemo-card p-5 cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#7A8C86] mb-3">
            <span className="text-[13px] font-medium">Decisions tracked</span>
            <GitBranch className="w-5 h-5 text-[#3D8D7A] group-hover:scale-110 transition-transform" strokeWidth={1.75} />
          </div>
          <div className="text-[38px] font-semibold tracking-tight text-[#12332B] font-mono tabular-nums leading-none">
            {counts.decisions}
          </div>
          <div className="text-[12px] text-[#3F5A52] mt-2 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#3D8D7A]" />
            <span>{validCount} currently valid</span>
          </div>
        </div>

        {/* Card 2: Sources indexed */}
        <div className="mnemo-card p-5">
          <div className="flex items-center justify-between text-[#7A8C86] mb-3">
            <span className="text-[13px] font-medium">Sources indexed</span>
            <FileText className="w-5 h-5 text-[#3D8D7A]" strokeWidth={1.75} />
          </div>
          <div className="text-[38px] font-semibold tracking-tight text-[#12332B] font-mono tabular-nums leading-none">
            {counts.sources}
          </div>
          <div className="text-[12px] text-[#3F5A52] mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#3D8D7A]" strokeWidth={1.75} />
            <span>Emails, quotes, RFPs, SLAs</span>
          </div>
        </div>

        {/* Card 3: Stale alerts (terracotta #C8553D when > 0) */}
        <div 
          onClick={() => setActiveView('decisions')}
          className={`mnemo-card p-5 cursor-pointer group ${
            staleCount > 0 ? 'border-[#C8553D]/40 bg-[#FFF8F6]' : ''
          }`}
        >
          <div className="flex items-center justify-between text-[#7A8C86] mb-3">
            <span className="text-[13px] font-medium">Stale alerts</span>
            <AlertTriangle className={`w-5 h-5 ${staleCount > 0 ? 'text-[#C8553D] animate-pulse' : 'text-[#7A8C86]'}`} strokeWidth={1.75} />
          </div>
          <div className={`text-[38px] font-semibold tracking-tight font-mono tabular-nums leading-none ${
            staleCount > 0 ? 'text-[#C8553D]' : 'text-[#12332B]'
          }`}>
            {counts.stale}
          </div>
          <div className="text-[12px] mt-2 flex items-center gap-1.5">
            {staleCount > 0 ? (
              <span className="text-[#C8553D] font-semibold">Requires executive review</span>
            ) : watchCount > 0 ? (
              <span className="text-[#D99A1E] font-medium">{watchCount} on watch list</span>
            ) : (
              <span className="text-[#3D8D7A]">All assumptions verified</span>
            )}
          </div>
        </div>

        {/* Card 4: Money at risk / month ($0 -> $4,800 after the invoice) */}
        <div 
          onClick={() => setActiveView('decisions')}
          className={`mnemo-card p-5 cursor-pointer group ${
            moneyAtRisk > 0 ? 'border-[#C8553D]/40 bg-[#FFF8F6]' : ''
          }`}
        >
          <div className="flex items-center justify-between text-[#7A8C86] mb-3">
            <span className="text-[13px] font-medium">Money at risk / month</span>
            <DollarSign className={`w-5 h-5 ${moneyAtRisk > 0 ? 'text-[#C8553D]' : 'text-[#7A8C86]'}`} strokeWidth={1.75} />
          </div>
          <div className={`text-[38px] font-semibold tracking-tight font-mono tabular-nums leading-none ${
            moneyAtRisk > 0 ? 'text-[#C8553D]' : 'text-[#12332B]'
          }`}>
            ${counts.money.toLocaleString()}
          </div>
          <div className="text-[12px] mt-2">
            {moneyAtRisk > 0 ? (
              <span className="text-[#C8553D] font-semibold">($13.40 − $12.80) × 8k units</span>
            ) : (
              <span className="text-[#7A8C86]">$0 active cost discrepancy</span>
            )}
          </div>
        </div>
      </div>

      {/* "Try the demo": five steps through one story */}
      <TryDemoGuide
        onRunStep1={() => onAskQuery('Why do we use Vendor B as primary supplier?')}
        onRunStep3={() => setSelectedDecisionId('dec-vendor-b')}
      />

      {/* Two Column Row: Activity Feed Card + Recent Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity feed card: recent events, newest first */}
        <div className="mnemo-card p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E3EAE7]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E3F0EC] text-[#3D8D7A] flex items-center justify-center">
                  <Activity className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#12332B]">
                    Memory Activity Feed
                  </h3>
                  <p className="text-[12px] text-[#7A8C86]">
                    Real-time verification events & audits
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E3F0EC] text-[11px] font-semibold text-[#2C6B5C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3D8D7A] animate-pulse" />
                <span>Live Feed</span>
              </span>
            </div>

            {/* Event list, newest first */}
            <div className="divide-y divide-[#E3EAE7]/60 mt-1">
              {activityFeed.slice(0, 5).map((act, index) => {
                const isStale = act.type === 'stale';
                const isCheck = act.type === 'check';

                return (
                  <div 
                    key={act.id} 
                    className="py-3 flex items-start gap-3 animate-in fade-in duration-200"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isStale ? (
                        <div className="w-6 h-6 rounded-md bg-[#C8553D]/15 text-[#C8553D] flex items-center justify-center">
                          <AlertCircle className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                      ) : isCheck ? (
                        <div className="w-6 h-6 rounded-md bg-[#3D8D7A]/15 text-[#3D8D7A] flex items-center justify-center">
                          <FileCheck className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-[#2C6B5C]/15 text-[#2C6B5C] flex items-center justify-center">
                          <GitBranch className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-snug font-medium ${
                        isStale ? 'text-[#C8553D] font-semibold' : 'text-[#12332B]'
                      }`}>
                        {act.text}
                      </p>
                      <p className="text-[11px] text-[#7A8C86] mt-0.5">
                        {act.timestamp}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E3EAE7] flex items-center justify-between text-[12px] text-[#7A8C86]">
            <span>Watching Brightwell documentation</span>
            <span className="font-mono text-[11px] text-[#3D8D7A] font-semibold">Grounded Archive</span>
          </div>
        </div>

        {/* Quick view of "Recent decisions" */}
        <div className="mnemo-card p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E3EAE7]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E3F0EC] text-[#3D8D7A] flex items-center justify-center">
                  <GitBranch className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#12332B]">
                    Active Decisions
                  </h3>
                  <p className="text-[12px] text-[#7A8C86]">
                    {decisions.length} decisions currently monitored
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveView('decisions')}
                className="text-[12px] font-semibold text-[#3D8D7A] hover:text-[#2C6B5C] flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              {decisions.slice(0, 3).map((decision) => {
                const isStale = decision.status === 'Stale';
                const isWatch = decision.status === 'Watch';

                return (
                  <div
                    key={decision.id}
                    onClick={() => {
                      setActiveView('decisions');
                      setSelectedDecisionId(decision.id);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      isStale 
                        ? 'border-[#C8553D]/40 bg-[#FFF8F6]' 
                        : 'border-[#E3EAE7] bg-[#F7FAF9] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-[14px] text-[#12332B] truncate">
                        {decision.title}
                      </h4>
                      {isStale ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C8553D]/12 text-[#C8553D] border border-[#C8553D]/30 text-[11px] font-bold shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C8553D]" />
                          <span>Stale</span>
                        </span>
                      ) : isWatch ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D99A1E]/12 text-[#D99A1E] border border-[#D99A1E]/30 text-[11px] font-medium shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D99A1E]" />
                          <span>Watch</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3D8D7A]/12 text-[#3D8D7A] border border-[#3D8D7A]/30 text-[11px] font-medium shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3D8D7A]" />
                          <span>Valid</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#3F5A52] line-clamp-1 mt-1">
                      {decision.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E3EAE7] flex items-center justify-between text-[12px] text-[#7A8C86]">
            <span>Click any decision to inspect assumptions</span>
            <span className="text-[#3D8D7A] font-medium">Inspect →</span>
          </div>
        </div>
      </div>
    </div>
  );
};
