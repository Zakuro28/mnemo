import React from 'react';

interface MnemoLogoProps {
  size?: number;
  className?: string;
}

export const MnemoLogo: React.FC<MnemoLogoProps> = ({ size = 36, className = '' }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 64 64" 
      width={size} 
      height={size}
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="mnemo-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4FA690"/>
          <stop offset="1" stopColor="#2C6B5C"/>
        </linearGradient>
        <filter id="mnemo-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge>
            <feMergeNode in="b"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Background card with border */}
      <rect width="64" height="64" rx="16" fill="url(#mnemo-bg)"/>
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.25" fill="none" stroke="#FFFACD" strokeOpacity="0.25" strokeWidth="1.5"/>

      {/* M path line that draws in */}
      <polyline 
        points="17,46 17,21 32,37 47,21 47,46" 
        fill="none" 
        stroke="#FFFACD" 
        strokeOpacity="0.9" 
        strokeWidth="3.2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="logo-draw-m"
      />

      {/* Outer nodes popping in */}
      <g fill="#FFFACD">
        <circle cx="17" cy="46" r="5" className="logo-pop-node" style={{ animationDelay: '300ms', transformOrigin: '17px 46px' }} />
        <circle cx="17" cy="21" r="5" className="logo-pop-node" style={{ animationDelay: '380ms', transformOrigin: '17px 21px' }} />
        <circle cx="32" cy="37" r="5" className="logo-pop-node" style={{ animationDelay: '460ms', transformOrigin: '32px 37px' }} />
        <circle cx="47" cy="21" r="5" className="logo-pop-node" style={{ animationDelay: '540ms', transformOrigin: '47px 21px' }} />
        <circle cx="47" cy="46" r="5" className="logo-pop-node" style={{ animationDelay: '620ms', transformOrigin: '47px 46px' }} />
      </g>

      {/* Inner dots */}
      <g fill="#3D8D7A">
        <circle cx="17" cy="46" r="1.8" className="logo-pop-node" style={{ animationDelay: '350ms', transformOrigin: '17px 46px' }} />
        <circle cx="17" cy="21" r="1.8" className="logo-pop-node" style={{ animationDelay: '430ms', transformOrigin: '17px 21px' }} />
        <circle cx="32" cy="37" r="1.8" className="logo-pop-node" style={{ animationDelay: '510ms', transformOrigin: '32px 37px' }} />
        <circle cx="47" cy="21" r="1.8" className="logo-pop-node" style={{ animationDelay: '590ms', transformOrigin: '47px 21px' }} />
        <circle cx="47" cy="46" r="1.8" className="logo-pop-node" style={{ animationDelay: '670ms', transformOrigin: '47px 46px' }} />
      </g>

      {/* Watcher glowing dot */}
      <circle cx="53" cy="11" r="4.2" fill="#FFE27A" filter="url(#mnemo-glow)" className="logo-watcher-pulse" />
      <circle cx="53" cy="11" r="4.2" fill="#FFF3B0" stroke="#FFFACD" strokeWidth="1.4" className="logo-watcher-pulse" />
    </svg>
  );
};
