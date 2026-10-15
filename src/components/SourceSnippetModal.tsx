import React from 'react';
import { X, Calendar, User, ShieldCheck } from 'lucide-react';
import { useLore } from '../context/LoreContext';

export const SourceSnippetModal: React.FC = () => {
  const { selectedDoc, setSelectedDoc } = useLore();

  if (!selectedDoc) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'email':
        return 'Email Thread';
      case 'meeting_notes':
        return 'Meeting Notes';
      case 'report':
        return 'Performance Report';
      case 'quote':
        return 'Rate Card / Quote';
      case 'invoice':
        return 'Invoice';
      case 'memo':
        return 'Operational Memo';
      case 'policy':
        return 'Governance Policy';
      case 'interview':
        return 'Exit Interview';
      default:
        return 'Document';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={() => setSelectedDoc(null)} />

      <div className="relative w-full max-w-xl h-full bg-[#F7FAF9] shadow-2xl border-l border-[#E3EAE7] flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[#E3EAE7] bg-white flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] font-bold px-2 py-0.5 rounded bg-[#E3F0EC] text-[#2C6B5C] border border-[#3D8D7A]/20">
                {selectedDoc.id}
              </span>
              <span className="text-[13px] font-semibold text-[#3D8D7A]">
                {getTypeLabel(selectedDoc.type)}
              </span>
            </div>
            <h3 className="text-[20px] font-semibold text-[#12332B] mt-2">
              {selectedDoc.title}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-[13px] text-[#7A8C86]">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#3D8D7A]" strokeWidth={1.75} />
                <span>{selectedDoc.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#3D8D7A]" strokeWidth={1.75} />
                <span>{selectedDoc.author}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedDoc(null)}
            className="p-2 text-[#7A8C86] hover:text-[#12332B] hover:bg-[#E3F0EC] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Excerpt */}
          <div className="p-4 rounded-xl bg-white border border-[#E3EAE7] shadow-xs">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#2C6B5C]">
              <ShieldCheck className="w-4 h-4 text-[#3D8D7A]" strokeWidth={1.75} />
              <span>Grounded Source Excerpt</span>
            </div>
            <p className="mt-2 text-[15px] font-medium text-[#12332B] leading-relaxed italic">
              "{selectedDoc.snippet}"
            </p>
          </div>

          {/* Full Record */}
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#E3EAE7]">
              <span className="text-[13px] font-semibold text-[#7A8C86]">
                Archived Record
              </span>
              <span className="text-[12px] text-[#7A8C86] font-mono">
                {selectedDoc.content.split('\n').length} lines
              </span>
            </div>
            <div className="mt-3 p-4 bg-white rounded-xl border border-[#E3EAE7] font-mono text-[12px] leading-relaxed text-[#12332B] whitespace-pre-wrap selection:bg-[#3D8D7A]/20 shadow-xs">
              {selectedDoc.content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E3EAE7] bg-white flex items-center justify-between text-[13px] text-[#7A8C86]">
          <span>Brightwell Logistics Archive</span>
          <button
            onClick={() => setSelectedDoc(null)}
            className="btn-primary-teal px-5 py-2 font-semibold rounded-xl transition-all active:scale-[0.97]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
