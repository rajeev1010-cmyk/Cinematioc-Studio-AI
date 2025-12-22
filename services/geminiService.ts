import { GoogleGenAI } from "@google/genai";
import { StudioState, CameraConfig, SubjectConfig } from "../types";
import { LIGHT_POSITIONS } from "../constants";

/**
 * CINEMATIC PHYSICAL COORDINATE SYSTEM:
 * 1 Unit = 1 Foot (Standard height of human subject: 5.5 - 6.0 units)
 * World X: Stage Left (-) to Stage Right (+)
 * World Z: Distance from Camera Baseline (0) to Infinite Depth (+)
 * Rotation: 0° is North (Toward Deep Stage), 180° is South (Facing Camera)
 */

async function downscaleImage(dataUrl: string, maxWidth = 256, quality = 0.3): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        } else {
          width = (maxWidth / height) * width;
          height = maxWidth;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas context failed"));
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const scaledDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ data: scaledDataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

const getOrientationInstruction = (subj: SubjectConfig, camera: CameraConfig, label: string) => {
  const subjRot = (subj.rotation + 360) % 360;
  const camRot = (camera.rotation + 360) % 360;
  const relAngle = (subjRot - camRot + 360) % 360;

  if (relAngle > 165 && relAngle < 195) return `POSTURE: ${label} is facing DIRECTLY AT the camera lens.`;
  if (relAngle >= 195 && relAngle < 255) return `POSTURE: ${label} is in a 3/4 view, facing frame LEFT.`;
  if (relAngle >= 255 && relAngle < 285) return `POSTURE: ${label} is in PURE PROFILE, facing frame LEFT.`;
  if (relAngle >= 285 && relAngle < 345) return `POSTURE: ${label} is turned away (showing back-left).`;
  if (relAngle >= 345 || relAngle < 15) return `POSTURE: ${label} is facing COMPLETELY AWAY from camera.`;
  if (relAngle >= 15 && relAngle < 75) return `POSTURE: ${label} is turned away (showing back-right).`;
  if (relAngle >= 75 && relAngle < 105) return `POSTURE: ${label} is in PURE PROFILE, facing frame RIGHT.`;
  return `POSTURE: ${label} is in a 3/4 view, facing frame RIGHT.`;
};

const getGazeInstruction = (subj: SubjectConfig, other: SubjectConfig | null, camera: CameraConfig, label: string) => {
  const dx = camera.x - subj.x;
  const dz = camera.z - subj.z;
  const angleToCam = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
  const camDiff = Math.min(Math.abs(subj.gaze - angleToCam), 360 - Math.abs(subj.gaze - angleToCam));
  
  if (camDiff < 15) return `GAZE: ${label} is making direct eye contact with the lens.`;
  
  if (other) {
    const pdx = other.x - subj.x;
    const pdz = other.z - subj.z;
    const angleToPartner = (Math.atan2(pdx, pdz) * 180 / Math.PI + 360) % 360;
    const partnerDiff = Math.min(Math.abs(subj.gaze - angleToPartner), 360 - Math.abs(subj.gaze - angleToPartner));
    if (partnerDiff < 25) return `GAZE: ${label} is looking at the other subject.`;
  }
  return `GAZE: ${label} is looking into the distance, away from camera.`;
};

export const generateDraftPrompt = async (state: any): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];
  const activeCamera = state.cameras[state.activeCameraIndex];
  
  const bgRef = state.references['background'];
  if (bgRef?.dataUrl) {
    const { data, mimeType } = await downscaleImage(bgRef.dataUrl, 512, 0.4);
    parts.push({ text: "### STEP 1: GLOBAL WORLD SCALE ANALYSIS ###\nAnalyze this background. Is it a room (10-30ft deep) or a landscape (miles deep)?" });
    parts.push({ inlineData: { data, mimeType } });
  }

  const systemInstruction = `You are a Cinematographer and Physical Stage Analyst.
  
  BENCHMARK: 1 unit = 1 foot. Standard human height is 5.5 to 6.0 feet.
  
  MANDATORY DEPTH RULES:
  1. ANALYZE THE BACKGROUND: Look for visual cues (trees, horizon, buildings) to set the Z-axis scale.
  2. NO DEPTH CLIPPING: Subjects can be placed at Z=500 or Z=5000. If Z is high, render them as appropriately small specs in the distance.
  3. CHARACTER PROPORTION: A character at Z=10 is 6ft tall. At Z=1000, they are tiny.
  
  OUTPUT: JSON
  {
    "script": "A cinematic script describing the scene, lighting, and EXACT technical placement.",
    "scale_analysis": "Detailed notes on how the background determines the depth of the characters."
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { 
      parts: [
        ...parts, 
        { text: `STAGE TECHNICAL DATA:
          Framing: ${state.inferredShotScale}
          Optics: ${activeCamera.lens}, ${activeCamera.verticalAngle}
          Camera: X=${activeCamera.x}ft, Z=${activeCamera.z}ft
          
          SUBJECT A:
          - Location: X=${state.subjects.a.x}ft, Z=${state.subjects.a.z}ft
          - Height Benchmark: 5.8ft
          - ${getOrientationInstruction(state.subjects.a, activeCamera, "A")}
          - ${getGazeInstruction(state.subjects.a, state.subjects.activeCount === 2 ? state.subjects.b : null, activeCamera, "A")}
          
          SUBJECT B:
          - Location: ${state.subjects.activeCount === 2 ? `X=${state.subjects.b.x}ft, Z=${state.subjects.b.z}ft` : "N/A"}
          - Height Benchmark: 5.8ft
          - ${state.subjects.activeCount === 2 ? getOrientationInstruction(state.subjects.b, activeCamera, "B") : ""}` }
      ] 
    },
    config: { systemInstruction, responseMimeType: "application/json" }
  });
  return response.text || "";
};

export const generateStudioImage = async (state: any, draftJson: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const activeCamera = state.cameras[state.activeCameraIndex];
  let script = "";
  try { script = JSON.parse(draftJson).script; } catch(e) { script = draftJson; }

  const parts: any[] = [];
  const addRef = async (id: string, role: string) => {
    const ref = state.references[id];
    if (ref?.dataUrl) {
      const { data, mimeType } = await downscaleImage(ref.dataUrl, 1024, 0.5);
      parts.push({ text: `### [ASSET: ${id.toUpperCase()}] ROLE: ${role} ###` });
      parts.push({ inlineData: { data, mimeType } });
    }
  };

  await addRef('background', 'WORLD SCALE AND ENVIRONMENT PLATE.');
  await addRef('char_a', 'Visual Identity A');
  await addRef('pose_a', 'Reference Pose');

  const directive = `### FINAL PRODUCTION DIRECTIVE - PHYSICAL RENDER ###
  1. CORE SCRIPT: ${script}
  2. PHYSICAL DEPTH: Subject A is at Z=${state.subjects.a.z} feet. Benchmark height is 5.8 feet. 
  3. SCALE MATCH: If Z > 100 in a vast landscape, Subject A must be tiny. If Z < 20, they are close-up.
  4. PERSPECTIVE: Render from Camera X=${activeCamera.x}ft, Z=${activeCamera.z}ft looking toward ${activeCamera.rotation}°.
  5. INTEGRATION: Perfect 3D unified lighting and photorealistic integration. 8k resolution.`;

  parts.push({ text: directive });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { 
      imageConfig: { 
        aspectRatio: "16:9"
      } 
    }
  });

  const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!imgPart?.inlineData) throw new Error("Renderer Failure.");
  return `data:image/png;base64,${imgPart.inlineData.data}`;
};