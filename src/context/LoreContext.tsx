import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Assumption,
  AssumptionCheckFinding,
  CheckAssumptionsResponse,
  ConflictAction,
  ConflictScanResult,
  Decision,
  ExpertMessage,
  ExtractedDecision,
  LoreDocument,
  StaleAnalysis
} from '../types/lore';
import { INITIAL_DECISIONS, SAMPLE_INVOICE_DATA, SEED_DOCUMENTS } from '../data/seedData';
import { clearAskCache } from '../services/askCache';
import { logWorkspaceEvent } from '../services/workspace';

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
    text: 'Corporate memory index initialized (11 sources indexed)',
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
  applyAssumptionExpiry: (result: CheckAssumptionsResponse, uploadedText: string) => void;
  addCapturedDecision: (extracted: ExtractedDecision, sourceText: string) => Decision;
  isStaleHeroActive: boolean;
  setIsStaleHeroActive: (active: boolean) => void;
  heroStaleDecision: Decision | null;
  openSourceByDocId: (docId: string) => void;
  staleCount: number;
  watchCount: number;
  validCount: number;
  moneyAtRisk: number;
  activityFeed: ActivityEvent[];
  conflictScan: ConflictScanResult | null;
  setConflictScan: (scan: ConflictScanResult | null) => void;
  conflictActions: Record<string, ConflictAction>;
  setConflictAction: (conflictId: string, action: ConflictAction | null) => void;
  expertMessages: ExpertMessage[];
  setExpertMessages: React.Dispatch<React.SetStateAction<ExpertMessage[]>>;
  pendingExpertQuestion: string;
  askExpert: (question: string) => void;
  clearPendingExpertQuestion: () => void;
}

const LoreContext = createContext<LoreContextType | undefined>(undefined);

