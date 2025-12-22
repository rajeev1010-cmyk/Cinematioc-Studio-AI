import { ReferenceType } from './types';

export const REFERENCE_SLOTS: { id: ReferenceType; label: string; group: string }[] = [
  { id: 'background', label: 'Environment', group: 'Global' },
  { id: 'prop', label: 'Scene Prop', group: 'Global' },
  { id: 'char_a', label: 'Subject A', group: 'Subject A' },
  { id: 'pose_a', label: 'Pose A', group: 'Subject A' },
  { id: 'char_b', label: 'Subject B', group: 'Subject B' },
  { id: 'pose_b', label: 'Pose B', group: 'Subject B' },
];

export const CAMERA_MODELS = [
  "Arri Alexa 35",
  "Sony A7R V",
  "RED V-RAPTOR XL",
  "Blackmagic URSA Mini"
];

export const LENSES = [
  { label: "24mm f/1.4 (Wide)", mm: 24 },
  { label: "35mm f/1.4 (Storyteller)", mm: 35 },
  { label: "50mm f/1.2 (Natural)", mm: 50 },
  { label: "85mm f/1.4 (Portrait)", mm: 85 }
];

export const VERTICAL_ANGLES = [
  "Low Angle (Worm's Eye)",
  "Eye Level",
  "High Angle",
  "Bird's Eye (Top-Down)"
];

export const LIGHT_POSITIONS = [
  { label: 'Front', angle: 0 },
  { label: 'Front-Right', angle: 45 },
  { label: 'Right', angle: 90 },
  { label: 'Back-Right', angle: 135 },
  { label: 'Back', angle: 180 },
  { label: 'Back-Left', angle: 225 },
  { label: 'Left', angle: 270 },
  { label: 'Front-Left', angle: 315 },
];

// Added missing SHOT_SCALES to satisfy component requirements
export const SHOT_SCALES = [
  { id: 'ECU', label: "Extreme Close Up (ECU)" },
  { id: 'CU', label: "Close Up (CU)" },
  { id: 'MS', label: "Medium Shot (MS)" },
  { id: 'LS', label: "Long Shot (LS)" },
  { id: 'WS', label: "Wide Shot (WS)" }
];