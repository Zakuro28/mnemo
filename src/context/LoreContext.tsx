import React, { createContext, useContext, useState, useEffect } from 'react';
import { Decision, LoreDocument, StaleAnalysis } from '../types/lore';
import { INITIAL_DECISIONS, SEED_DOCUMENTS } from '../data/seedData';
import { clearAskCache } from '../services/askCache';

interface ToastMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description?: string;
}

export interface ActivityEvent {
  id: string;
  text: string;
  timestamp: string;
  type: 'stale' | 'check' | 'decision' | 'system';
}

const INITIAL_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act-1',
    text: 'Corporate memory index initialized (7 sources indexed)',
    timestamp: '2026-09-02',
    type: 'system'
  },
  {
    id: 'act-2',
    text: 'Carrier SLA audit recorded: Vendor B delivery time is 5 days',
    timestamp: '2026-07-30',
    type: 'system'
  },
  {
    id: 'act-3',
    text: 'Decision active: Use Vendor B as primary supplier',
    timestamp: '2024-03-12',
    type: 'decision'
  }
];

export type ViewType = 'overview' | 'ask' | 'decisions' | 'upload' | 'conflicts' | 'experts';

interface LoreContextType {
  decisions: Decision[];
  documents: LoreDocument[];
  uploadedFiles: string[];
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  selectedDoc: LoreDocument | null;
  setSelectedDoc: (doc: LoreDocument | null) => void;
  selectedDecisionId: string | null;
  setSelectedDecisionId: (id: string | null) => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  resetDemo: () => void;
  resetKey: number;
  registerAbortController: (controller: AbortController) => () => void;
  cancelRunningRequests: () => void;
  updateDecisionReviewStatus: (decisionId: string, status: 'marked_for_review' | 'dismissed') => void;
  applyAssumptionExpiry: (findings: any[], monthlyImpact: number, fileName: string) => void;
  isStaleHeroActive: boolean;
  setIsStaleHeroActive: (active: boolean) => void;
  heroStaleDecision: Decision | null;
  openSourceByDocId: (docId: string) => void;
  staleCount: number;
  watchCount: number;
  validCount: number;
  moneyAtRisk: number;
  activityFeed: ActivityEvent[];
}

const LoreContext = createContext<LoreContextType | undefined>(undefined);

const STORAGE_KEY = 'mnemo_brightwell_state_v2';

