import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useLore } from '../context/LoreContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useLore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let icon = <Info className="w-5 h-5 text-[#3D8D7A] shrink-0" strokeWidth={1.75} />;
        let borderClass = 'border-[#E3EAE7] bg-white text-[#12332B] shadow-[0_8px_24px_rgba(18,51,43,0.08)]';

        if (toast.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-[#C8553D] shrink-0" strokeWidth={1.75} />;
          borderClass = 'border-[#C8553D]/40 bg-[#FFF8F6] text-[#12332B] shadow-[0_8px_24px_rgba(200,85,61,0.12)]';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-5 h-5 text-[#D99A1E] shrink-0" strokeWidth={1.75} />;
          borderClass = 'border-[#D99A1E]/40 bg-white text-[#12332B] shadow-[0_8px_24px_rgba(217,154,30,0.12)]';
        } else if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-5 h-5 text-[#3D8D7A] shrink-0" strokeWidth={1.75} />;
          borderClass = 'border-[#3D8D7A]/40 bg-[#E3F0EC] text-[#12332B] shadow-[0_8px_24px_rgba(61,141,122,0.12)]';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border flex items-start justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200 ${borderClass}`}
          >
            <div className="flex items-start gap-3">
              {icon}
              <div>
                <p className="text-xs font-bold leading-tight text-[#12332B]">{toast.title}</p>
                {toast.description && (
                  <p className="text-[12px] text-[#3F5A52] mt-0.5 leading-snug">{toast.description}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#7A8C86] hover:text-[#12332B] transition-colors p-0.5 -mt-1 -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
