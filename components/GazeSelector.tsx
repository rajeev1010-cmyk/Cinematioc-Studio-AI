
import React from 'react';
import { Eye, Monitor, Users, MoveRight, MoveLeft, Target } from 'lucide-react';
import { SubjectConfig, CameraConfig } from '../types';

interface GazeSelectorProps {
  subjectId: 'a' | 'b';
  config: SubjectConfig;
  activeCamera: CameraConfig;
  otherSubject?: SubjectConfig;
  onChange: (val: number) => void;
}

const GazeSelector: React.FC<GazeSelectorProps> = ({ subjectId, config, activeCamera, otherSubject, onChange }) => {
  
  const getAngleTo = (tx: number, tz: number) => {
    const dx = tx - config.x;
    const dz = tz - config.z;
    // New calibration: South is 0deg.
    let angleRad = Math.atan2(dx, -dz);
    let angleDeg = (angleRad * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;
    return Math.round(angleDeg);
  };

  const setGazeToCamera = () => onChange(getAngleTo(activeCamera.x, activeCamera.z));
  
  const setGazeToPartner = () => {
    if (!otherSubject) return;
    onChange(getAngleTo(otherSubject.x, otherSubject.z));
  };

  const PRESETS = [
    { label: 'Into Lens (0°)', icon: <Target className="w-3 h-3" />, action: setGazeToCamera },
    { label: 'Partner', icon: <Users className="w-3 h-3" />, action: setGazeToPartner, disabled: !otherSubject },
    { label: 'Left Field', icon: <MoveLeft className="w-3 h-3" />, action: () => onChange(90) },
    { label: 'Right Field', icon: <MoveRight className="w-3 h-3" />, action: () => onChange(270) },
  ];

  return (
    <div className="bg-black/40 p-3 lg:p-4 rounded-2xl border border-white/5 space-y-4">
      <div className="flex justify-between items-center px-0.5">
        <p className="text-[8px] font-bold text-white/30 uppercase">Subject {subjectId.toUpperCase()}</p>
        <div className="flex items-center gap-1.5">
           {Math.abs(config.gaze - getAngleTo(activeCamera.x, activeCamera.z)) < 5 && (
             <span className="text-[7px] font-black text-emerald-400 bg-emerald-500/20 px-1 rounded animate-pulse">LENS LOCK</span>
           )}
           <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {config.gaze}°
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={p.action}
            disabled={p.disabled}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold text-white/40 hover:text-white/60 transition-all disabled:opacity-20 disabled:pointer-events-none"
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      <div className="relative h-1 bg-white/10 rounded-full mt-2">
        <input 
          type="range" 
          min="0" 
          max="360" 
          value={config.gaze} 
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer accent-emerald-500"
        />
      </div>
      <p className="text-[7px] text-white/20 uppercase tracking-widest text-center">Gaze Angle (0° = Facing Lens)</p>
    </div>
  );
};

export default GazeSelector;
