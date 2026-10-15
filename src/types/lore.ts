export type DecisionStatus = 'Valid' | 'Watch' | 'Stale';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface LoreDocument {
  id: string;
  title: string;
  date: string;
  author: string;
  type: 'email' | 'meeting_notes' | 'report' | 'quote' | 'invoice' | 'memo' | 'policy' | 'interview';
  content: string;
  snippet: string;
}

export interface Assumption {
  id: string;
  decisionId: string;
  text: string;
  status: DecisionStatus;
  sourceDocId: string;
  originalReason: string;
  latestEvidence: string;
  lastCheckedDate: string;
}

export interface DecisionOption {
  name: string;
  accepted: boolean;
  details: string;
  rejectionReason?: string;
}

export interface StaleAnalysis {
  originalReason: string;
  originalDate: string;
  originalSourceId: string;
  newEvidence: string;
  newDate: string;
  newSourceTitle: string;
  monthlyCost: number;
  confidence: ConfidenceLevel;
  suggestedAction: string;
  reviewStatus: 'pending' | 'marked_for_review' | 'dismissed';
}

export interface Decision {
  id: string;
  title: string;
  date: string;
  lead: string;
  summary: string;
  status: DecisionStatus;
  reasons: Array<{
    text: string;
    sourceDocId: string;
    sourceSnippet: string;
  }>;
  assumptions: Assumption[];
  options: DecisionOption[];
  sourceDocIds: string[];
  staleAnalysis?: StaleAnalysis;
}

export interface TimelineCitation {
  docId: string;
  docTitle: string;
  date: string;
  snippet: string;
}

export interface TimelineStep {
  id: string;
  date: string;
  author: string;
  action: string;
  optionsConsidered: string[];
  optionsRejected: Array<{
    option: string;
    reason: string;
  }>;
  citations: TimelineCitation[];
}

export interface TriedBeforeAlert {
  detected: boolean;
  idea: string;
  reason: string;
  sourceDocId: string;
  sourceTitle: string;
  sourceDate: string;
  snippet: string;
}

export interface AskLoreResponse {
  found: boolean;
  message?: string;
  decisionTitle?: string;
  summary?: string;
  triedBefore?: TriedBeforeAlert | null;
  timeline?: TimelineStep[];
  servedFrom?: 'memory';
}

export interface PolicySide {
  docId: string;
  docTitle: string;
  owner: string;
  quote: string;
}

export interface PolicyConflict {
  id: string;
  topic: string;
  risk: ConfidenceLevel;
  confidence: ConfidenceLevel;
  sideA: PolicySide;
  sideB: PolicySide;
  impact: string;
  impactDocId?: string;
  suggestedFix: string;
}

export interface ConflictScanResult {
  conflicts: PolicyConflict[];
  servedFrom?: 'memory';
}

export type ConflictAction = 'sent' | 'dismissed';

export interface ExpertMessage {
  id: string;
  role: 'user' | 'expert';
  text: string;
  covered?: boolean;
  citations?: TimelineCitation[];
  servedFrom?: 'memory';
  error?: boolean;
  retryQuestion?: string;
}

export interface AssumptionCheckFinding {
  assumptionId: string;
  verdict: 'contradicted' | 'supported' | 'unrelated';
  evidenceQuote: string;
  confidence: ConfidenceLevel;
  explanation: string;
}

export interface CheckAssumptionsResponse {
  status: 'success' | 'no_effect' | 'error';
  message: string;
  fileName: string;
  fileHash: string;
  findings: AssumptionCheckFinding[];
  staleCount: number;
  monthlyImpact?: number;
}
