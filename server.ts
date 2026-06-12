import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { COST_PER_1K_TOKENS, COST_PER_IMAGE, COST_PER_VIDEO } from "./src/constants.js";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.post("/api/analyze-background", async (req, res) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { data, mimeType } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-preview',
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

    res.json(JSON.parse(response.text || "[]"));
  } catch (error: any) {
    console.error("Analysis failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-prompt", async (req, res) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { parts, productionSystemInstruction } = req.body;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-preview',
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
    res.json({ script: text, cost: (tokens / 1000) * 0.0000000001, tokens }); // Simplified cost
  } catch (error: any) {
    console.error("Prompt generation failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { parts } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: { 
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" } 
      }
    });

    const imgPart = response.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
    if (!imgPart?.inlineData) throw new Error("Production Render Failed.");
    
    res.json({ url: `data:image/png;base64,${imgPart.inlineData.data}`, cost: 0.05 });
  } catch (error: any) {
    console.error("Image generation failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-video", async (req, res) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { script, baseImage } = req.body;
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

    // Instead of waiting in the API route, we could block... since the original code blocked on frontend.
    while (!operation.done) {
      await new Promise(r => setTimeout(r, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.GEMINI_API_KEY}`);
    const blob = await videoResponse.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64Video = Buffer.from(arrayBuffer).toString('base64');
    
    res.json({ url: `data:video/mp4;base64,${base64Video}`, cost: 0.1 });
  } catch (error: any) {
    console.error("Video generation failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
