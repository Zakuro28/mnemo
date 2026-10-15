import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useLore, ViewType } from '../context/LoreContext';

interface TryDemoGuideProps {
  onRunStep1?: () => void;
  onRunStep2?: () => void;
  onRunStep3?: () => void;
}

export const TryDemoGuide: React.FC<TryDemoGuideProps> = ({ onRunStep1, onRunStep2, onRunStep3 }) => {
  const { setActiveView, staleCount, uploadedFiles, conflictScan, expertMessages } = useLore();

  const steps: Array<{
    view: ViewType;
    title: string;
    description: string;
    done: boolean;
    alert?: boolean;
    onRun?: () => void;
  }> = [
    {
      view: 'ask',
      title: 'Ask why we use Vendor B',
      description: 'The 2024 reasons, with sources.',
      done: false,
      onRun: onRunStep1
    },
    {
      view: 'upload',
      title: 'Upload the sample invoice',
      description: 'Check 2026 prices against old assumptions.',
      done: uploadedFiles.length > 0 || staleCount > 0,
      onRun: onRunStep2
    },
    {
      view: 'decisions',
      title: staleCount > 0 ? 'Inspect the stale decision' : 'See what went stale',
      description: staleCount > 0 ? 'Evidence side by side: $4,800/month.' : 'Compare 2024 reasons with 2026 evidence.',
      done: staleCount > 0,
      alert: staleCount > 0,
      onRun: onRunStep3
    },
    {
      view: 'conflicts',
      title: 'Scan policies for conflicts',
      description: 'HR and Finance disagree on approvals.',
      done: conflictScan !== null
    },
    {
      view: 'experts',
      title: "Ask Maria's twin",
      description: 'Her know-how, after she left.',
      done: expertMessages.some((m) => m.role === 'user')
    }
  ];

  return (
    <div className="mnemo-card p-6">
      <div className="relative z-10 mb-4">
        <h2 className="font-serif text-[24px] font-normal text-[#12332B]">Try the demo</h2>
        <p className="text-[14px] text-[#7A8C86] mt-0.5">
          Five steps through one story: a vendor decision that quietly expired.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((step, idx) => (
          <button
            key={step.view}
            onClick={() => {
              setActiveView(step.view);
              step.onRun?.();
            }}
            className={`flex flex-col justify-start text-left group p-4 rounded-xl border transition-colors duration-150 active:scale-[0.97] ${
              step.alert
                ? 'border-[#C8553D]/40 bg-[#FFF8F6]'
                : 'border-[#E3EAE7] hover:border-[#3D8D7A] bg-[#F7FAF9] hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              {step.done ? (
                <span
                  className={`w-6 h-6 rounded-full text-white flex items-center justify-center shadow-xs ${
                    step.alert ? 'bg-[#C8553D]' : 'bg-[#3D8D7A]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </span>
              ) : (
                <span
                  className={`w-6 h-6 rounded-full font-bold text-[13px] flex items-center justify-center ${
                    idx === 0 ? 'bg-[#3D8D7A] text-white shadow-xs' : 'bg-[#E3F0EC] text-[#2C6B5C]'
                  }`}
                >
                  {idx + 1}
                </span>
              )}
              <ArrowRight
                className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                  step.alert ? 'text-[#C8553D]' : 'text-[#7A8C86] group-hover:text-[#3D8D7A]'
                }`}
              />
            </div>
            <p className="text-[14px] font-semibold text-[#12332B] mt-3 leading-snug group-hover:text-[#3D8D7A] transition-colors">
              {step.title}
            </p>
            <p className="text-[13px] text-[#3F5A52] mt-1 leading-snug">{step.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
