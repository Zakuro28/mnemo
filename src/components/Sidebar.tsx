import React from 'react';
import { LayoutDashboard, Sparkles, GitBranch, FileUp, Swords, UserRound, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useLore, ViewType } from '../context/LoreContext';
import { MnemoLogo } from './MnemoLogo';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, staleCount, watchCount } = useLore();

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
      disabled: true,
      tag: 'Coming soon'
    },
    {
      id: 'experts',
      label: 'Experts',
      icon: UserRound,
      disabled: true,
      tag: 'Coming soon'
    }
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#2C6B5C] text-white border-r border-[#3D8D7A]/40 flex flex-col justify-between select-none z-20">
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

      {/* Footer Info */}
      <div className="p-4 border-t border-[#3D8D7A]/40 text-[12px] text-white/70">
        <p className="leading-snug">
          Grounded against Brightwell company documents.
        </p>
      </div>
    </aside>
  );
};
