import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowUp, FileText, Info, RotateCcw, ShieldCheck } from 'lucide-react';
import { useLore } from '../context/LoreContext';
import { ExpertMessage, TimelineCitation } from '../types/lore';

const EXPERT = {
  id: 'maria',
  name: 'Maria Tan',
  firstName: 'Maria',
  initials: 'MT',
  role: 'Procurement Lead',
  tenure: '2019 – 2026',
  leftOn: 'Left Sep 2026',
  docIds: ['D1', 'D2', 'D11'],
  topics: [
    { label: 'Supplier delays', question: 'How did you handle supplier delays?' },
    { label: 'Carrier trials', question: 'Why did we drop Vendor C?' },
    { label: 'Vendor B contract', question: 'What should we do about Vendor B now?' },
    { label: 'Purchase approvals', question: 'What did you think about our approval rules?' }
  ]
};

const SUGGESTED_QUESTIONS = [
  'How did you handle supplier delays?',
  'What should we do about Vendor B now?',
  'Why did we drop Vendor C?',
  "What's our office parking policy?"
];

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const Avatar: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <div
    className={`relative shrink-0 rounded-full bg-gradient-to-br from-[#4FA690] to-[#2C6B5C] text-white flex items-center justify-center font-serif shadow-sm ${
      size === 'lg' ? 'w-20 h-20 text-[32px]' : 'w-9 h-9 text-[15px]'
    }`}
  >
    {EXPERT.initials}
    {size === 'lg' && (
      <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#FFE27A] border-2 border-white" title="Twin active" />
    )}
  </div>
);