const STORAGE_KEY = 'mnemo_brightwell_state_v4';

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
  const [conflictScan, setConflictScan] = useState<ConflictScanResult | null>(null);
  const [conflictActions, setConflictActions] = useState<Record<string, ConflictAction>>({});
  const [expertMessages, setExpertMessages] = useState<ExpertMessage[]>([]);
  const [pendingExpertQuestion, setPendingExpertQuestion] = useState<string>('');

  const setConflictAction = (conflictId: string, action: ConflictAction | null) => {
    setConflictActions((prev) => {
      const next = { ...prev };
      if (action) {
        next[conflictId] = action;
      } else {
        delete next[conflictId];
      }
      return next;
    });
  };

  const askExpert = (question: string) => {
    setPendingExpertQuestion(question);
    setActiveView('experts');
  };

  const clearPendingExpertQuestion = () => setPendingExpertQuestion('');

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
    void logWorkspaceEvent('demo_reset', {});
    setDecisions(INITIAL_DECISIONS);
    setDocuments(SEED_DOCUMENTS);
    setUploadedFiles([]);
    setActivityFeed(INITIAL_ACTIVITIES);
    setIsStaleHeroActive(false);
    setHeroStaleDecision(null);
    setSelectedDecisionId(null);
    setSelectedDoc(null);
    setConflictScan(null);
    setConflictActions({});
    setExpertMessages([]);
    setPendingExpertQuestion('');
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
    const decision = decisions.find((d) => d.id === decisionId);
    const title = decision?.title || 'Decision';
    void logWorkspaceEvent('review_requested', { decisionId, title, status });

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

    setActivityFeed((prev) => [
      {
        id: `act-${Date.now()}`,
        text: status === 'marked_for_review'
          ? `"${title}" marked for review`
          : `Stale alert dismissed for "${title}"`,
        timestamp: 'Just now',
        type: 'decision'
      },
      ...prev
    ]);

    addToast({
      type: status === 'marked_for_review' ? 'warning' : 'info',
      title: status === 'marked_for_review' ? 'Marked for review' : 'Stale alert dismissed',
      description: status === 'marked_for_review'
        ? `"${title}" was sent to its owners for review.`
        : 'Dismissed. You can still find the evidence on the Decisions page.'
    });
  };

  const today = () => new Date().toISOString().slice(0, 10);

  const applyAssumptionExpiry = (result: CheckAssumptionsResponse, uploadedText: string) => {
    clearAskCache();
    const fileName = result.fileName;
    const checkedOn = today();

    if (!uploadedFiles.includes(fileName)) {
      setUploadedFiles((prev) => [...prev, fileName]);
    }

    // Keep the uploaded document in company memory so Ask Mnemo can cite it
    let newDocId: string | undefined;
    const docContent = uploadedText.trim() ? uploadedText : (result.documentText || result.documentSummary || '');
    if (docContent && !documents.some((d) => d.title === fileName)) {
      newDocId = `U${documents.filter((d) => d.id.startsWith('U')).length + 1}`;
      const doc: LoreDocument = {
        id: newDocId,
        title: fileName,
        date: checkedOn,
        author: 'Uploaded document',
        type: /invoice/i.test(fileName) ? 'invoice' : 'report',
        content: docContent,
        snippet: result.documentSummary || docContent.slice(0, 160)
      };
      setDocuments((prev) => [...prev, doc]);
    }

    const findings = result.findings || [];
    const isDemoInvoice = fileName === SAMPLE_INVOICE_DATA.fileName;
    let costAssigned = false;
    const staleDecisions: Decision[] = [];

    const next = decisions.map((decision) => {
      let firstContradiction: { assumption: Assumption; finding: AssumptionCheckFinding } | null = null;

      const updatedAssumptions = decision.assumptions.map((assumption) => {
        const finding = findings.find((f) => f.assumptionId === assumption.id);
        if (!finding || finding.verdict === 'unrelated') return assumption;
        const evidence = finding.evidenceQuote ? `${fileName}: "${finding.evidenceQuote}"` : finding.explanation;
        if (finding.verdict === 'contradicted') {
          if (!firstContradiction) firstContradiction = { assumption, finding };
          return { ...assumption, status: 'Stale' as const, latestEvidence: evidence, lastCheckedDate: checkedOn };
        }
        return { ...assumption, status: 'Valid' as const, latestEvidence: evidence, lastCheckedDate: checkedOn };
      });

      if (!firstContradiction) {
        return { ...decision, assumptions: updatedAssumptions };
      }

      const { assumption, finding } = firstContradiction as { assumption: Assumption; finding: AssumptionCheckFinding };
      // The monthly cost belongs to one decision so totals are never double counted
      const monthlyCost = !costAssigned ? Math.max(0, result.monthlyImpact || 0) : 0;
      if (monthlyCost > 0) costAssigned = true;

      const staleAnalysis: StaleAnalysis = {
        originalReason: assumption.originalReason,
        originalDate: decision.date,
        originalSourceId: assumption.sourceDocId,
        newEvidence: finding.evidenceQuote || finding.explanation,
        newDate: checkedOn,
        newSourceTitle: fileName,
        newSourceDocId: newDocId,
        monthlyCost,
        confidence: finding.confidence,
        suggestedAction: 'Review this decision',
        reviewStatus: 'pending',
        assumptionText: assumption.text,
        explanation: finding.explanation,
        costFormula: monthlyCost > 0 ? result.costFormula : undefined,
        comparison: isDemoInvoice && decision.id === 'dec-vendor-b' ? 'vendor-b-invoice' : undefined
      };

      const updated: Decision = {
        ...decision,
        status: 'Stale' as const,
        assumptions: updatedAssumptions,
        staleAnalysis
      };
      staleDecisions.push(updated);
      return updated;
    });

    setDecisions(next);
    void logWorkspaceEvent('document_audited', {
      fileName,
      status: result.status,
      monthlyImpact: result.monthlyImpact,
      findings,
      staleDecisions: staleDecisions.map((d) => d.title)
    });

    const staleTotal = staleDecisions.length;
    setActivityFeed((prev) => [
      ...(staleTotal > 0
        ? [{
            id: `act-${Date.now()}-1`,
            text: `${staleTotal} decision${staleTotal > 1 ? 's' : ''} went stale: ${staleDecisions.map((d) => d.title).join(', ')}`,
            timestamp: 'Just now',
            type: 'stale' as const
          }]
        : []),
      {
        id: `act-${Date.now()}-2`,
        text: `${fileName} checked against company memory`,
        timestamp: 'Just now',
        type: 'check' as const
      },
      ...prev
    ]);

    if (staleTotal > 0) {
      setHeroStaleDecision(staleDecisions[0]);
      setIsStaleHeroActive(true);
      addToast({
        type: 'error',
        title: `${staleTotal} decision${staleTotal > 1 ? 's' : ''} went stale`,
        description: staleDecisions[0].staleAnalysis?.explanation || staleDecisions[0].title
      });
    }
  };

  const addCapturedDecision = (extracted: ExtractedDecision, sourceText: string): Decision => {
    clearAskCache();
    const capturedOn = today();
    const docId = `C${documents.filter((d) => d.id.startsWith('C')).length + 1}`;
    const decisionId = `dec-captured-${Date.now()}`;
    const title = extracted.title || 'Captured decision';
    const date = extracted.date || capturedOn;

    const doc: LoreDocument = {
      id: docId,
      title: `Captured note: ${title}`,
      date,
      author: extracted.lead || 'Captured note',
      type: 'memo',
      content: sourceText,
      snippet: extracted.summary || sourceText.slice(0, 160)
    };

    const decision: Decision = {
      id: decisionId,
      title,
      date,
      lead: extracted.lead || 'Not stated',
      summary: extracted.summary || '',
      status: 'Valid',
      reasons: (extracted.reasons || []).map((r) => ({ text: r.text, sourceDocId: docId, sourceSnippet: r.quote })),
      assumptions: (extracted.assumptions || []).map((a, i) => ({
        id: `${decisionId}-a${i + 1}`,
        decisionId,
        text: a.text,
        status: 'Valid' as const,
        sourceDocId: docId,
        originalReason: a.quote,
        latestEvidence: 'No contradicting evidence since it was captured.',
        lastCheckedDate: capturedOn
      })),
      options: (extracted.options || []).map((o) => ({
        name: o.name,
        accepted: o.accepted,
        details: o.reason,
        rejectionReason: o.accepted ? undefined : o.reason
      })),
      sourceDocIds: [docId]
    };

    setDocuments((prev) => [...prev, doc]);
    setDecisions((prev) => [decision, ...prev]);
    void logWorkspaceEvent('decision_captured', { decision, sourceText });
    setActivityFeed((prev) => [
      {
        id: `act-${Date.now()}`,
        text: `Decision captured: ${title} (${decision.assumptions.length} assumptions now watched)`,
        timestamp: 'Just now',
        type: 'decision'
      },
      ...prev
    ]);
    addToast({
      type: 'success',
      title: 'Decision captured',
      description: `Mnemo now watches ${decision.assumptions.length} assumption${decision.assumptions.length === 1 ? '' : 's'} behind "${title}".`
    });
    return decision;
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
        addCapturedDecision,
        isStaleHeroActive,
        setIsStaleHeroActive,
        heroStaleDecision,
        openSourceByDocId,
        staleCount,
        watchCount,
        validCount,
        moneyAtRisk,
        activityFeed,
        conflictScan,
        setConflictScan,
        conflictActions,
        setConflictAction,
        expertMessages,
        setExpertMessages,
        pendingExpertQuestion,
        askExpert,
        clearPendingExpertQuestion
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
