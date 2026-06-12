
import { GoogleGenAI, Type } from "@google/genai";
import { StudioState, SubjectConfig, Landmark, ReferenceType } from "../types";
import { LENSES, PRODUCTION_SCALE_CONSTANT, COST_PER_IMAGE, COST_PER_VIDEO, COST_PER_1K_TOKENS } from "../constants";

async function downscaleImage(dataUrl: string, maxWidth = 512, quality = 0.7): Promise<{ data: string; mimeType: string }> {
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
      if (!ctx) return reject(new Error("Canvas context failure"));
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const scaledDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ data: scaledDataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error("Reference image load failed"));
    img.src = dataUrl;
  });
}

export const analyzeBackground = async (dataUrl: string): Promise<Partial<Landmark>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { data, mimeType } = await downscaleImage(dataUrl, 1024, 0.8);

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data, mimeType } },
        { text: "Identify key background landmarks. Provide labels, descriptions, and relative 3D positions (X: -30 to 30, Z: 20 to 100)." }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            description: { type: Type.STRING },
            x: { type: Type.NUMBER },
            z: { type: Type.NUMBER }
          },
          required: ["label", "description", "x", "z"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};

const getShotScaleLabel = (percentage: number) => {
  if (percentage > 350) return "Extreme Close Up (ECU)";
  if (percentage > 160) return "Close Up (CU)";
  if (percentage > 140) return "Medium Close Up (MCU)";
  if (percentage > 55) return "Medium Shot (MS)";
  if (percentage > 30) return "Medium Long Shot (MLS)";
  if (percentage > 10) return "Long Shot (LS)";
  return "Wide Shot (WS)";
};

