
// ShotScalePicker provides an interface for selecting cinematic framing scales (e.g., Close Up, Wide Shot).
import React from 'react';
import { SHOT_SCALES } from '../constants';

interface ShotScalePickerProps {
  value: string;
  onChange: (val: string) => void;
}

const ShotScalePicker: React.FC<ShotScalePickerProps> = ({ value, onChange }) => {
  // Extracts a short display name from labels like "Close Up (CU)"
  const getShortName = (label: string) => {
    return label.includes('(') ? label.split('(')[0].trim() : label;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] text-white/40 uppercase tracking-tight font-semibold">Framing / Shot Scale</label>
        <span className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded">
          {getShortName(value)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {SHOT_SCALES.map((scale) => (
          <button
            key={scale.id}
            type="button"
            onClick={() => onChange(scale.label)}
            className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${
              value === scale.label
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 scale-[1.02]'
                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <span className="text-[10px] font-bold">{scale.id}</span>
          </button>
        ))}
      </div>
      <p className="text-[8px] text-white/20 italic px-1 text-center">
        Defines the camera's field of view and subject proximity.
      </p>
    </div>
  );
};

export default ShotScalePicker;
