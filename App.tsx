import React, { useState, useMemo, useEffect } from 'react';
import { Camera, Layers, Sun, Trash2, Wand2, Loader2, Settings2, RotateCw, ZoomIn, ZoomOut, Plus, X, Check, Maximize2, Compass, Eye, Key } from 'lucide-react';
import { StudioState, ReferenceType, ReferenceImage, SubjectConfig, CameraConfig } from './types';
import { REFERENCE_SLOTS, CAMERA_MODELS, LENSES, LIGHT_POSITIONS, VERTICAL_ANGLES } from './constants';
import ReferenceUploader from './components/ReferenceUploader';
import LightRig from './components/LightRig';
import FloorPlanner from './components/FloorPlanner';
import OrientationSlider from './components/OrientationSlider';
import GazeSelector from './components/GazeSelector';
import { generateDraftPrompt, generateStudioImage } from './services/geminiService';

// Fix: Define or extend the AIStudio interface and use it for the window object to match existing types and modifiers
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    readonly aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  // State to track if an API key has been selected - Mandatory for gemini-3-pro-image-preview
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [state, setState] = useState<StudioState>({
    references: REFERENCE_SLOTS.reduce((acc, slot) => {
      acc[slot.id] = { id: slot.id, label: slot.label };
      return acc;
    }, {} as Record<ReferenceType, ReferenceImage>),
    lighting: {
      positions: new Array(8).fill(false),
    },
    subjects: {
      a: { x: 0, z: 12, rotation: 180, gaze: 180 },
      b: { x: 10, z: 25, rotation: 180, gaze: 180 },
      activeCount: 1,
    },
    cameras: [
      {
        id: 'cam-1',
        x: 0,
        z: 0,
        rotation: 0,
        model: CAMERA_MODELS[0],
        lens: LENSES[2].label, // 50mm
        verticalAngle: VERTICAL_ANGLES[1],
      }
    ],
    activeCameraIndex: 0,
    isGenerating: false,
    isGeneratingPrompt: false,
    isReviewingPrompt: false,
    draftPrompt: '',
    plannerZoom: 1.0,
  });

  // Check for API key selection on mount - mandatory requirement for gemini-3-pro-image-preview
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // Fallback for non-AI Studio environments where process.env.API_KEY is assumed valid
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  // Handle opening the API key selection dialog
  const handleOpenSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Assume success after triggering to mitigate race conditions as per guidelines
      setHasApiKey(true);
    }
  };

  const activeCamera = state.cameras[state.activeCameraIndex];
  const [promptView, setPromptView] = useState<'text' | 'json'>('text');

  // PHYSICAL SHOT SCALE CALCULATION
  // Formula: Frame Height = (Sensor Height * Distance) / Focal Length
  // Full Frame Sensor Height = 24mm
  const inferredShotScale = useMemo(() => {
    const mm = LENSES.find(l => l.label === activeCamera.lens)?.mm || 50;
    const dx = state.subjects.a.x - activeCamera.x;
    const dz = state.subjects.a.z - activeCamera.z;
    const distInFeet = Math.sqrt(dx * dx + dz * dz);
    const distInMm = distInFeet * 304.8;
    
    const frameHeightInMm = (24 * distInMm) / mm;
    const frameHeightInFeet = frameHeightInMm / 304.8;

    if (frameHeightInFeet < 1.5) return "Extreme Close Up (ECU)";
    if (frameHeightInFeet < 4) return "Close Up (CU)";
    if (frameHeightInFeet < 9) return "Medium Shot (MS)";
    if (frameHeightInFeet < 25) return "Long Shot (LS)";
    return "Wide Shot (WS)";
  }, [activeCamera, state.subjects.a]);

  const handleUpload = (type: ReferenceType, dataUrl: string, mimeType: string) => {
    setState(prev => ({
      ...prev,
      references: { ...prev.references, [type]: { ...prev.references[type], dataUrl, mimeType } }
    }));
  };

  const updateSubject = (id: 'a' | 'b', updates: Partial<SubjectConfig>) => {
    setState(prev => ({
      ...prev,
      subjects: {
        ...prev.subjects,
        [id]: { ...prev.subjects[id], ...updates }
      }
    }));
  };

  const updateCamera = (index: number, updates: Partial<CameraConfig>) => {
    setState(prev => {
      const newCameras = [...prev.cameras];
      newCameras[index] = { ...newCameras[index], ...updates };
      return { ...prev, cameras: newCameras };
    });
  };

  const addCamera = () => {
    if (state.cameras.length >= 4) return;
    const newCam: CameraConfig = {
      ...activeCamera,
      id: `cam-${Date.now()}`,
      x: activeCamera.x + 10,
      z: activeCamera.z
    };
    setState(prev => ({
      ...prev,
      cameras: [...prev.cameras, newCam],
      activeCameraIndex: prev.cameras.length
    }));
  };

  const handleGeneratePrompt = async () => {
    setState(prev => ({ ...prev, isGeneratingPrompt: true }));
    try {
      const prompt = await generateDraftPrompt({ ...state, inferredShotScale });
      setState(prev => ({ ...prev, draftPrompt: prompt, isGeneratingPrompt: false, isReviewingPrompt: true }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ ...prev, isGeneratingPrompt: false }));
    }
  };

  const handleFinalRender = async () => {
    setState(prev => ({ ...prev, isGenerating: true, isReviewingPrompt: false }));
    try {
      const result = await generateStudioImage({ ...state, inferredShotScale }, state.draftPrompt);
      setState(prev => ({ ...prev, generatedImage: result, isGenerating: false }));
    } catch (err: any) {
      console.error(err);
      // Reset key selection and prompt user if API key selection is invalidated or quota exceeded
      const errMsg = err.message || "";
      if (
        errMsg.includes("Requested entity was not found.") || 
        errMsg.includes("RESOURCE_EXHAUSTED") || 
        errMsg.includes("quota exceeded")
      ) {
        setHasApiKey(false);
        alert("Your current API key has no quota for this model or is invalid. Please select a key from a paid Google Cloud project.");
        await handleOpenSelectKey();
      }
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const openImageInNewWindow = () => {
    if (!state.generatedImage) return;
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`
        <body style="margin:0; background:#000; display:flex; align-items:center; justify-content:center;">
          <img src="${state.generatedImage}" style="max-width:100%; max-height:100%;" />
        </body>
      `);
    }
  };

  // Mandatory API key selection screen before accessing the main application
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-10 text-center space-y-8 shadow-2xl">
          <div className="bg-indigo-600/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/20">
            <Key className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-tight">API Key Required</h1>
            <p className="text-white/40 text-sm leading-relaxed">
              To use professional cinematic image generation, you must select an API key from a Google Cloud project with the Gemini API enabled.
            </p>
          </div>
          <button 
            onClick={handleOpenSelectKey}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
          >
            Select API Key
          </button>
          <p className="text-[10px] text-white/20 uppercase tracking-widest">
            More info at <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">ai.google.dev/gemini-api/docs/billing</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col overflow-hidden text-white">
      <header className="border-b border-white/5 p-3 bg-[#0a0a0a]/95 backdrop-blur-md flex items-center justify-between sticky top-0 z-[100]">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/20">
            <Camera className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase">Physicist Studio</h1>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-bold">Physical Units: FT</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!state.isReviewingPrompt && !state.generatedImage && (
            <button
              onClick={handleGeneratePrompt}
              disabled={state.isGeneratingPrompt}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 uppercase tracking-widest"
            >
              {state.isGeneratingPrompt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>{state.isGeneratingPrompt ? 'Calculating Optics...' : 'Prepare Render'}</span>
            </button>
          )}

          {state.isReviewingPrompt && (
            <button onClick={handleFinalRender} className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 animate-pulse uppercase tracking-widest">
              <Check className="w-3.5 h-3.5" />
              <span>Initiate Render</span>
            </button>
          )}

          {state.generatedImage && (
            <button onClick={() => setState(prev => ({ ...prev, generatedImage: undefined, isReviewingPrompt: false }))} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-white/5 hover:bg-white/10 uppercase tracking-widest border border-white/5">
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reset Scene</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-72 bg-[#0a0a0a] border-r border-white/5 flex flex-col shrink-0 custom-scrollbar overflow-y-auto">
          <div className="p-4 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Assets</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(REFERENCE_SLOTS.filter(s => state.subjects.activeCount === 2 || !s.id.includes('_b'))).map((slot) => (
                  <ReferenceUploader
                    key={slot.id}
                    slot={slot}
                    dataUrl={state.references[slot.id].dataUrl}
                    onUpload={(data, mime) => handleUpload(slot.id, data, mime)}
                    onRemove={() => setState(prev => ({ ...prev, references: { ...prev.references, [slot.id]: { ...prev.references[slot.id], dataUrl: undefined } } }))}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Light Rig</h2>
              </div>
              <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                <LightRig 
                  activePositions={state.lighting.positions}
                  onToggle={(i) => setState(prev => {
                    const next = [...prev.lighting.positions];
                    next[i] = !next[i];
                    return { ...prev, lighting: { positions: next } };
                  })}
                  orientation={state.subjects.a.rotation} 
                />
              </div>
            </section>
          </div>
        </aside>

        <section className="flex-1 bg-black relative flex flex-col overflow-hidden">
          <div className="absolute top-6 left-6 z-[160] flex flex-col gap-2">
             <button onClick={() => setState(p => ({...p, plannerZoom: Math.min(10, p.plannerZoom * 1.5)}))} className="p-2 bg-[#0d0d0d] border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all">
               <ZoomIn className="w-4 h-4" />
             </button>
             <button onClick={() => setState(p => ({...p, plannerZoom: Math.max(0.01, p.plannerZoom / 1.5)}))} className="p-2 bg-[#0d0d0d] border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all">
               <ZoomOut className="w-4 h-4" />
             </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center p-8">
             <FloorPlanner 
                state={state}
                onUpdateSubject={updateSubject}
                onUpdateCamera={updateCamera}
                onSelectCamera={(idx) => setState(prev => ({ ...prev, activeCameraIndex: idx }))}
             />

             {/* Dynamic Shot Info Overlay */}
             <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[#0d0d0d]/80 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="flex flex-col">
                   <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Scale</span>
                   <span className="text-[10px] font-black text-white uppercase tracking-widest">{inferredShotScale}</span>
                </div>
                <div className="w-px h-6 bg-white/5"></div>
                <div className="flex flex-col">
                   <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Sub A Z-Dist</span>
                   <span className="text-[10px] font-mono text-indigo-400 font-bold">{Math.round(state.subjects.a.z)} ft</span>
                </div>
             </div>

             {(state.isGenerating || state.isGeneratingPrompt) && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Wand2 className="w-6 h-6 text-indigo-400 animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.3em] text-white">Synthesizing Physics...</p>
                </div>
             )}

             {state.isReviewingPrompt && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-lg z-[200] flex items-center justify-center p-8">
                  <div className="w-full max-w-4xl bg-[#0d0d0d] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl flex flex-col max-h-[90%] overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex gap-2">
                        <button onClick={() => setPromptView('text')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${promptView === 'text' ? 'bg-indigo-600' : 'bg-white/5 text-white/40'}`}>Script</button>
                        <button onClick={() => setPromptView('json')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${promptView === 'json' ? 'bg-indigo-600' : 'bg-white/5 text-white/40'}`}>Stage Data</button>
                      </div>
                      <button onClick={() => setState(prev => ({ ...prev, isReviewingPrompt: false }))} className="p-2 bg-white/5 rounded-xl text-white/40"><X className="w-5 h-5" /></button>
                    </div>
                    <textarea
                      readOnly={promptView === 'json'}
                      value={promptView === 'text' ? (JSON.parse(state.draftPrompt).script || state.draftPrompt) : state.draftPrompt}
                      className="flex-1 bg-black/40 rounded-3xl p-8 text-sm font-mono border border-white/5 focus:outline-none resize-none custom-scrollbar"
                    />
                    <button onClick={handleFinalRender} className="mt-8 py-4 bg-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all">Generate Final Render</button>
                  </div>
                </div>
             )}

             {state.generatedImage && (
                <div className="absolute top-6 right-6 z-[150] animate-in slide-in-from-right duration-500">
                   <div className="relative group">
                      <div className="w-56 aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl cursor-pointer" onClick={openImageInNewWindow}>
                        <img src={state.generatedImage} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                           <Maximize2 className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <button onClick={() => setState(prev => ({ ...prev, generatedImage: undefined }))} className="absolute -top-3 -right-3 p-2 bg-red-600 text-white rounded-lg shadow-xl"><Trash2 className="w-3 h-3" /></button>
                   </div>
                </div>
             )}
          </div>

          {/* Bottom Controls */}
          <div className="p-8 grid grid-cols-2 gap-8 pointer-events-none relative z-[100]">
             <div className="bg-[#0a0a0a]/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 pointer-events-auto">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                   <Compass className="w-4 h-4 text-indigo-400" />
                   <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Body Rotation</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <OrientationSlider config={state.subjects.a} activeCamera={activeCamera} onChange={(val) => updateSubject('a', { rotation: val })} />
                   {state.subjects.activeCount === 2 ? (
                      <OrientationSlider config={state.subjects.b} activeCamera={activeCamera} onChange={(val) => updateSubject('b', { rotation: val })} />
                   ) : <div className="flex items-center justify-center text-[8px] text-white/10 italic">Sub B Offline</div>}
                </div>
             </div>
             
             <div className="bg-[#0a0a0a]/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 pointer-events-auto">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                   <Eye className="w-4 h-4 text-emerald-400" />
                   <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Gaze</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <GazeSelector subjectId="a" config={state.subjects.a} activeCamera={activeCamera} onChange={(val) => updateSubject('a', { gaze: val })} />
                   {state.subjects.activeCount === 2 ? (
                      <GazeSelector subjectId="b" config={state.subjects.b} activeCamera={activeCamera} otherSubject={state.subjects.a} onChange={(val) => updateSubject('b', { gaze: val })} />
                   ) : <div className="flex items-center justify-center text-[8px] text-white/10 italic">Sub B Offline</div>}
                </div>
             </div>
          </div>
        </section>

        <aside className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col shrink-0 custom-scrollbar overflow-y-auto">
          <div className="p-4 space-y-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Cameras</h2>
                </div>
                <button onClick={addCamera} disabled={state.cameras.length >= 4} className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {state.cameras.map((cam, idx) => (
                  <button key={cam.id} onClick={() => setState(prev => ({ ...prev, activeCameraIndex: idx }))} className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all ${state.activeCameraIndex === idx ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10 text-white/30'}`}>CAM {idx + 1}</button>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Optics</h2>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Focal Length</label>
                   <select value={activeCamera.lens} onChange={(e) => updateCamera(state.activeCameraIndex, { lens: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/60 appearance-none">
                     {LENSES.map(l => <option key={l.label} value={l.label} className="bg-[#0d0d0d]">{l.label}</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Angle</label>
                   <select value={activeCamera.verticalAngle} onChange={(e) => updateCamera(state.activeCameraIndex, { verticalAngle: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/60 appearance-none">
                     {VERTICAL_ANGLES.map(a => <option key={a} value={a} className="bg-[#0d0d0d]">{a}</option>)}
                   </select>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[9px] text-white/30 uppercase tracking-widest font-black">Subject Count</label>
                <div className="flex gap-2 p-1 bg-black rounded-xl">
                  <button onClick={() => setState(prev => ({ ...prev, subjects: { ...prev.subjects, activeCount: 1 } }))} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${state.subjects.activeCount === 1 ? 'bg-indigo-600' : 'text-white/20'}`}>SOLO</button>
                  <button onClick={() => setState(prev => ({ ...prev, subjects: { ...prev.subjects, activeCount: 2 } }))} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${state.subjects.activeCount === 2 ? 'bg-indigo-600' : 'text-white/20'}`}>DUO</button>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;