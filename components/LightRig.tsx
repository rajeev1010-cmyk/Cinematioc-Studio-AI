import React from 'react';
import { LIGHT_POSITIONS } from '../constants';

interface LightRigProps {
  activePositions: boolean[];
  onToggle: (index: number) => void;
  orientation: number;
}

const LightRig: React.FC<LightRigProps> = ({ activePositions, onToggle, orientation }) => {
  return (
    <div className="relative w-32 h-32 lg:w-40 lg:h-40 mx-auto">
      {/* Center Character Indicator (Top View Human) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center">
        <div 
          className="w-full h-full transition-transform duration-200"
          style={{ transform: `rotate(${orientation}deg)` }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
            <ellipse cx="50" cy="50" rx="35" ry="18" fill="rgba(255, 255, 255, 0.1)" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
            <circle cx="50" cy="50" r="14" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
            <path d="M44 58 L50 68 L56 58 Z" fill="white" fillOpacity="0.4" />
          </svg>
        </div>
      </div>

      {/* Ring Background */}
      <div className="absolute inset-0 border border-white/5 rounded-full"></div>

      {/* 8 Light Switchers */}
      {LIGHT_POSITIONS.map((lp, i) => {
        // Calculate position on the circle
        // 0° (Front) is at the bottom (90° in standard screen space)
        const screenAngle = lp.angle + 90;
        const angleRad = (screenAngle) * (Math.PI / 180);
        
        const radius = window.innerWidth < 1024 ? 58 : 70; 
        const center = window.innerWidth < 1024 ? 64 : 80; 
        
        const x = center + radius * Math.cos(angleRad);
        const y = center + radius * Math.sin(angleRad);

        // Beam rotation: to point towards center from 'screenAngle', rotate 180° opposite to the radial vector
        // In screen space, a line from center to light is at screenAngle.
        // A line from light to center is at screenAngle + 180.
        const beamRotation = screenAngle + 180;

        return (
          <button
            key={i}
            onClick={() => onToggle(i)}
            style={{ left: x, top: y }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center transition-all border z-10 ${
              activePositions[i]
                ? 'bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/50 scale-110'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className={`w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full ${activePositions[i] ? 'bg-white' : 'bg-white/20'}`}></div>
            
            {/* Visual Light Beam Ray pointing inwards */}
            {activePositions[i] && (
              <div 
                className="absolute w-12 lg:w-16 h-8 lg:h-12 bg-gradient-to-r from-amber-500/40 to-transparent pointer-events-none"
                style={{ 
                  transform: `rotate(${beamRotation}deg)`, 
                  transformOrigin: '0% 50%',
                  left: '50%',
                  top: '50%',
                  clipPath: 'polygon(0% 45%, 100% 0%, 100% 100%, 0% 55%)'
                }}
              ></div>
            )}
          </button>
        );
      })}

      {/* Camera Location Indicator */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <div className="w-1 h-2 bg-indigo-500 rounded-full"></div>
        <span className="text-[7px] text-white/30 uppercase tracking-[0.2em]">Lens</span>
      </div>
    </div>
  );
};

export default LightRig;