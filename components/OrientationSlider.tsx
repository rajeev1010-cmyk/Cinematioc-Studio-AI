import React from 'react';
import { Camera, RotateCw } from 'lucide-react';
import { SubjectConfig, CameraConfig } from '../types';

interface OrientationSliderProps {
  config: SubjectConfig;
  activeCamera: CameraConfig;
  onChange: (val: number) => void;
}

const OrientationSlider: React.FC<OrientationSliderProps> = ({ config, activeCamera, onChange }) => {
  const value = config.rotation;

  // Calculate the angle from subject to camera in 2D space
  const calculateFaceCameraAngle = () => {
    const dx = activeCamera.x - config.x;
    const dy = activeCamera.y - config.y;
    let angleRad = Math.atan2(dx, dy);
    let angleDeg = (angleRad * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;
    return Math.round(angleDeg);
  };

  const handleFaceCamera = () => {
    onChange(calculateFaceCameraAngle());
  };

  return (
    <div className="flex flex-col items-center gap-3 lg:gap-4">
      <div className="relative w-24 h-24 lg:w-32 lg:h-32 rounded-full border border-white/10 flex items-center justify-center overflow-hidden bg-black/40">
        {/* Compass Marks */}
        <div className="absolute inset-1.5 lg:inset-2 border border-white/5 rounded-full pointer-events-none"></div>
        <div className="absolute h-full w-px bg-white/5 left-1/2 -translate-x-1/2"></div>
        <div className="absolute w-full h-px bg-white/5 top-1/2 -translate-y-1/2"></div>
        
        {/* Human Top View Icon */}
        <div 
          className="absolute w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center transition-transform duration-200"
          style={{ transform: `rotate(${value}deg)` }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]">
            <ellipse cx="50" cy="50" rx="35" ry="18" fill="rgba(99, 102, 241, 0.3)" stroke="rgba(99, 102, 241, 0.8)" strokeWidth="2" />
            <circle cx="50" cy="50" r="14" fill="#6366f1" />
            <path d="M44 42 L50 32 L56 42 Z" fill="#818cf8" />
          </svg>
        </div>

        {/* Visual Camera Marker */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{ transform: `rotate(${calculateFaceCameraAngle()}deg)` }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 flex items-center justify-center">
             <Camera className="w-2.5 h-2.5 text-indigo-400 rotate-180" />
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
      </div>
      
      <div className="w-full space-y-3">
        <button 
          onClick={handleFaceCamera}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-[8px] font-bold text-indigo-400 uppercase tracking-widest border border-indigo-500/20 transition-all"
        >
          <Camera className="w-3 h-3" /> Face Lens
        </button>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-[9px] text-white/40 uppercase tracking-widest px-1">
            <span>Body Rotation</span>
            <span className="text-indigo-400 font-mono font-bold">{value}°</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="360" 
            value={value} 
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default OrientationSlider;