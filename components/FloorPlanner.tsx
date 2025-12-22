import { Camera } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CameraConfig, StudioState, SubjectConfig } from '../types';

interface FloorPlannerProps {
  state: StudioState;
  onUpdateSubject: (id: 'a' | 'b', updates: Partial<SubjectConfig>) => void;
  onUpdateCamera: (index: number, updates: Partial<CameraConfig>) => void;
  onSelectCamera: (index: number) => void;
}

const FloorPlanner: React.FC<FloorPlannerProps> = ({ 
  state,
  onUpdateSubject,
  onUpdateCamera,
  onSelectCamera
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{ 
    type: 'move' | 'rotate-body' | 'rotate-gaze' | 'rotate-cam'; 
    target: 'subject' | 'camera';
    id: any;
  } | null>(null);

  const { subjects, cameras, activeCameraIndex, plannerZoom } = state;
  const handlersRef = useRef({ onUpdateSubject, onUpdateCamera, onSelectCamera });
  
  useEffect(() => {
    handlersRef.current = { onUpdateSubject, onUpdateCamera, onSelectCamera };
  }, [onUpdateSubject, onUpdateCamera, onSelectCamera]);

  const getFovAngle = (lens: string) => {
    const mm = lens.match(/(\d+)mm/);
    const focalLength = mm ? parseInt(mm[1]) : 50;
    return 2 * Math.atan(18 / focalLength) * (180 / Math.PI);
  };

  const startDrag = (type: any, target: any, id: any) => (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    if (target === 'camera' && type === 'move') handlersRef.current.onSelectCamera(id as number);
    setDragState({ type, target, id });
  };

  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    if (!dragState || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Coordination Range: 100ft at 1.0 zoom
    const range = 50 / plannerZoom;

    if (dragState.type === 'move') {
      const coordX = ((clientX - rect.left) / rect.width - 0.5) * (range * 2);
      const coordZ = (1 - (clientY - rect.top) / rect.height) * (range * 2);
      
      const boundedX = coordX; 
      const boundedZ = Math.max(0, coordZ); 

      if (dragState.target === 'subject') {
        handlersRef.current.onUpdateSubject(dragState.id, { x: boundedX, z: boundedZ });
      } else {
        handlersRef.current.onUpdateCamera(dragState.id, { x: boundedX, z: boundedZ });
      }
    } else {
      const targetObj = dragState.target === 'subject' ? subjects[dragState.id as 'a' | 'b'] : cameras[dragState.id];
      const objScreenX = rect.left + rect.width * (0.5 + targetObj.x / (range * 2));
      const objScreenY = rect.top + rect.height * (1 - targetObj.z / (range * 2));
      
      const dx = clientX - objScreenX;
      const dy = clientY - objScreenY;
      let angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;

      if (dragState.type === 'rotate-body' && dragState.target === 'subject') {
        handlersRef.current.onUpdateSubject(dragState.id, { rotation: angle });
      } else if (dragState.type === 'rotate-gaze' && dragState.target === 'subject') {
        handlersRef.current.onUpdateSubject(dragState.id, { gaze: angle });
      } else if (dragState.type === 'rotate-cam' && dragState.target === 'camera') {
        handlersRef.current.onUpdateCamera(dragState.id, { rotation: angle });
      }
    }
  }, [dragState, plannerZoom, subjects, cameras]);

  const onMouseMove = useCallback((e: MouseEvent) => handleInteraction(e.clientX, e.clientY), [handleInteraction]);
  const endDrag = useCallback(() => setDragState(null), []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', endDrag);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
    };
  }, [dragState, onMouseMove, endDrag]);

  const getStyle = (obj: {x: number, z: number}) => {
    const range = 50 / plannerZoom;
    const left = `${((obj.x / (range * 2)) + 0.5) * 100}%`;
    const top = `${(1 - (obj.z / (range * 2))) * 100}%`;
    return { left, top };
  };

  const renderSubject = (id: 'a' | 'b', config: SubjectConfig) => {
    const isDragging = dragState?.target === 'subject' && dragState.id === id;
    const style = getStyle(config);
    
    const topNum = parseFloat(style.top);
    const leftNum = parseFloat(style.left);
    if (topNum < -20 || topNum > 120 || leftNum < -20 || leftNum > 120) return null;

    return (
      <div 
        key={id}
        style={style}
        className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group select-none transition-transform ${isDragging ? 'z-30 scale-110' : ''}`}
      >
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div onMouseDown={startDrag('move', 'subject', id)} className="absolute inset-4 cursor-grab active:cursor-grabbing rounded-full bg-white/5 border border-white/5 hover:bg-white/10 z-10"></div>
          
          <div className="absolute inset-0 transition-transform duration-75" style={{ transform: `rotate(${config.rotation}deg)` }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <ellipse cx="50" cy="50" rx="30" ry="15" fill={id === 'a' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(168, 85, 247, 0.4)'} stroke={id === 'a' ? '#6366f1' : '#a855f7'} strokeWidth="2.5" />
              <circle cx="50" cy="50" r="12" fill={id === 'a' ? '#6366f1' : '#a855f7'} />
            </svg>
            <div onMouseDown={startDrag('rotate-body', 'subject', id)} className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full cursor-alias border-2 border-indigo-500 shadow-xl" />
          </div>

          <div className="absolute inset-0 pointer-events-none transition-transform duration-75" style={{ transform: `rotate(${config.gaze}deg)` }}>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[280%] flex flex-col items-center">
                <div className="w-0.5 h-12 bg-gradient-to-t from-emerald-500 to-transparent opacity-60"></div>
                <div onMouseDown={startDrag('rotate-gaze', 'subject', id)} className="w-5 h-5 bg-emerald-400 rounded-full cursor-alias pointer-events-auto shadow-lg border-2 border-white" />
             </div>
          </div>
          
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase text-white/40 tracking-widest whitespace-nowrap bg-black/60 px-2 rounded">
            Actor {id.toUpperCase()}
          </div>
        </div>
      </div>
    );
  };

  const renderCamera = (cam: CameraConfig, index: number) => {
    const isActive = activeCameraIndex === index;
    const fov = getFovAngle(cam.lens);
    const style = getStyle(cam);

    return (
      <div key={cam.id} style={style} className={`absolute -translate-x-1/2 -translate-y-1/2 select-none touch-none ${isActive ? 'z-40' : 'z-20'}`}>
        <div 
          className="absolute top-1/2 left-1/2 pointer-events-none transition-all duration-300"
          style={{ 
            transform: `translate(-50%, -50%) rotate(${cam.rotation}deg)`, 
            opacity: isActive ? 0.3 : 0.05,
            width: '1200px',
            height: '1200px'
          }}
        >
          <svg viewBox="0 0 1200 1200" className="w-full h-full">
             <path d={`M 600 600 L ${600 - Math.tan((fov / 2) * Math.PI / 180) * 800} 0 L ${600 + Math.tan((fov / 2) * Math.PI / 180) * 800} 0 Z`} fill="url(#fovGradientPlanner)" />
          </svg>
        </div>

        <div className={`relative p-3 rounded-2xl border transition-all ${isActive ? 'bg-indigo-600 border-indigo-300 scale-125 shadow-2xl' : 'bg-[#111] border-white/10 opacity-50'}`}>
          <div onMouseDown={startDrag('move', 'camera', index)} className="absolute inset-0 cursor-grab active:cursor-grabbing z-0"></div>
          <div className="relative z-10 transition-transform pointer-events-none" style={{ transform: `rotate(${cam.rotation}deg)` }}>
            <Camera className="w-5 h-5 text-white" />
            <div onMouseDown={startDrag('rotate-cam', 'camera', index)} className="absolute top-[-14px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full cursor-alias pointer-events-auto border-2 border-indigo-400" />
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/40 uppercase whitespace-nowrap tracking-widest bg-black/40 px-2 rounded">
            Node {index + 1}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-[#030303] rounded-[3rem] border border-white/5 overflow-hidden shadow-[inset_0_0_200px_rgba(0,0,0,0.95)] cursor-crosshair relative select-none"
    >
      <svg className="absolute w-0 h-0">
        <defs>
          <linearGradient id="fovGradientPlanner" x1="0.5" y1="1" x2="0.5" y2="0">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute inset-0 opacity-[0.03]" style={{ 
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
        backgroundSize: `${20 * plannerZoom}px ${20 * plannerZoom}px`,
        backgroundPosition: 'center bottom'
      }}></div>

      <div className="absolute left-10 inset-y-0 flex flex-col justify-between py-12 pointer-events-none border-l border-white/5">
         <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.5em] -rotate-90">Deep Field (Z+)</span>
         <span className="text-[8px] font-black text-indigo-500/40 uppercase tracking-[0.5em] -rotate-90">Lens Baseline (Z 0)</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-indigo-500/20"></div>

      {renderSubject('a', subjects.a)}
      {subjects.activeCount === 2 && renderSubject('b', subjects.b)}
      {cameras.map((cam, idx) => renderCamera(cam, idx))}
      
      <div className="absolute bottom-6 right-8 flex flex-col items-end gap-1 pointer-events-none opacity-40">
         <span className="text-[8px] font-black text-white uppercase tracking-widest">Physical Stage Planner</span>
         <span className="text-[7px] font-bold text-white/30 uppercase tracking-[0.2em]">Scale: 1 Unit = 1 FT</span>
      </div>
    </div>
  );
};

export default FloorPlanner;