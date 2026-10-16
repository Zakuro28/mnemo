import React from 'react';
import { Menu, RotateCcw } from 'lucide-react';
import { useLore } from '../context/LoreContext';

interface HeaderProps {
  onOpenMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMenu }) => {
  const { resetDemo, activeView, staleCount, watchCount, validCount, setActiveView } = useLore();

  const getBreadcrumb = () => {
    switch (activeView) {
      case 'overview':
        return 'Overview';
      case 'ask':
        return 'Ask Mnemo';
      case 'decisions':
        return 'Decisions';
      case 'upload':
        return 'Upload & Audit';
      case 'conflicts':
        return 'Conflicts';
      case 'experts':
        return 'Experts';
      default:
        return 'Overview';
    }
  };

  return (
    <header className="h-16 border-b border-[#E3EAE7] bg-[#F7FAF9]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-3 sm:gap-8 shrink-0 z-20 sticky top-0">
      {/* Zone 1: Menu (phones) + Brand + Breadcrumb */}
      <div className="flex items-center gap-2.5 whitespace-nowrap min-w-0">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="md:hidden -ml-1 p-2 rounded-lg text-[#12332B] hover:bg-[#E3F0EC] active:scale-[0.97] transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <span className="hidden sm:inline font-sans text-[15px] font-semibold text-[#12332B]">
          Brightwell Logistics
        </span>
        <span className="hidden sm:inline text-[#7A8C86] text-[15px]">/</span>
        <span className="font-sans text-[15px] text-[#7A8C86] font-normal">
          {getBreadcrumb()}
        </span>
      </div>

      {/* Zone 2 & 3: Status pills + Reset Demo as quiet ghost button */}
      <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap shrink-0">
        <div className="flex items-center gap-2">
          {/* Valid Status: #3D8D7A (12% tint) */}
          <button
            onClick={() => setActiveView('decisions')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#3D8D7A]/30 bg-[#3D8D7A]/12 text-[13px] text-[#3D8D7A] hover:bg-[#3D8D7A]/20 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#3D8D7A]" />
            <span className="font-medium">{validCount} Valid</span>
          </button>

          {/* Watch Status: #D99A1E (12% tint) */}
          {watchCount > 0 && (
            <button
              onClick={() => setActiveView('decisions')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#D99A1E]/30 bg-[#D99A1E]/12 text-[13px] text-[#D99A1E] hover:bg-[#D99A1E]/20 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#D99A1E]" />
              <span className="font-semibold">{watchCount} Watch</span>
            </button>
          )}

          {/* Stale Status: #C8553D (12% tint) + pulse ring */}
          {staleCount > 0 && (
            <button
              onClick={() => setActiveView('decisions')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#C8553D]/30 bg-[#C8553D]/12 text-[13px] text-[#C8553D] hover:bg-[#C8553D]/20 transition-colors pulse-ring-stale-terracotta"
            >
              <span className="w-2 h-2 rounded-full bg-[#C8553D]" />
              <span className="font-bold">{staleCount} Stale</span>
            </button>
          )}
        </div>

        {/* Quiet Ghost Button */}
        <button
          onClick={resetDemo}
          title="Restore original seed documents and decisions"
          className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#7A8C86] hover:text-[#12332B] hover:bg-[#E3F0EC] rounded-lg active:scale-[0.97] transition-all"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">Reset Demo</span>
        </button>
      </div>
    </header>
  );
};
