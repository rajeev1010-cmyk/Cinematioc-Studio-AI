
import React from 'react';
import { Camera, MapPin } from 'lucide-react';
import { StudioState } from '../types';

const CameraViewfinder: React.FC<{ state: StudioState, inferredScale?: string }> = ({ state, inferredScale }) => {
  const cam = state.cameras[state.activeCameraIndex];
  const mm = parseInt(cam.lens.match(/\d+/)?.[0] || "50");
  const sensorHeight = 24;
  const aspect = 16 / 9;

  const project = (obj: { x: number, z: number }) => {
    const dx = obj.x - cam.x;
    const dz = obj.z - cam.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist <= 0.1) return null;

    // Calculate global angle to object (0 = North/Z+)
    const angleGlobal = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
    
    // Calculate relative angle to camera facing direction
    let relAngleDeg = (angleGlobal - cam.rotation + 540) % 360 - 180;
    const relAngleRad = relAngleDeg * (Math.PI / 180);

    // Project onto a flat plane in front of the camera
    const localZ = dist * Math.cos(relAngleRad);
    if (localZ <= 0.1) return null; // Behind camera

    const localX = dist * Math.sin(relAngleRad);
    
    const frameHeightAtZ = (sensorHeight * localZ) / mm;
    const frameWidthAtZ = frameHeightAtZ * aspect;
    
    const screenX = 50 + (localX / (frameWidthAtZ / 2)) * 50;
    const heightPct = (6.0 / frameHeightAtZ) * 100; // Assume 6ft character height

    return { x: screenX, heightPct, dist: localZ, visible: screenX > -20 && screenX < 120 };
  };

  return (
    <div className="relative w-full aspect-video bg-[#010101] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Viewfinder Grid */}
      <div className="absolute inset-0 z-10 opacity-20 pointer-events-none border border-white/5" style={{ backgroundImage: 'linear-gradient(to right, transparent 33.3%, #fff 33.3%, #fff 33.4%, transparent 33.4%, transparent 66.6%, #fff 66.6%, #fff 66.7%, transparent 66.7%), linear-gradient(to bottom, transparent 33.3%, #fff 33.3%, #fff 33.4%, transparent 33.4%, transparent 66.6%, #fff 66.6%, #fff 66.7%, transparent 66.7%)' }} />
      
      {state.landmarks.map(lm => {
        const p = project(lm);
        if (!p || !p.visible) return null;
        return (
          <div key={lm.id} className="absolute flex flex-col items-center transition-all duration-300" style={{ left: `${p.x}%`, top: '40%', opacity: Math.max(0.1, 1 - p.dist/200) }}>
             <MapPin className="text-emerald-500/30" style={{ width: Math.max(10, p.heightPct * 2) }} />
             <span className="text-[4px] font-black uppercase text-emerald-500/40">{lm.label}</span>
          </div>
        );
      })}

      {state.subjects.map(sub => {
        const p = project(sub);
        if (!p || !p.visible) return null;
        
        // Relative rotation for body orientation representation
        const relRotation = (sub.rotation - cam.rotation + 540) % 360 - 180;

        return (
          <div key={sub.id} className="absolute flex flex-col items-center transition-all duration-300" style={{ left: `${p.x}%`, top: `${50 - p.heightPct/2}%`, height: `${p.heightPct}%`, zIndex: Math.round(1000 - p.dist) }}>
             {/* Character Silhouette */}
             <div className="relative w-full h-full flex flex-col items-center">
                {/* Head */}
                <div className="w-[30%] aspect-square rounded-full border border-indigo-500 bg-indigo-500/30 z-10 shadow-[0_0_10px_rgba(99,102,241,0.3)]" />
                {/* Shoulders (represented by a rotated ellipse) */}
                <div 
                  className="w-full h-[20%] -mt-[10%] rounded-[50%] border-x border-t border-indigo-400/50 bg-indigo-500/10 transition-transform duration-300" 
                  style={{ transform: `scaleX(${Math.abs(Math.cos(relRotation * Math.PI / 180)) * 0.5 + 0.5})` }}
                />
                {/* Torso */}
                <div className="w-[60%] flex-1 border-x border-b border-indigo-500/40 bg-indigo-500/5 rounded-b-lg" />
             </div>
             <span className="text-[5px] font-black uppercase text-indigo-400 mt-1 bg-black/40 px-1 rounded">{sub.label}</span>
          </div>
        );
      })}

      <div className="absolute top-2 left-2 flex gap-2 z-20">
         <span className="bg-red-600 px-1.5 py-0.5 rounded text-[6px] font-bold uppercase animate-pulse">REC</span>
         <span className="bg-black/60 backdrop-blur-sm border border-white/10 px-1.5 py-0.5 rounded text-[6px] font-bold uppercase font-mono">{inferredScale}</span>
      </div>
    </div>
  );
};

export default CameraViewfinder;
