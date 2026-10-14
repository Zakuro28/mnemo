import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useLore } from '../context/LoreContext';

interface TryDemoGuideProps {
  onRunStep1?: () => void;
  onRunStep2?: () => void;
  onRunStep3?: () => void;
}

export const TryDemoGuide: React.FC<TryDemoGuideProps> = ({ onRunStep1, onRunStep2, onRunStep3 }) => {
  const { setActiveView, staleCount, uploadedFiles } = useLore();

  const isStep2Complete = uploadedFiles.length > 0 || staleCount > 0;
  const isStep3Complete = staleCount > 0;

  return (
    <div className="mnemo-card p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-serif text-[24px] font-normal text-[#12332B]">
            Try the demo
          </h2>
          <p className="text-[14px] text-[#7A8C86] mt-0.5">
            Three steps to see how Mnemo catches an expired vendor decision.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1 */}
        <button
          onClick={() => {
            setActiveView('ask');
            if (onRunStep1) onRunStep1();
          }}
          className="text-left group p-4 rounded-xl border border-[#E3EAE7] hover:border-[#3D8D7A] bg-[#F7FAF9] hover:bg-white transition-all duration-150 active:scale-[0.97]"
        >
          <div className="flex items-center justify-between">
            <span className="w-6 h-6 rounded-full bg-[#3D8D7A] text-white font-bold text-[13px] flex items-center justify-center shadow-xs">
              1
            </span>
            <ArrowRight className="w-4 h-4 text-[#7A8C86] group-hover:text-[#3D8D7A] group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-[15px] font-semibold text-[#12332B] mt-3 group-hover:text-[#3D8D7A] transition-colors">
            Ask why we use Vendor B
          </p>
          <p className="text-[13px] text-[#3F5A52] mt-1 leading-snug">
            Reconstruct the original 2024 rationale and citations.
          </p>
        </button>

        {/* Step 2 */}
        <button
          onClick={() => {
            setActiveView('upload');
            if (onRunStep2) onRunStep2();
          }}
          className="text-left group p-4 rounded-xl border border-[#E3EAE7] hover:border-[#3D8D7A] bg-[#F7FAF9] hover:bg-white transition-all duration-150 active:scale-[0.97]"
        >
          <div className="flex items-center justify-between">
            {isStep2Complete ? (
              <span className="w-6 h-6 rounded-full bg-[#3D8D7A] text-white font-bold text-[13px] flex items-center justify-center shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            ) : (
              <span className="w-6 h-6 rounded-full bg-[#E3F0EC] text-[#2C6B5C] font-bold text-[13px] flex items-center justify-center">
                2
              </span>
            )}
            <ArrowRight className="w-4 h-4 text-[#7A8C86] group-hover:text-[#3D8D7A] group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-[15px] font-semibold text-[#12332B] mt-3 group-hover:text-[#3D8D7A] transition-colors">
            Upload the sample invoice
          </p>
          <p className="text-[13px] text-[#3F5A52] mt-1 leading-snug">
            Test recent 2026 invoice rates against active assumptions.
          </p>
        </button>

        {/* Step 3 */}
        <button
          onClick={() => {
            setActiveView('decisions');
            if (onRunStep3) onRunStep3();
          }}
          className={`text-left group p-4 rounded-xl border transition-all duration-150 active:scale-[0.97] ${
            isStep3Complete
              ? 'border-[#C8553D]/40 bg-[#FFF8F6]'
              : 'border-[#E3EAE7] hover:border-[#3D8D7A] bg-[#F7FAF9] hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            {isStep3Complete ? (
              <span className="w-6 h-6 rounded-full bg-[#C8553D] text-white font-bold text-[13px] flex items-center justify-center shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            ) : (
              <span className="w-6 h-6 rounded-full bg-[#E3F0EC] text-[#2C6B5C] font-bold text-[13px] flex items-center justify-center">
                3
              </span>
            )}
            <ArrowRight
              className={`w-4 h-4 transition-all group-hover:translate-x-0.5 ${
                isStep3Complete ? 'text-[#C8553D]' : 'text-[#7A8C86] group-hover:text-[#3D8D7A]'
              }`}
            />
          </div>
          <p className="text-[15px] font-semibold text-[#12332B] mt-3 group-hover:text-[#3D8D7A] transition-colors">
            {isStep3Complete ? 'Inspect stale decision' : 'See what went stale'}
          </p>
          <p className="text-[13px] text-[#3F5A52] mt-1 leading-snug">
            {isStep3Complete ? 'Side-by-side evidence and $4,800/mo cost penalty.' : 'Compare 2024 rationale with 2026 evidence.'}
          </p>
        </button>
      </div>
    </div>
  );
};