export const LoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [decisions, setDecisions] = useState<Decision[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_decisions`);
      return saved ? JSON.parse(saved) : INITIAL_DECISIONS;
    } catch {
      return INITIAL_DECISIONS;
    }
  });

  const [documents, setDocuments] = useState<LoreDocument[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_documents`);
      return saved ? JSON.parse(saved) : SEED_DOCUMENTS;
    } catch {
      return SEED_DOCUMENTS;
    }
  });

  const [uploadedFiles, setUploadedFiles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_files`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_activities`);
      return saved ? JSON.parse(saved) : INITIAL_ACTIVITIES;
    } catch {
      return INITIAL_ACTIVITIES;
    }
  });

  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [selectedDoc, setSelectedDoc] = useState<LoreDocument | null>(null);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isStaleHeroActive, setIsStaleHeroActive] = useState<boolean>(false);
  const [heroStaleDecision, setHeroStaleDecision] = useState<Decision | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);

  const activeControllersRef = React.useRef<Set<AbortController>>(new Set());

  const registerAbortController = (controller: AbortController) => {
    activeControllersRef.current.add(controller);
    return () => {
      activeControllersRef.current.delete(controller);
    };
  };

  const cancelRunningRequests = () => {
    activeControllersRef.current.forEach((controller) => {
      try {
        controller.abort();
      } catch (e) {
        // quiet abort
      }
    });
    activeControllersRef.current.clear();
  };

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_decisions`, JSON.stringify(decisions));
      localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(documents));
      localStorage.setItem(`${STORAGE_KEY}_files`, JSON.stringify(uploadedFiles));
      localStorage.setItem(`${STORAGE_KEY}_activities`, JSON.stringify(activityFeed));
    } catch (e) {
      console.warn('Failed to persist Mnemo state:', e);
    }
  }, [decisions, documents, uploadedFiles, activityFeed]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const resetDemo = () => {
    cancelRunningRequests();
    clearAskCache();
    setDecisions(INITIAL_DECISIONS);
    setDocuments(SEED_DOCUMENTS);
    setUploadedFiles([]);
    setActivityFeed(INITIAL_ACTIVITIES);
    setIsStaleHeroActive(false);
    setHeroStaleDecision(null);
    setSelectedDecisionId(null);
    setSelectedDoc(null);
    setActiveView('overview');
    setResetKey((prev) => prev + 1);

    try {
      localStorage.removeItem(`${STORAGE_KEY}_decisions`);
      localStorage.removeItem(`${STORAGE_KEY}_documents`);
      localStorage.removeItem(`${STORAGE_KEY}_files`);
      localStorage.removeItem(`${STORAGE_KEY}_activities`);
    } catch (e) {
      // quiet
    }

    // Scroll to top
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof document !== 'undefined') {
      const main = document.querySelector('main');
      if (main) {
        main.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    addToast({
      type: 'info',
      title: 'Demo reset — back to the starting state.'
    });
  };

  const openSourceByDocId = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      setSelectedDoc(doc);
    } else {
      addToast({
        type: 'warning',
        title: 'Document Not Found',
        description: `Reference ${docId} is not in current active index.`
      });
    }
  };

  const updateDecisionReviewStatus = (decisionId: string, status: 'marked_for_review' | 'dismissed') => {
    setDecisions((prev) =>
      prev.map((dec) => {
        if (dec.id === decisionId && dec.staleAnalysis) {
          return {
            ...dec,
            staleAnalysis: {
              ...dec.staleAnalysis,
              reviewStatus: status
            }
          };
        }
        return dec;
      })
    );

    // Add activity
    setActivityFeed((prev) => [
      {
        id: `act-${Date.now()}`,
        text: status === 'marked_for_review' 
          ? 'Decision "Use Vendor B" marked for executive review'
          : 'Decision "Use Vendor B" stale alert dismissed',
        timestamp: 'Just now',
        type: 'decision'
      },
      ...prev
    ]);

    addToast({
      type: status === 'marked_for_review' ? 'warning' : 'info',
      title: status === 'marked_for_review' ? 'Marked for Review' : 'Stale Alert Dismissed',
      description: status === 'marked_for_review' 
        ? 'Assigned to Procurement Lead Maria Tan for supplier re-bid.'
        : 'Acknowledged and dismissed by operator.'
    });
  };

  const applyAssumptionExpiry = (findings: any[], monthlyImpact: number, fileName: string) => {
    clearAskCache();
    if (!uploadedFiles.includes(fileName)) {
      setUploadedFiles((prev) => [...prev, fileName]);
    }

    let modified = false;
    let staleDec: Decision | null = null;

    setDecisions((prevDecisions) => {
      const next = prevDecisions.map((decision) => {
        let decisionHasContradiction = false;
        let contradictedAssumptionQuote = '';

        const updatedAssumptions = decision.assumptions.map((assumption) => {
          const finding = findings.find((f: any) => f.assumptionId === assumption.id);
          if (finding) {
            if (finding.verdict === 'contradicted') {
              decisionHasContradiction = true;
              contradictedAssumptionQuote = finding.evidenceQuote;
              return {
                ...assumption,
                status: 'Stale' as const,
                latestEvidence: finding.evidenceQuote,
                lastCheckedDate: '2026-09-28'
              };
            }
            if (finding.verdict === 'supported') {
              return {
                ...assumption,
                status: 'Valid' as const,
                latestEvidence: finding.evidenceQuote,
                lastCheckedDate: '2026-09-28'
              };
            }
          }
          return assumption;
        });

        if (decisionHasContradiction) {
          modified = true;
          const staleAnalysis: StaleAnalysis = {
            originalReason: 'Vendor B was selected because it was 20% cheaper than Vendor A ($10.00 vs $12.50/unit) with 2-day delivery SLA.',
            originalDate: '2024-03-12',
            originalSourceId: 'D2',
            newEvidence: contradictedAssumptionQuote || 'Vendor B invoice INV-2026-0912 dated 2026-09-28: 8,000 units at $13.40/unit (Total: $107,200.00).',
            newDate: '2026-09-28',
            newSourceTitle: 'Vendor B invoice INV-2026-0912',
            monthlyCost: monthlyImpact || 4800,
            confidence: 'High',
            suggestedAction: 'Review vendor choice',
            reviewStatus: 'pending'
          };

          const updatedDec: Decision = {
            ...decision,
            status: 'Stale' as const,
            assumptions: updatedAssumptions,
            staleAnalysis
          };
          staleDec = updatedDec;
          return updatedDec;
        }

        return decision;
      });

      return next;
    });

    if (modified && staleDec) {
      setHeroStaleDecision(staleDec);
      setIsStaleHeroActive(true);

      // Append live activity feed entries
      setActivityFeed((prev) => [
        {
          id: `act-${Date.now()}-1`,
          text: '1 decision went stale (Vendor B rate exceeded quote)',
          timestamp: 'Just now',
          type: 'stale'
        },
        {
          id: `act-${Date.now()}-2`,
          text: `Invoice ${fileName.replace('.pdf', '')} checked against memory`,
          timestamp: 'Just now',
          type: 'check'
        },
        ...prev
      ]);

      addToast({
        type: 'error',
        title: '1 decision went stale',
        description: 'Vendor B unit price ($13.40/unit) exceeds Vendor A quote ($12.80/unit).'
      });
    }
  };

  const staleCount = decisions.filter((d) => d.status === 'Stale').length;
  const watchCount = decisions.filter((d) => d.status === 'Watch').length;
  const validCount = decisions.filter((d) => d.status === 'Valid').length;

  const moneyAtRisk = decisions.reduce((acc, d) => {
    if (d.status === 'Stale' && d.staleAnalysis) {
      return acc + (d.staleAnalysis.monthlyCost || 0);
    }
    return acc;
  }, 0);

  return (
    <LoreContext.Provider
      value={{
        decisions,
        documents,
        uploadedFiles,
        activeView,
        setActiveView,
        selectedDoc,
        setSelectedDoc,
        selectedDecisionId,
        setSelectedDecisionId,
        toasts,
        addToast,
        removeToast,
        resetDemo,
        resetKey,
        registerAbortController,
        cancelRunningRequests,
        updateDecisionReviewStatus,
        applyAssumptionExpiry,
        isStaleHeroActive,
        setIsStaleHeroActive,
        heroStaleDecision,
        openSourceByDocId,
        staleCount,
        watchCount,
        validCount,
        moneyAtRisk,
        activityFeed
      }}
    >
      {children}
    </LoreContext.Provider>
  );
};

export const useLore = () => {
  const context = useContext(LoreContext);
  if (!context) {
    throw new Error('useLore must be used within a LoreProvider');
  }
  return context;
};