export const ExpertsView: React.FC = () => {
  const {
    documents,
    expertMessages,
    setExpertMessages,
    pendingExpertQuestion,
    clearPendingExpertQuestion,
    openSourceByDocId,
    registerAbortController,
    resetKey
  } = useLore();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const expertDocs = documents.filter((d) => EXPERT.docIds.includes(d.id));

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    setInput('');
    setIsThinking(false);
  }, [resetKey]);

  // Keep the newest message in view
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [expertMessages, isThinking]);

  const ask = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || isThinking) return;

    setInput('');
    setExpertMessages((prev) => [
      ...prev.filter((m) => !m.error),
      { id: newId(), role: 'user', text: question }
    ]);
    setIsThinking(true);

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const unregister = registerAbortController(controller);

    try {
      const res = await fetch('/api/ask-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expertId: EXPERT.id, question, documents }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      if (controller.signal.aborted) return;

      setExpertMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'expert',
          text: data.answer,
          covered: data.covered,
          citations: data.citations || [],
          servedFrom: data.servedFrom
        }
      ]);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Ask expert error:', err);
      setExpertMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'expert',
          text: err?.message || 'Something went wrong',
          error: true,
          retryQuestion: question
        }
      ]);
    } finally {
      unregister();
      if (!controller.signal.aborted) {
        setIsThinking(false);
      }
    }
  };

  // Questions handed over from other screens (e.g. the stale decision card)
  useEffect(() => {
    if (pendingExpertQuestion) {
      const question = pendingExpertQuestion;
      clearPendingExpertQuestion();
      ask(question);
    }
  }, [pendingExpertQuestion]);

  const retry = (message: ExpertMessage) => {
    if (!message.retryQuestion) return;
    const question = message.retryQuestion;
    // Drop the failed exchange, then ask again
    setExpertMessages((prev) => {
      const withoutError = prev.filter((m) => m.id !== message.id);
      const last = withoutError[withoutError.length - 1];
      return last?.role === 'user' && last.text === question ? withoutError.slice(0, -1) : withoutError;
    });
    setTimeout(() => ask(question), 0);
  };

  const renderCitations = (citations: TimelineCitation[]) => (
    <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-[#E3EAE7]">
      <span className="text-[12px] text-[#7A8C86] font-medium">Sources:</span>
      {citations.map((cite, i) => (
        <button
          key={i}
          onClick={() => openSourceByDocId(cite.docId)}
          title={`"${cite.snippet}"`}
          style={{ animation: `logoNodePop 250ms cubic-bezier(0.23, 1, 0.32, 1) ${150 + i * 60}ms both` }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E3F0EC] hover:bg-[#3D8D7A] hover:text-white text-[#12332B] border border-[#3D8D7A]/30 text-[12px] font-medium transition-colors active:scale-[0.97] group"
        >
          <FileText className="w-3.5 h-3.5 text-[#3D8D7A] group-hover:text-white" strokeWidth={1.75} />
          {cite.docTitle}
          <span className="text-[#7A8C86] group-hover:text-white/80">({cite.date})</span>
        </button>
      ))}
    </div>
  );

  const renderMessage = (message: ExpertMessage) => {
    const enter = { animation: 'pageEnterFadeUp 220ms cubic-bezier(0.23, 1, 0.32, 1) both' };

    if (message.role === 'user') {
      return (
        <div key={message.id} className="flex justify-end" style={enter}>
          <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-md bg-[#3D8D7A] text-white text-[15px] leading-relaxed shadow-xs">
            {message.text}
          </div>
        </div>
      );
    }

    if (message.error) {
      return (
        <div key={message.id} className="flex items-start gap-3" style={enter}>
          <Avatar />
          <div className="max-w-[80%] p-4 rounded-2xl rounded-tl-md bg-[#FFF8F6] border border-[#C8553D]/40 space-y-2">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#12332B]">
              <AlertTriangle className="w-4 h-4 text-[#C8553D]" strokeWidth={1.75} />
              I couldn't reach my records just now.
            </div>
            <p className="text-[12px] font-mono text-[#7A8C86] break-words">{message.text}</p>
            <button
              onClick={() => retry(message)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C8553D] hover:bg-[#b0452f] text-white text-[13px] font-semibold rounded-lg transition-colors active:scale-[0.97]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    const notCovered = message.covered === false;
    return (
      <div key={message.id} className="flex items-start gap-3" style={enter}>
        <Avatar />
        <div
          className={`max-w-[80%] p-4 rounded-2xl rounded-tl-md text-[15px] leading-relaxed ${
            notCovered
              ? 'bg-[#F7FAF9] border border-dashed border-[#B9C9C3] text-[#3F5A52]'
              : 'bg-white border border-[#E3EAE7] text-[#12332B] shadow-xs'
          }`}
        >
          {notCovered && (
            <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-[#7A8C86] mb-1.5">
              <Info className="w-3.5 h-3.5" strokeWidth={2} />
              Not in my records
            </div>
          )}
          <p>{message.text}</p>
          {!notCovered && message.citations && message.citations.length > 0 && renderCitations(message.citations)}
          {message.servedFrom === 'memory' && (
            <p className="text-[11px] text-[#7A8C86] mt-2">Verified memory · served while Gemini is busy</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16 animate-page-enter">
      <div>
        <h1 className="font-serif text-[48px] md:text-[56px] font-normal tracking-tight text-[#12332B] leading-tight">
          Experts
        </h1>
        <p className="text-[#3F5A52] text-[16px] leading-relaxed max-w-3xl mt-2">
          Know-how that stays when people leave. Each expert twin answers only from that person's own records.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Expert profile */}
        <div className="mnemo-card p-6 space-y-6">
          <div className="relative z-10 flex flex-col items-center text-center">
            <Avatar size="lg" />
            <h2 className="font-serif text-[30px] font-normal text-[#12332B] mt-4 leading-none">{EXPERT.name}</h2>
            <p className="text-[14px] text-[#3F5A52] mt-2">{EXPERT.role}</p>
            <p className="text-[13px] text-[#7A8C86]">{EXPERT.tenure}</p>
            <span className="mt-3 px-2.5 py-0.5 rounded-full bg-[#F7FAF9] border border-[#E3EAE7] text-[12px] font-medium text-[#7A8C86]">
              {EXPERT.leftOn}
            </span>
          </div>

          <div className="relative z-10 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A8C86]">
              Twin built from {expertDocs.length} records
            </p>
            {expertDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => openSourceByDocId(doc.id)}
                className="w-full text-left p-3 rounded-xl border border-[#E3EAE7] bg-[#F7FAF9] hover:bg-white hover:border-[#3D8D7A]/50 transition-colors active:scale-[0.98] flex items-start gap-2.5"
              >
                <FileText className="w-4 h-4 text-[#3D8D7A] shrink-0 mt-0.5" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#12332B] leading-snug">{doc.title}</span>
                  <span className="block text-[12px] text-[#7A8C86] mt-0.5">{doc.date}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="relative z-10 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A8C86]">Knows about</p>
            <div className="flex flex-wrap gap-2">
              {EXPERT.topics.map((topic) => (
                <button
                  key={topic.label}
                  onClick={() => ask(topic.question)}
                  disabled={isThinking}
                  className="px-3 py-1 rounded-full bg-[#E3F0EC] hover:bg-[#D3EBE3] text-[#2C6B5C] text-[13px] font-medium border border-[#3D8D7A]/20 transition-colors active:scale-[0.97] disabled:opacity-50"
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="mnemo-card flex flex-col h-[640px]">
          <div className="relative z-10 px-6 py-4 border-b border-[#E3EAE7] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar />
              <div>
                <p className="text-[16px] font-semibold text-[#12332B]">{EXPERT.firstName}'s twin</p>
                <p className="text-[13px] text-[#7A8C86]">AI twin · answers only from {EXPERT.firstName}'s records</p>
              </div>
            </div>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3D8D7A]/12 border border-[#3D8D7A]/30 text-[12px] font-semibold text-[#2C6B5C]">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
              Never guesses
            </span>
          </div>

          <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {/* Greeting */}
            <div className="flex items-start gap-3">
              <Avatar />
              <div className="max-w-[80%] p-4 rounded-2xl rounded-tl-md bg-white border border-[#E3EAE7] text-[15px] text-[#12332B] leading-relaxed shadow-xs">
                Hi, I'm {EXPERT.firstName}'s twin. I keep the procurement know-how {EXPERT.firstName} left behind.
                Ask me anything about it, and if it isn't in my records, I'll tell you instead of guessing.
              </div>
            </div>

            {expertMessages.map(renderMessage)}

            {isThinking && (
              <div className="flex items-start gap-3" style={{ animation: 'pageEnterFadeUp 200ms cubic-bezier(0.23, 1, 0.32, 1) both' }}>
                <Avatar />
                <div className="px-4 py-3.5 rounded-2xl rounded-tl-md bg-white border border-[#E3EAE7] flex items-center gap-3 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3D8D7A] bounce-dot-1" />
                    <span className="w-2 h-2 rounded-full bg-[#3D8D7A] bounce-dot-2" />
                    <span className="w-2 h-2 rounded-full bg-[#3D8D7A] bounce-dot-3" />
                  </div>
                  <span className="text-[13px] text-[#7A8C86]">Checking my records...</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 px-6 py-4 border-t border-[#E3EAE7] space-y-3">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={isThinking}
                  className="px-3 py-1 rounded-full bg-[#F7FAF9] hover:bg-[#E3F0EC] text-[#2C6B5C] text-[13px] font-medium border border-[#E3EAE7] transition-colors active:scale-[0.97] disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="h-12 bg-white border border-[#E3EAE7] rounded-xl flex items-center pl-4 pr-1.5 gap-3 focus-within:border-[#3D8D7A] focus-within:ring-3 focus-within:ring-[#3D8D7A]/20 transition-colors"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${EXPERT.firstName}'s twin a question...`}
                className="flex-1 bg-transparent text-[15px] text-[#12332B] placeholder:text-[#7A8C86] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isThinking || !input.trim()}
                aria-label="Send question"
                className="btn-primary-teal w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
