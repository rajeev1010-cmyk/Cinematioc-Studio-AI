
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import firebaseConfig from "../firebase-applet-config.json";

// The Google Picker API developer key
const sanitizeEnvVar = (val: any): string => {
  if (typeof val !== 'string') return '';
  return val.replace(/^["']|["']$/g, '').trim();
};

const DEVELOPER_KEY = sanitizeEnvVar(import.meta.env.VITE_GOOGLE_PICKER_API_KEY) || firebaseConfig.apiKey;

// The Client ID can be inferred from the appId or found in the console. 
const CLIENT_ID = sanitizeEnvVar(import.meta.env.VITE_GOOGLE_CLIENT_ID) || "";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export const loadGooglePicker = () => {
  return new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
};

let cachedToken: string | null = null;

const getAccessToken = async (): Promise<string> => {
  if (cachedToken) return cachedToken;
  
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error("No access token obtained");
  }
  
  cachedToken = accessToken;
  return accessToken;
};

export const showPicker = async (type: 'drive' | 'photos'): Promise<string | null> => {
  if (!window.gapi) {
    await loadGooglePicker();
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Get Access Token
      const accessToken = await getAccessToken();

      // 2. Load the Picker API
      window.gapi.load('picker', {
        callback: () => {
          let view;
          if (type === 'photos') {
            // Try specific Photos View or just the ViewId
            view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES);
            try {
              // Some users prefer the dedicated Photos view if available
              // view = new window.google.picker.View(window.google.picker.ViewId.PHOTOS);
              // But DOCS_IMAGES with a filter is often more reliable for mixed content
            } catch (e) {}
          } else {
            view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES);
          }
            
          const pickerBuilder = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(accessToken)
            .setDeveloperKey(DEVELOPER_KEY)
            .setCallback((data: any) => {
              if (data.action === window.google.picker.Action.PICKED) {
                const doc = data.docs[0];
                resolve(doc.id || doc.url);
              } else if (data.action === window.google.picker.Action.CANCEL) {
                resolve(null);
              }
            });

          if (CLIENT_ID) {
            pickerBuilder.setAppId(CLIENT_ID);
          }
          
          // Set origin to current window origin to prevent origin mismatch errors
          pickerBuilder.setOrigin(window.location.protocol + '//' + window.location.host);

          const picker = pickerBuilder.build();
          picker.setVisible(true);
        }
      });
    } catch (error) {
      console.error("Picker error:", error);
      reject(error);
    }
  });
};

/**
 * Fetches a file's content from Google Drive and returns as Data URL
 */
export const fetchGoogleFile = async (fileId: string): Promise<{ dataUrl: string; mimeType: string }> => {
  const accessToken = await getAccessToken();
  
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const blob = await response.blob();
  const mimeType = blob.type;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result as string, mimeType });
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
