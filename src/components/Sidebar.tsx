import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Sparkles, GitBranch, FileUp, Swords, UserRound, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useLore, ViewType } from '../context/LoreContext';
import { MnemoLogo } from './MnemoLogo';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onClose }) => {
  const [firestoreLive, setFirestoreLive] = useState(false);

  // Ask the server whether Firestore is really reachable; recheck every minute
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (!cancelled) setFirestoreLive(data.firestore === 'connected');
      } catch {
        if (!cancelled) setFirestoreLive(false);
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const { activeView, setActiveView, staleCount, watchCount, conflictScan, conflictActions } = useLore();
  const openConflicts = conflictScan
    ? conflictScan.conflicts.filter((c) => !conflictActions[c.id]).length
    : 0;

  const navItems: Array<{
    id: ViewType;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    disabled?: boolean;
    tag?: string;
    badge?: string;
    badgeColor?: string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      disabled: false
    },
    {
      id: 'ask',
      label: 'Ask Mnemo',
      icon: Sparkles,
      disabled: false
    },
    {
      id: 'decisions',
      label: 'Decisions',
      icon: GitBranch,
      disabled: false,
      badge: staleCount > 0 ? `${staleCount} stale` : watchCount > 0 ? `${watchCount} watch` : undefined,
      badgeColor: staleCount > 0 ? 'bg-[#C8553D] text-[#FFFDF2]' : 'bg-[#D99A1E] text-[#12332B]'
    },
    {
      id: 'upload',
      label: 'Upload & Audit',
      icon: FileUp,
      disabled: false
    },
    {
      id: 'conflicts',
      label: 'Conflicts',
      icon: Swords,
      disabled: false,
      badge: openConflicts > 0 ? `${openConflicts} found` : undefined,
      badgeColor: 'bg-[#C8553D] text-[#FFFDF2]'
    },
    {
      id: 'experts',
      label: 'Experts',
      icon: UserRound,
      disabled: false
    }
  ];

  return (
    <>
    {/* Dimmed backdrop behind the phone drawer */}
    {mobileOpen && (
      <div className="fixed inset-0 z-30 bg-[#12332B]/40 md:hidden" onClick={onClose} aria-hidden="true" />
    )}
    <aside
      className={`w-64 shrink-0 bg-[#2C6B5C] text-white border-r border-[#3D8D7A]/40 flex flex-col justify-between select-none z-40 overflow-y-auto fixed inset-y-0 left-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] md:static md:translate-x-0 ${
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      <div>
        {/* Brand Area */}
        <div className="p-6 border-b border-[#3D8D7A]/40">
          <div className="flex items-center gap-3">
            {/* 36px animated logo */}
            <MnemoLogo size={36} />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-[28px] font-normal tracking-tight text-white leading-none">
                  Mnemo
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/20 text-white">
                  Memory
                </span>
              </div>
            </div>
          </div>

          {/* Company Workspace Context */}
          <div className="mt-5 p-3 rounded-xl bg-black/10 border border-white/15 flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-white/90 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Workspace</p>
              <p className="text-[13px] font-medium text-white truncate">Brightwell Logistics</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 relative">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/60">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.disabled) {
                    setActiveView(item.id);
                  }
                }}
                disabled={item.disabled}
                className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-colors duration-150 active:scale-[0.97] ${
                  item.disabled
                    ? 'text-white/40 cursor-not-allowed opacity-50'
                    : isActive
                    ? 'text-[#12332B] font-semibold'
                    : 'text-white/90 hover:text-white hover:bg-[#3D8D7A]/30'
                }`}
              >
                {/* Sliding active white pill with shared layoutId */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm z-0"
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 35
                    }}
                  />
                )}

                <div className="relative z-10 flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive ? 'text-[#12332B]' : 'text-white'
                    }`}
                    strokeWidth={1.75}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="relative z-10 flex items-center gap-1.5">
                  {item.tag && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/15 text-white/80 border border-white/15">
                      {item.tag}
                    </span>
                  )}

                  {item.badge && !isActive && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: live status of the Google Cloud services behind the app */}
      <div className="p-4 border-t border-[#3D8D7A]/40 text-[12px] text-white/75 space-y-1.5">
        <p className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${firestoreLive ? 'bg-[#8EE3C8]' : 'bg-white/35'}`} />
          {firestoreLive ? 'Memory synced to Firestore' : 'Firestore offline · working in this browser'}
        </p>
        <p className="text-white/55 leading-snug">Gemini on Google Cloud Run</p>
      </div>
    </aside>
    </>
  );
};