export const generateDraftPrompt = async (state: StudioState): Promise<{ script: string; cost: number; tokens: number }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cam = state.cameras[state.activeCameraIndex];
  const focalLength = LENSES.find(l => l.label === cam.lens)?.mm || 50;
  
  const parts: any[] = [];
  
  // Attach grounding references
  for (const key of ['background', 'prop', 'accessories'] as ReferenceType[]) {
    if (state.references[key]?.dataUrl) {
      const { data, mimeType } = await downscaleImage(state.references[key].dataUrl!, 256, 0.4);
      parts.push({ text: `REFERENCE_GLOBAL_${key.toUpperCase()}:` }, { inlineData: { data, mimeType } });
    }
  }

  const subjectTags = [];
  for (const sub of state.subjects) {
    const dx = sub.x - cam.x;
    const dz = sub.z - cam.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    // Module 2: Scale Controller - Automatic frame height calculation
    const screenPercentage = (PRODUCTION_SCALE_CONSTANT * focalLength) / Math.max(0.1, dist);
    const shotLabel = getShotScaleLabel(screenPercentage);

    const angleToSub = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
    let relAngle = (angleToSub - cam.rotation + 540) % 360 - 180;
    const side = relAngle < 0 ? "FRAME_LEFT" : "FRAME_RIGHT";

    // Module 5: Orientation Visibility - Increase gesture if character is small
    const gestureMultiplier = screenPercentage < 18 ? "EXAGGERATED" : "NATURAL";

    for (const refKey of ['character', 'costume', 'pose'] as ReferenceType[]) {
      const ref = sub.references[refKey];
      if (ref?.dataUrl) {
        const { data, mimeType } = await downscaleImage(ref.dataUrl, 256, 0.4);
        parts.push({ text: `REFERENCE_SUBJECT_${sub.id.toUpperCase()}_${refKey.toUpperCase()}:` }, { inlineData: { data, mimeType } });
      }
    }

    subjectTags.push({
      id: sub.id,
      label: sub.label,
      visual_scale: {
        frame_height_percentage: `${screenPercentage.toFixed(1)}%`,
        cinematic_label: shotLabel
      },
      spatial_pos: { x: sub.x.toFixed(2), z: sub.z.toFixed(2), distance: `${dist.toFixed(1)}m` },
      orientation: { 
        body_yaw: `${sub.rotation.toFixed(0)}deg`, 
        gaze_yaw: `${sub.gaze.toFixed(0)}deg`,
        note: "0deg = Facing Camera (South), 180deg = Facing Away (North)"
      },
      framing_side: side,
      gesture_intent: gestureMultiplier
    });
  }

  const productionSystemInstruction = `
You are a VIRTUAL PRODUCTION RENDER ENGINE. Strictly follow this 6-module pipeline.

=== PRODUCTION_PIPELINE_MODULES ===
1. SCENE ANALYZER: Extract lighting profile (direction, softness, contrast, temperature) and perspective map (horizon_y, fov) from REF_GLOBAL_BACKGROUND.
2. SCALE CONTROLLER: Strictly set subject height using 'frame_height_percentage'. 
   - Character height must come from perspective depth, NOT 2D resizing.
3. LIGHTING ADAPTATION: Match subject lighting to the environment. 
4. LENS BEHAVIOR MATCHING: Simulate properties of ${focalLength}mm lens. 
5. ORIENTATION VISIBILITY: Strictly obey body_yaw and gaze_yaw.
   - ROTATION RULE: 0 degrees is facing DIRECTLY AT THE LENS (South). 180 degrees is facing AWAY FROM LENS (North).
6. INTEGRATION PASS: Unify subject and background.

=== RENDER_BLUEPRINT ===
- CAMERA: ${cam.model} | LENS: ${focalLength}mm
- SUBJECTS: ${JSON.stringify(subjectTags)}
- LANDMARKS: ${JSON.stringify(state.landmarks.map(lm => ({ label: lm.label, x: lm.x, z: lm.z })))}

Output ONLY a JSON Render Manifest.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { 
      parts: [...parts, { text: "Synthesize the Final Render Manifest JSON. Use all production modules. Ensure rotation is calculated such that 0deg faces the lens." }] 
    },
    config: { 
      systemInstruction: productionSystemInstruction,
      responseMimeType: "application/json"
    }
  });

  const text = response.text || "{}";
  const tokens = Math.ceil(text.length / 4) + 2000;
  return { script: text, cost: (tokens / 1000) * COST_PER_1K_TOKENS, tokens };
};

export const generateStudioImage = async (state: StudioState, draftJson: string): Promise<{ url: string; cost: number }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cam = state.cameras[state.activeCameraIndex];
  const focalLength = LENSES.find(l => l.label === cam.lens)?.mm || 50;
  const parts: any[] = [];
  
  for (const key of ['background', 'prop', 'accessories'] as ReferenceType[]) {
    if (state.references[key]?.dataUrl) {
      const { data, mimeType } = await downscaleImage(state.references[key].dataUrl!, 512, 0.6);
      parts.push({ text: `REF_GLOBAL_${key.toUpperCase()}:` }, { inlineData: { data, mimeType } });
    }
  }

  for (const sub of state.subjects) {
    for (const refKey of ['character', 'costume', 'pose'] as ReferenceType[]) {
      const ref = sub.references[refKey];
      if (ref?.dataUrl) {
        const { data, mimeType } = await downscaleImage(ref.dataUrl, 512, 0.6);
        parts.push({ text: `REF_SUB_${sub.id.toUpperCase()}_${refKey.toUpperCase()}:` }, { inlineData: { data, mimeType } });
      }
    }
  }

  parts.push({ text: `FINAL_RENDER_MANIFEST: ${draftJson}\n\nSTRICT REQUIREMENT: Use the Scene Analyzer and Scale Controller data to render character size perfectly. Apply orientation such that 0deg is facing the lens. Apply 'contact_physics' and 'lens_matching' for ${focalLength}mm.` });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: { 
      imageConfig: { aspectRatio: "16:9", imageSize: "1K" } 
    }
  });

  const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!imgPart?.inlineData) throw new Error("Production Render Failed.");
  return { url: `data:image/png;base64,${imgPart.inlineData.data}`, cost: COST_PER_IMAGE };
};

export const generateStudioVideo = async (state: StudioState, script: string, baseImage: string, onStatusChange: (s: string) => void): Promise<{ url: string; cost: number }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = baseImage.split(',')[1];
  
  let animationPrompt = script;
  try {
    const json = JSON.parse(script);
    animationPrompt = json.cinematic_description || "Animate cinematic motion matching the render manifest.";
  } catch (e) {}

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Motion synthesis based on production physics: ${animationPrompt}`,
    image: { imageBytes: base64Data, mimeType: 'image/png' },
    config: { resolution: '720p', aspectRatio: '16:9' }
  });

  while (!operation.done) {
    onStatusChange("Synthesizing Motion Physics...");
    await new Promise(r => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await videoResponse.blob();
  return { url: URL.createObjectURL(blob), cost: COST_PER_VIDEO };
};
