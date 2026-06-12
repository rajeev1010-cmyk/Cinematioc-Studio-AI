
import { Camera, MapPin, Eye, Move } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CameraConfig, StudioState, SubjectConfig, Landmark } from '../types';
import { LENSES } from '../constants';

interface FloorPlannerProps {
  state: StudioState;
  onUpdateSubject: (id: string, updates: Partial<SubjectConfig>) => void;
  onUpdateLandmark: (id: string, updates: Partial<Landmark>) => void;
  onUpdateCamera: (index: number, updates: Partial<CameraConfig>) => void;
  onUpdatePlanner: (updates: { zoom?: number; offset?: { x: number; z: number } }) => void;
  onSelectCamera: (index: number) => void;
}

const FloorPlanner: React.FC<FloorPlannerProps> = ({ 
  state, onUpdateSubject, onUpdateLandmark, onUpdateCamera, onUpdatePlanner, onSelectCamera 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<{ 
    type: 'move' | 'rotate-body' | 'rotate-gaze' | 'pan' | 'pinch'; 
    target: 'subject' | 'camera' | 'landmark' | 'background';
    id: any;
    startX: number;
    startY: number;
    initialOffset: { x: number; z: number };
    initialDist?: number;
    initialZoom?: number;
  } | null>(null);

  const getRange = useCallback(() => 50 / state.plannerZoom, [state.plannerZoom]);

  const handleStart = (type: 'move' | 'rotate-body' | 'rotate-gaze' | 'pan', target: any, id: any) => (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY;

    if (target === 'camera' && type === 'move') onSelectCamera(id);

    if ('touches' in e && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setActiveDrag({ type: 'pinch', target: 'background', id: null, startX: clientX, startY: clientY, initialOffset: { ...state.plannerOffset }, initialDist: dist, initialZoom: state.plannerZoom });
      return;
    }
    
    setActiveDrag({ type, target, id, startX: clientX, startY: clientY, initialOffset: { ...state.plannerOffset } });
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!activeDrag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const range = getRange();

    if (activeDrag.type === 'pan') {
      const dx = (clientX - activeDrag.startX) / rect.width * (range * 2);
      const dy = (clientY - activeDrag.startY) / rect.height * (range * 2);
      onUpdatePlanner({ offset: { x: activeDrag.initialOffset.x + dx, z: activeDrag.initialOffset.z - dy } });
      return;
    }

    if (activeDrag.type === 'move') {
      const x = ((clientX - rect.left) / rect.width - 0.5) * (range * 2) - state.plannerOffset.x;
      const z = (0.5 - (clientY - rect.top) / rect.height) * (range * 2) + state.plannerOffset.z;
      
      if (activeDrag.target === 'subject') onUpdateSubject(activeDrag.id, { x, z });
      else if (activeDrag.target === 'landmark') onUpdateLandmark(activeDrag.id, { x, z });
      else if (activeDrag.target === 'camera') onUpdateCamera(activeDrag.id, { x, z });
      return;
    }

    if (activeDrag.type === 'rotate-body' || activeDrag.type === 'rotate-gaze') {
      const targetObj: any = activeDrag.target === 'subject' 
        ? state.subjects.find(s => s.id === activeDrag.id) 
        : state.cameras[activeDrag.id];
      
      if (!targetObj) return;

      const objScreenX = rect.left + rect.width * (0.5 + (targetObj.x + state.plannerOffset.x) / (range * 2));
      const objScreenY = rect.top + rect.height * (0.5 - (targetObj.z + state.plannerOffset.z) / (range * 2));
      
      const rawAngle = (Math.atan2(clientX - objScreenX, -(clientY - objScreenY)) * 180 / Math.PI + 360) % 360;
      const angle = (rawAngle + 180) % 360;
      
      if (activeDrag.type === 'rotate-body') {
        if (activeDrag.target === 'subject') onUpdateSubject(activeDrag.id, { rotation: angle });
        else if (activeDrag.target === 'camera') onUpdateCamera(activeDrag.id, { rotation: angle });
      } else {
        onUpdateSubject(activeDrag.id, { gaze: angle });
      }
    }
  }, [activeDrag, state, getRange, onUpdatePlanner, onUpdateSubject, onUpdateLandmark, onUpdateCamera]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 2 && activeDrag?.type === 'pinch') {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const scale = dist / (activeDrag.initialDist || 1);
        onUpdatePlanner({ zoom: Math.max(0.1, Math.min(5, (activeDrag.initialZoom || 1) * scale)) });
      } else if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onEnd = () => setActiveDrag(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [activeDrag, handleMove, onUpdatePlanner]);

  const getPos = (obj: { x: number, z: number }) => {
    const range = getRange();
    const left = (((obj.x + state.plannerOffset.x) / (range * 2)) + 0.5) * 100;
    const bottom = (((obj.z + state.plannerOffset.z) / (range * 2)) + 0.5) * 100;
    return { left: `${left}%`, bottom: `${bottom}%` };
  };

  const getFOV = (lensLabel: string) => {
    const mm = LENSES.find(l => l.label === lensLabel)?.mm || 50;
    return 2 * Math.atan(36 / (2 * mm)) * (180 / Math.PI);
  };

  return (
    <div 
      ref={containerRef} 
      onMouseDown={handleStart('pan', 'background', null)} 
      onTouchStart={handleStart('pan', 'background', null)}
      className="w-full h-full relative overflow-hidden bg-[#050505] cursor-grab active:cursor-grabbing touch-none select-none"
      style={{ touchAction: 'none' }}
    >
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
          backgroundSize: `${20 * state.plannerZoom}px ${20 * state.plannerZoom}px`, 
          backgroundPosition: `${(state.plannerOffset.x * 10 * state.plannerZoom) + (containerRef.current?.offsetWidth || 0) / 2}px ${(-state.plannerOffset.z * 10 * state.plannerZoom) + (containerRef.current?.offsetHeight || 0) / 2}px` 
        }} 
      />
      
      {state.subjects.map(sub => (
        <div key={sub.id} style={getPos(sub)} className="absolute -translate-x-1/2 translate-y-1/2 z-20">
          <div className="relative w-32 h-32 flex items-center justify-center pointer-events-none">
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transform: `rotate(${sub.rotation + 180}deg)` }}>
              <div 
                onMouseDown={handleStart('move', 'subject', sub.id)} 
                onTouchStart={handleStart('move', 'subject', sub.id)}
                className="relative w-16 h-10 rounded-[50%] border-2 border-indigo-500 bg-indigo-500/20 cursor-move pointer-events-auto shadow-[0_0_15px_rgba(99,102,241,0.2)] flex items-center justify-center"
              >
                <div className="w-8 h-8 rounded-full border-2 border-indigo-400 bg-indigo-500/40 shadow-inner" />
                
                <div 
                  onMouseDown={handleStart('rotate-body', 'subject', sub.id)} 
                  onTouchStart={handleStart('rotate-body', 'subject', sub.id)} 
                  className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-pointer pointer-events-auto group"
                >
                  <div className="w-4 h-4 bg-indigo-500 rounded-full border border-white group-hover:scale-125 transition-transform" />
                </div>
              </div>
            </div>

            <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${sub.gaze + 180}deg)` }}>
               <div 
                onMouseDown={handleStart('rotate-gaze', 'subject', sub.id)} 
                onTouchStart={handleStart('rotate-gaze', 'subject', sub.id)} 
                className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-pointer pointer-events-auto group"
               >
                 <Eye className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] group-hover:scale-125 transition-transform" />
               </div>
            </div>
            
            <span className="absolute top-[85%] text-[9px] font-black uppercase text-indigo-400 whitespace-nowrap bg-black/80 px-2 py-0.5 rounded border border-white/5 shadow-xl">
              {sub.label}
            </span>
          </div>
        </div>
      ))}

      {state.landmarks.map(lm => (
        <div key={lm.id} style={getPos(lm)} className="absolute -translate-x-1/2 translate-y-1/2 z-10">
          <div 
            onMouseDown={handleStart('move', 'landmark', lm.id)} 
            onTouchStart={handleStart('move', 'landmark', lm.id)} 
            className="flex flex-col items-center cursor-move p-2"
          >
            <MapPin className="w-8 h-8 text-emerald-500/50 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            <span className="text-[7px] font-black uppercase text-emerald-500 whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded border border-white/5 mt-1">
              {lm.label}
            </span>
          </div>
        </div>
      ))}

      {state.cameras.map((cam, idx) => {
        const fov = getFOV(cam.lens);
        const isActive = idx === state.activeCameraIndex;
        const tanHalfFov = Math.tan((fov/2) * Math.PI / 180) * 50;
        
        return (
          <div key={cam.id} style={getPos(cam)} className={`absolute -translate-x-1/2 translate-y-1/2 z-30 transition-all ${isActive ? 'opacity-100 scale-110' : 'opacity-40 scale-100'}`}>
            <div 
              onMouseDown={handleStart('move', 'camera', idx)} 
              onTouchStart={handleStart('move', 'camera', idx)} 
              className="relative w-24 h-24 flex items-center justify-center cursor-move"
              style={{ transform: `rotate(${cam.rotation + 180}deg)` }} // Rotate the entire camera assembly together
            >
              {/* FOV Cone with Rule of Thirds Grid */}
              <div 
                className="absolute w-[300px] h-[300px] pointer-events-none transition-opacity duration-300"
                style={{ 
                  opacity: isActive ? 0.3 : 0,
                  transformOrigin: '50% 50%' 
                }}
              >
                <div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 w-full h-full"
                  style={{
                    clipPath: `polygon(50% 50%, ${50 - tanHalfFov}% 0%, ${50 + tanHalfFov}% 0%)`,
                    background: 'linear-gradient(to top, rgba(99, 102, 241, 0.4), rgba(99, 102, 241, 0.05))'
                  }}
                >
                  <div className="absolute inset-0 w-full h-full">
                    <div className="absolute top-[16.6%] left-0 w-full h-px bg-white/20" />
                    <div className="absolute top-[33.3%] left-0 w-full h-px bg-white/20" />
                    {/* Vertical markers relative to cone width at the top */}
                    <div className="absolute top-0 left-1/2 -translate-x-[15%] w-px h-full bg-white/20" />
                    <div className="absolute top-0 left-1/2 translate-x-[15%] w-px h-full bg-white/20" />
                  </div>
                </div>
              </div>

              {/* The camera icon always points towards the cone base now as part of the assembly */}
              <Camera className="w-10 h-10 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] z-10" />
              
              {/* Rotation Handle - Static relative to assembly, always at the front */}
              <div className="absolute inset-0 pointer-events-none">
                <div 
                  onMouseDown={handleStart('rotate-body', 'camera', idx)} 
                  onTouchStart={handleStart('rotate-body', 'camera', idx)} 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-pointer pointer-events-auto group"
                >
                  <div className="w-3 h-3 bg-white rounded-full border-2 border-indigo-500 group-hover:scale-125 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FloorPlanner;
