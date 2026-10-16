import React, { useState } from 'react';
import { LoreProvider, useLore } from './context/LoreContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { AskLoreView } from './components/AskLoreView';
import { DecisionsView } from './components/DecisionsView';
import { UploadView } from './components/UploadView';
import { ConflictsView } from './components/ConflictsView';
import { ExpertsView } from './components/ExpertsView';
import { SourceSnippetModal } from './components/SourceSnippetModal';
import { ToastContainer } from './components/ToastContainer';

const MainContent: React.FC = () => {
  const { activeView, setActiveView, resetKey } = useLore();
  const [promptToRun, setPromptToRun] = useState<string>('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  React.useEffect(() => {
    setPromptToRun('');
  }, [resetKey]);

  // The phone menu closes whenever the page changes
  React.useEffect(() => {
    setIsMobileNavOpen(false);
  }, [activeView]);

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
      {/* Sidebar: fixed on desktop, slide-in drawer on phones */}
      <Sidebar mobileOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
        {/* Top Navigation Bar */}
        <Header onOpenMenu={() => setIsMobileNavOpen(true)} />

        {/* Scrollable workspace: roomy on desktop, tighter on phones */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Active View Router */}
            {activeView === 'overview' && (
              <OverviewView onAskQuery={handleAskQueryFromAnywhere} />
            )}
            {activeView === 'ask' && <AskLoreView initialQuery={promptToRun} />}
            {activeView === 'decisions' && <DecisionsView />}
            {activeView === 'upload' && <UploadView />}
            {activeView === 'conflicts' && <ConflictsView />}
            {activeView === 'experts' && <ExpertsView />}
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
