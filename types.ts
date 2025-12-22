export type ReferenceType = 
  | 'background' 
  | 'char_a' | 'pose_a' 
  | 'char_b' | 'pose_b' 
  | 'prop';

export interface ReferenceImage {
  id: ReferenceType;
  label: string;
  dataUrl?: string;
  mimeType?: string;
}

export interface SubjectConfig {
  x: number; // Stage Left (-) to Stage Right (+)
  z: number; // Proscenium (0) to Deep Stage (+)
  rotation: number; // 0-360
  gaze: number; // 0-360
}

export interface CameraConfig {
  id: string;
  x: number;
  z: number;
  rotation: number;
  model: string;
  lens: string;
  verticalAngle: string;
}

export interface StudioState {
  references: Record<ReferenceType, ReferenceImage>;
  lighting: {
    positions: boolean[];
  };
  subjects: {
    a: SubjectConfig;
    b: SubjectConfig;
    activeCount: 1 | 2;
  };
  cameras: CameraConfig[];
  activeCameraIndex: number;
  isGenerating: boolean;
  isGeneratingPrompt: boolean;
  isReviewingPrompt: boolean;
  draftPrompt: string;
  generatedImage?: string;
  plannerZoom: number;
}