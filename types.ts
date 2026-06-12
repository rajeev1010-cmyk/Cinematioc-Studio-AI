
export type ReferenceType = 
  | 'background' 
  | 'character' 
  | 'costume' 
  | 'prop' 
  | 'accessories' 
  | 'pose';

export interface ReferenceImage {
  id: ReferenceType;
  label: string;
  dataUrl?: string;
  mimeType?: string;
}

export interface SubjectConfig {
  id: string;
  x: number;
  z: number;
  rotation: number;
  gaze: number;
  label: string;
  references: Partial<Record<ReferenceType, ReferenceImage>>;
}

export interface Landmark {
  id: string;
  label: string;
  description: string;
  x: number;
  z: number;
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

export interface UsageStats {
  totalSpent: number;
  analysis: number;
  render: number;
  video: number;
  tokens: number;
}

export interface StudioState {
  references: Record<ReferenceType, ReferenceImage>;
  lighting: {
    positions: boolean[];
  };
  subjects: SubjectConfig[];
  landmarks: Landmark[];
  cameras: CameraConfig[];
  activeCameraIndex: number;
  isGenerating: boolean;
  isGeneratingPrompt: boolean;
  isReviewingPrompt: boolean;
  isReviewingVideoPrompt: boolean;
  isGeneratingVideo: boolean;
  videoStatus?: string;
  draftPrompt: string;
  generatedImage?: string;
  generatedVideo?: string;
  plannerZoom: number;
  plannerOffset: { x: number; z: number };
  usage: UsageStats;
}
