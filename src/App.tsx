import React, { useState } from 'react';
import { LoreProvider, useLore } from './context/LoreContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { AskLoreView } from './components/AskLoreView';
import { DecisionsView } from './components/DecisionsView';
import { UploadView } from './components/UploadView';
import { SourceSnippetModal } from './components/SourceSnippetModal';
import { ToastContainer } from './components/ToastContainer';
import { Swords, UserRound } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeView, setActiveView, resetKey } = useLore();
  const [promptToRun, setPromptToRun] = useState<string>('');

  React.useEffect(() => {
    setPromptToRun('');
  }, [resetKey]);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const card = (e.target as HTMLElement)?.closest?.('.mnemo-card') as HTMLElement | null;
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--spotlight-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--spotlight-y', `${e.clientY - rect.top}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleAskQueryFromAnywhere = (query: string) => {
    setPromptToRun(query);
    setActiveView('ask');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7FAF9] font-sans text-[#3F5A52] antialiased relative">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
        {/* Top Navigation Bar */}
        <Header />

        {/* Scrollable Workspace with 48px page padding */}
        <main className="flex-1 overflow-y-auto px-12 py-12">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Active View Router */}
            {activeView === 'overview' && (
              <OverviewView onAskQuery={handleAskQueryFromAnywhere} />
            )}
            {activeView === 'ask' && <AskLoreView initialQuery={promptToRun} />}
            {activeView === 'decisions' && <DecisionsView />}
            {activeView === 'upload' && <UploadView />}

            {/* Conflicts: Coming Soon Preview */}
            {activeView === 'conflicts' && (
              <div className="mnemo-card p-12 text-center max-w-lg mx-auto mt-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#D99A1E]/15 border border-[#D99A1E]/30 text-[#D99A1E] mx-auto flex items-center justify-center">
                  <Swords className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E3F0EC] text-[#2C6B5C] border border-[#3D8D7A]/20">
                  Coming soon
                </span>
                <h2 className="text-[20px] font-semibold text-[#12332B]">
                  Policy Conflicts Engine
                </h2>
                <p className="text-[14px] text-[#7A8C86] leading-relaxed">
                  Automatically detects when distinct department policies or contracts make opposing assumptions across procurement, finance, and engineering.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveView('decisions')}
                    className="btn-primary-teal px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.97]"
                  >
                    Back to Decisions
                  </button>
                </div>
              </div>
            )}

            {/* Experts: Coming Soon Preview */}
            {activeView === 'experts' && (
              <div className="mnemo-card p-12 text-center max-w-lg mx-auto mt-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E3F0EC] border border-[#3D8D7A]/30 text-[#3D8D7A] mx-auto flex items-center justify-center">
                  <UserRound className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E3F0EC] text-[#2C6B5C] border border-[#3D8D7A]/20">
                  Coming soon
                </span>
                <h2 className="text-[20px] font-semibold text-[#12332B]">
                  Decision Experts Directory
                </h2>
                <p className="text-[14px] text-[#7A8C86] leading-relaxed">
                  Maps institutional expertise from historical meeting attendees, commit logs, and contract authors so teams know whom to consult before overturning past choices.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveView('decisions')}
                    className="btn-primary-teal px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.97]"
                  >
                    Back to Decisions
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <SourceSnippetModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <LoreProvider>
      <MainContent />
    </LoreProvider>
  );
}
