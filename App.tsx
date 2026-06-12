
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Camera, Layers, Wand2, Loader2, X, Play, Download, 
  MonitorPlay, Users, Landmark as LandmarkIcon, 
  Sun, Copy, Check, Plus, Trash2, MapPin, ScanSearch,
  Maximize, Minus, Search, ChevronDown, ChevronUp, FileCode, Braces
} from 'lucide-react';
import { StudioState, ReferenceType, SubjectConfig, Landmark } from './types';
import { CAMERA_MODELS, LENSES, VERTICAL_ANGLES, COST_PER_IMAGE, COST_PER_VIDEO, PRODUCTION_SCALE_CONSTANT } from './constants';
import ReferenceUploader from './components/ReferenceUploader';
import FloorPlanner from './components/FloorPlanner';
import OrientationSlider from './components/OrientationSlider';
import GazeSelector from './components/GazeSelector';
import CameraViewfinder from './components/CameraViewfinder';
import LightRig from './components/LightRig';
import { generateDraftPrompt, generateStudioImage, generateStudioVideo, analyzeBackground } from './services/geminiService';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isViewfinderOpen, setIsViewfinderOpen] = useState(true);
  const [copying, setCopying] = useState(false);
  const [activeTab, setActiveTab] = useState<'talent' | 'scenery'>('talent');
  const [isAnalyzingBackground, setIsAnalyzingBackground] = useState(false);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>('sub-1');

  const createInitialReferences = (id: string, label: string): SubjectConfig['references'] => ({
    character: { id: 'character', label: 'Face' },
    costume: { id: 'costume', label: 'Costume' },
    pose: { id: 'pose', label: 'Pose' },
  });

  const [state, setState] = useState<StudioState>({
    references: {
      background: { id: 'background', label: 'Background' },
      prop: { id: 'prop', label: 'Prop' },
      accessories: { id: 'accessories', label: 'Accessories' },
      character: { id: 'character', label: 'Character' },
      costume: { id: 'costume', label: 'Costume' },
      pose: { id: 'pose', label: 'Pose' },
    },
    lighting: { positions: new Array(8).fill(false) },
    subjects: [{ 
      id: 'sub-1', 
      x: 0, 
      z: 12, 
      rotation: 180, 
      gaze: 180, 
      label: 'Protagonist',
      references: createInitialReferences('sub-1', 'Protagonist')
    }],
    landmarks: [],
    cameras: [{
      id: 'cam-1', x: 0, z: 0, rotation: 0,
      model: CAMERA_MODELS[0], lens: LENSES[2].label, verticalAngle: VERTICAL_ANGLES[1],
    }],
    activeCameraIndex: 0,
    isGenerating: false,
    isGeneratingPrompt: false,
    isReviewingPrompt: false,
    isReviewingVideoPrompt: false,
    isGeneratingVideo: false,
    draftPrompt: '',
    plannerZoom: 0.8,
    plannerOffset: { x: 0, z: -15 },
    usage: { totalSpent: 0, analysis: 0, render: 0, video: 0, tokens: 0 },
  });

  const activeCamera = state.cameras[state.activeCameraIndex];
  
  const calculatedStats = useMemo(() => {
    const mm = LENSES.find(l => l.label === activeCamera.lens)?.mm || 50;
    const sub = state.subjects[0] || { x: 0, z: 10 };
    const dx = sub.x - activeCamera.x;
    const dz = sub.z - activeCamera.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    const heightPercent = (PRODUCTION_SCALE_CONSTANT * mm) / Math.max(0.1, dist);

    let label = "Wide Shot (WS)";
    if (heightPercent > 350) label = "Extreme Close Up (ECU)";
    else if (heightPercent > 160) label = "Close Up (CU)";
    else if (heightPercent > 140) label = "Medium Close Up (MCU)";
    else if (heightPercent > 55) label = "Medium Shot (MS)";
    else if (heightPercent > 30) label = "Medium Long Shot (MLS)";
    else if (heightPercent > 10) label = "Long Shot (LS)";

    return { label, percent: heightPercent.toFixed(1) };
  }, [activeCamera, state.subjects]);

  const updateSubject = (id: string, updates: Partial<SubjectConfig>) => {
    setState(s => ({
      ...s,
      subjects: s.subjects.map(sub => sub.id === id ? { ...sub, ...updates } : sub)
    }));
  };

  const updateSubjectReference = (subId: string, refId: ReferenceType, url: string, mime: string) => {
    setState(s => ({
      ...s,
      subjects: s.subjects.map(sub => {
        if (sub.id !== subId) return sub;
        const newRefs = { ...sub.references };
        newRefs[refId] = { id: refId, label: newRefs[refId]?.label || refId, dataUrl: url, mimeType: mime };
        return { ...sub, references: newRefs };
      })
    }));
  };

  const updateLandmark = (id: string, updates: Partial<Landmark>) => {
    setState(s => ({
      ...s,
      landmarks: s.landmarks.map(lm => lm.id === id ? { ...lm, ...updates } : lm)
    }));
  };

  const handleAssetUpload = async (id: ReferenceType, url: string, mime: string) => {
    setState(s => ({
      ...s,
      references: { ...s.references, [id]: { ...s.references[id], dataUrl: url, mimeType: mime } }
    }));

    if (id === 'background') {
      setIsAnalyzingBackground(true);
      setActiveTab('scenery');
      try {
        const detected = await analyzeBackground(url);
        const newLandmarks: Landmark[] = detected.map((d, i) => ({
          id: `detected-${Date.now()}-${i}`,
          label: d.label || 'Feature',
          description: d.description || '',
          x: d.x ?? 0,
          z: d.z ?? 50
        }));
        setState(s => ({ ...s, landmarks: newLandmarks }));
      } catch (e) {
        console.error("Background analysis failed", e);
      } finally {
        setIsAnalyzingBackground(false);
      }
    }
  };

  const handleGeneratePrompt = async () => {
    setState(s => ({ ...s, isGeneratingPrompt: true }));
    try {
      const { script, cost, tokens } = await generateDraftPrompt(state);
      setState(s => ({ 
        ...s, 
        draftPrompt: script, 
        isReviewingPrompt: true, 
        isGeneratingPrompt: false,
        usage: { 
          ...s.usage, 
          totalSpent: s.usage.totalSpent + cost,
          tokens: s.usage.tokens + tokens,
          analysis: s.usage.analysis + cost
        } 
      }));
    } catch (e) {
      alert("Scripting synthesis failed.");
      setState(s => ({ ...s, isGeneratingPrompt: false }));
    }
  };

  const formattedJsonPrompt = useMemo(() => {
    try {
      const parsed = JSON.parse(state.draftPrompt);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return state.draftPrompt;
    }
  }, [state.draftPrompt]);

  return (
    <div className="flex flex-col md:flex-row h-screen h-[100dvh] bg-[#050505] text-white overflow-hidden selection:bg-indigo-500/30">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#0d0d0d] border-b border-white/5 z-50">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="w-5 h-5 text-indigo-500" />
          <h1 className="text-sm font-black tracking-tighter uppercase">Studio AI</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsViewfinderOpen(!isViewfinderOpen)} className={`p-2 rounded-lg border transition-all ${isViewfinderOpen ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
            <MonitorPlay className="w-4 h-4" />
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-indigo-600 rounded-lg text-white">
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      <aside className={`fixed inset-0 md:relative z-[60] md:z-10 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 md:translate-x-0 w-full md:w-[380px] lg:w-[420px] bg-[#0d0d0d] flex flex-col border-r border-white/5 shadow-2xl`}>
        <header className="p-5 md:p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <LandmarkIcon className="w-6 h-6 md:w-7 md:h-7 text-indigo-500" />
            <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase">Studio AI</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white/40 md:hidden"><X /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-8 custom-scrollbar">
          <div className="flex bg-white/5 p-1 rounded-xl gap-1 ring-1 ring-white/5">
            <button onClick={() => setActiveTab('talent')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'talent' ? 'bg-indigo-600 shadow-lg text-white' : 'hover:bg-white/5 text-white/40'}`}>Talent</button>
            <button onClick={() => setActiveTab('scenery')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'scenery' ? 'bg-indigo-600 shadow-lg text-white' : 'hover:bg-white/5 text-white/40'}`}>Scenery</button>
          </div>

          {activeTab === 'talent' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3 h-3" /> Production Cast
                </h2>
                <button 
                  onClick={() => {
                    const id = `sub-${Date.now()}`;
                    setState(s => ({ ...s, subjects: [...s.subjects, { 
                      id, x: (Math.random()-0.5)*10, z: 15, rotation: 180, gaze: 180, 
                      label: `Talent ${s.subjects.length + 1}`, references: createInitialReferences(id, `Talent ${s.subjects.length + 1}`)
                    }] }));
                    setExpandedSubjectId(id);
                  }} 
                  className="p-1.5 bg-indigo-600 rounded-lg hover:scale-110 transition-transform shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                {state.subjects.map((sub) => (
                  <div key={sub.id} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden shadow-inner group">
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpandedSubjectId(expandedSubjectId === sub.id ? null : sub.id)}>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                        <input value={sub.label} onClick={(e) => e.stopPropagation()} onChange={(e) => updateSubject(sub.id, { label: e.target.value })} className="bg-transparent text-xs font-bold focus:outline-none focus:text-indigo-400 w-full" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, subjects: s.subjects.filter(x => x.id !== sub.id) })); }} className="text-white/10 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3 h-3" /></button>
                        {expandedSubjectId === sub.id ? <ChevronUp className="w-4 h-4 text-white/20" /> : <ChevronDown className="w-4 h-4 text-white/20" />}
                      </div>
                    </div>
                    {expandedSubjectId === sub.id && (
                      <div className="p-4 pt-0 space-y-5 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3">
                          <h3 className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Subject References</h3>
                          <div className="grid grid-cols-3 gap-2">
                            <ReferenceUploader slot={{ id: 'character', label: 'Face' }} dataUrl={sub.references.character?.dataUrl} onUpload={(url, mime) => updateSubjectReference(sub.id, 'character', url, mime)} onRemove={() => updateSubjectReference(sub.id, 'character', '', '')} />
                            <ReferenceUploader slot={{ id: 'costume', label: 'Costume' }} dataUrl={sub.references.costume?.dataUrl} onUpload={(url, mime) => updateSubjectReference(sub.id, 'costume', url, mime)} onRemove={() => updateSubjectReference(sub.id, 'costume', '', '')} />
                            <ReferenceUploader slot={{ id: 'pose', label: 'Pose' }} dataUrl={sub.references.pose?.dataUrl} onUpload={(url, mime) => updateSubjectReference(sub.id, 'pose', url, mime)} onRemove={() => updateSubjectReference(sub.id, 'pose', '', '')} />
                          </div>
                        </div>
                        <div className="space-y-4 pt-2 border-t border-white/5">
                           <OrientationSlider config={sub} activeCamera={activeCamera} onChange={(v) => updateSubject(sub.id, { rotation: v })} />
                           <GazeSelector subjectId={sub.label.substring(0,1).toLowerCase() as any} config={sub} activeCamera={activeCamera} onChange={(v) => updateSubject(sub.id, { gaze: v })} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> Environmental Anchors
                </h2>
                <button onClick={() => setState(s => ({ ...s, landmarks: [...s.landmarks, { id: `lm-${Date.now()}`, label: 'New Landmark', description: 'Background feature...', x: (Math.random()-0.5)*40, z: 60 }] }))} className="p-1.5 bg-emerald-600 rounded-lg hover:scale-110 transition-transform shadow-lg"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                {state.landmarks.map(lm => (
                  <div key={lm.id} className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3 shadow-inner group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <MapPin className="w-3 h-3 text-emerald-500" />
                        <input value={lm.label} onChange={(e) => updateLandmark(lm.id, { label: e.target.value })} className="bg-transparent text-xs font-bold focus:outline-none focus:text-emerald-400 w-full" />
                      </div>
                      <button onClick={() => setState(s => ({ ...s, landmarks: s.landmarks.filter(x => x.id !== lm.id) }))} className="text-white/10 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <textarea value={lm.description} onChange={(e) => updateLandmark(lm.id, { description: e.target.value })} className="w-full bg-black/40 border border-white/5 rounded-lg p-2 text-[10px] text-white/60 focus:outline-none min-h-[60px] custom-scrollbar focus:border-emerald-500/20" placeholder="Describe feature..." />
                  </div>
                ))}
              </div>
              <div className="pt-4 space-y-4 border-t border-white/5">
                <h2 className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2"><Layers className="w-3 h-3" /> Global Scene Assets</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  <ReferenceUploader slot={{ id: 'background', label: 'Background' }} dataUrl={state.references.background.dataUrl} onUpload={(url, mime) => handleAssetUpload('background', url, mime)} onRemove={() => handleAssetUpload('background', '', '')} />
                  <ReferenceUploader slot={{ id: 'prop', label: 'Key Prop' }} dataUrl={state.references.prop.dataUrl} onUpload={(url, mime) => handleAssetUpload('prop', url, mime)} onRemove={() => handleAssetUpload('prop', '', '')} />
                </div>
              </div>
            </div>
          )}

          <section className="bg-white/5 p-4 md:p-5 rounded-2xl border border-white/10 space-y-5">
            <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2"><Camera className="w-3 h-3" /> Camera Settings</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[8px] font-bold text-white/30 uppercase ml-1">Lens System</label>
                <select value={activeCamera.lens} onChange={(e) => { const n = [...state.cameras]; n[state.activeCameraIndex] = { ...n[state.activeCameraIndex], lens: e.target.value }; setState(s => ({ ...s, cameras: n })); }} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/50 outline-none appearance-none">
                  {LENSES.map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
                </select>
              </div>
              <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-1">
                <div className="flex justify-between items-center text-[8px] font-black text-indigo-400 uppercase tracking-widest">
                  <span>Perspective Scale</span>
                  <span>{calculatedStats.percent}% Height</span>
                </div>
                <div className="text-sm font-black text-white uppercase tracking-tighter">{calculatedStats.label}</div>
              </div>
            </div>
          </section>

          <section className="space-y-4 pb-10">
            <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2"><Sun className="w-3 h-3" /> Production Lighting</h2>
            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
              <LightRig activePositions={state.lighting.positions} onToggle={(idx) => setState(s => { const np = [...s.lighting.positions]; np[idx] = !np[idx]; return { ...s, lighting: { ...s.lighting, positions: np } }; })} orientation={state.subjects[0]?.rotation || 180} />
            </div>
          </section>
        </div>

        <footer className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-xl">
          <button onClick={handleGeneratePrompt} disabled={state.isGeneratingPrompt} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] group">
            {state.isGeneratingPrompt ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
            <span className="font-black text-sm uppercase tracking-widest">Execute Scripting</span>
          </button>
        </footer>
      </aside>

      <main className="flex-1 flex flex-col relative bg-[#050505] min-h-0">
        <div className="flex-1 p-3 md:p-8 flex flex-col min-h-0 overflow-hidden relative">
          <div className="flex-1 min-h-0 border border-white/5 md:rounded-[2.5rem] bg-[#080808] relative overflow-hidden shadow-2xl flex flex-col rounded-2xl">
            <FloorPlanner state={state} onUpdateSubject={updateSubject} onUpdateLandmark={updateLandmark} onUpdateCamera={(idx, updates) => setState(s => { const n = [...s.cameras]; n[idx] = { ...n[idx], ...updates }; return { ...s, cameras: n }; })} onUpdatePlanner={(u) => setState(s => ({ ...s, ...u }))} onSelectCamera={(idx) => setState(s => ({ ...s, activeCameraIndex: idx }))} />
            {isViewfinderOpen && (
              <div className="absolute top-3 right-3 md:top-6 md:right-6 w-44 sm:w-80 z-40 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none">
                <div className="bg-black/80 p-1 rounded-xl md:rounded-2xl border border-white/20 backdrop-blur-2xl shadow-2xl ring-1 ring-black/50 overflow-hidden pointer-events-auto">
                  <CameraViewfinder state={state} inferredScale={calculatedStats.label} />
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 flex flex-col gap-2 pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-2 flex flex-col gap-2 shadow-2xl pointer-events-auto">
                <button onClick={() => setState(s => ({ ...s, plannerZoom: Math.min(5, s.plannerZoom * 1.3) }))} className="p-3 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all active:scale-90"><Search className="w-5 h-5" /></button>
                <div className="h-px bg-white/10 mx-2" />
                <button onClick={() => setState(s => ({ ...s, plannerZoom: Math.max(0.1, s.plannerZoom / 1.3) }))} className="p-3 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all active:scale-90"><Minus className="w-5 h-5" /></button>
                <div className="h-px bg-white/10 mx-2" />
                <button onClick={() => setState(s => ({ ...s, plannerZoom: 0.8, plannerOffset: { x: 0, z: -15 } }))} className="p-3 hover:bg-white/10 rounded-xl text-indigo-400 hover:text-indigo-300 transition-all active:scale-90"><Maximize className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Prompt Review Overlay - Focused JSON Manifest */}
        {state.isReviewingPrompt && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="bg-[#111] w-full max-w-3xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Braces className="w-5 h-5 text-indigo-400" /></div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Render Manifest</h3>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">JSON blueprint with scale data</p>
                  </div>
                </div>
                <button onClick={() => setState(s => ({ ...s, isReviewingPrompt: false }))} className="p-2 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-[#0a0a0a]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                      <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">JSON PROMPT</span>
                    </div>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(formattedJsonPrompt); setCopying(true); setTimeout(() => setCopying(false), 2000); }} 
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-[11px] font-black uppercase text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95 group"
                    >
                      {copying ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                      {copying ? 'COPIED' : 'COPY MANIFEST'}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute top-0 right-0 p-4 pointer-events-none opacity-20"><FileCode className="w-8 h-8 text-indigo-500" /></div>
                    <pre className="bg-[#050505] border border-white/10 rounded-[1.5rem] p-6 font-mono text-[11px] md:text-xs text-indigo-300 leading-relaxed overflow-x-auto shadow-inner custom-scrollbar-horizontal">
                      {formattedJsonPrompt}
                    </pre>
                  </div>
                </div>
              </div>

              <footer className="p-8 border-t border-white/5 bg-black/40 flex gap-4">
                <button onClick={() => setState(s => ({ ...s, isReviewingPrompt: false }))} className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all">RECONFIGURE</button>
                <button 
                  disabled={state.isGenerating}
                  onClick={async () => { 
                    setState(s => ({ ...s, isGenerating: true })); 
                    try {
                      const { url, cost } = await generateStudioImage(state, state.draftPrompt); 
                      setState(s => ({ ...s, generatedImage: url, isGenerating: false, isReviewingPrompt: false, isReviewingVideoPrompt: true, usage: { ...s.usage, totalSpent: s.usage.totalSpent + cost, render: s.usage.render + cost } })); 
                    } catch (e) {
                      alert("Production stall: Engine timed out.");
                      setState(s => ({ ...s, isGenerating: false }));
                    }
                  }} 
                  className="flex-[2] bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {state.isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MonitorPlay className="w-5 h-5" />}
                  <span className="text-sm uppercase tracking-tighter">COMMIT FINAL RENDER</span>
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Video Preview Overlay */}
        {state.isReviewingVideoPrompt && state.generatedImage && (
          <div className="fixed inset-0 z-[100] bg-black p-4 md:p-8 flex items-center justify-center animate-in zoom-in-95 duration-500">
            <button onClick={() => setState(s => ({ ...s, isReviewingVideoPrompt: false }))} className="absolute top-6 right-6 text-white/20 hover:text-white transition-all p-3 hover:bg-white/5 rounded-full z-[110]"><X className="w-8 h-8" /></button>
            <div className="w-full max-w-6xl aspect-video rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative bg-[#111]">
               <img src={state.generatedImage} className="w-full h-full object-contain" alt="Rendered Preview" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-end p-6 md:p-12">
                  <div className="max-w-3xl space-y-6">
                    <div className="space-y-2">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Master Still Confirmed</h4>
                       <p className="text-lg md:text-xl font-light italic text-white/80 leading-snug line-clamp-2">Composition locked. Coordinates validated. Ready for motion synthesis.</p>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => { const link = document.createElement('a'); link.href = state.generatedImage!; link.download = `studio-render-${Date.now()}.png`; link.click(); }} className="bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white font-black px-8 py-4 rounded-xl flex items-center gap-3 transition-all"><Download className="w-5 h-5" /> Download Still</button>
                      <button 
                        disabled={state.isGeneratingVideo}
                        onClick={async () => {
                          setState(s => ({ ...s, isGeneratingVideo: true, videoStatus: 'Warming Veo Cores...' }));
                          try {
                            const { url, cost } = await generateStudioVideo(state, state.draftPrompt, state.generatedImage!, (s) => setState(prev => ({ ...prev, videoStatus: s })));
                            setState(s => ({ ...s, generatedVideo: url, isGeneratingVideo: false, usage: { ...s.usage, totalSpent: s.usage.totalSpent + cost, video: s.usage.video + cost } }));
                          } catch (e) {
                            alert("Veo synthesis interrupted.");
                            setState(s => ({ ...s, isGeneratingVideo: false }));
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-xl flex items-center gap-3 shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50"
                      >
                        {state.isGeneratingVideo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        {state.isGeneratingVideo ? state.videoStatus : "Synthesize Motion"}
                      </button>
                    </div>
                  </div>
               </div>
               {state.generatedVideo && (
                 <div className="absolute inset-0 z-[120] bg-black animate-in fade-in duration-1000">
                    <video src={state.generatedVideo} controls autoPlay loop className="w-full h-full object-contain" />
                    <button onClick={() => setState(s => ({ ...s, generatedVideo: undefined }))} className="absolute top-6 left-6 bg-white/10 hover:bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/10 flex items-center gap-3 font-black uppercase text-xs"><Minus className="w-4 h-4" /> REVEAL STILL</button>
                 </div>
               )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
