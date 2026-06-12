
import { ReferenceType } from './types';

export const REFERENCE_SLOTS: { id: ReferenceType; label: string; group: string }[] = [
  { id: 'background', label: 'Background', group: 'Environment' },
  { id: 'character', label: 'Character', group: 'Subject' },
  { id: 'costume', label: 'Costume', group: 'Subject' },
  { id: 'prop', label: 'Prop', group: 'Scene' },
  { id: 'accessories', label: 'Accessories', group: 'Subject' },
  { id: 'pose', label: 'Pose Ref', group: 'Subject' },
];

export const CAMERA_MODELS = [
  "Arri Alexa 35",
  "Sony A7R V",
  "RED V-RAPTOR XL",
  "Blackmagic URSA Mini"
];

export const LENSES = [
  { label: "18mm (Ultra Wide)", mm: 18 },
  { label: "24mm (Wide)", mm: 24 },
  { label: "35mm (Standard)", mm: 35 },
  { label: "50mm (Natural)", mm: 50 },
  { label: "85mm (Portrait)", mm: 85 },
  { label: "105mm (Telephoto)", mm: 105 }
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

export const SHOT_SCALES = [
  { id: 'ECU', label: "Extreme Close Up (ECU)" },
  { id: 'CU', label: "Close Up (CU)" },
  { id: 'MS', label: "Medium Shot (MS)" },
  { id: 'LS', label: "Long Shot (LS)" },
  { id: 'WS', label: "Wide Shot (WS)" },
  { id: 'EWS', label: "Extreme Wide Shot (EWS)" }
];

// Calculation constant derived from User table: Scale = (70.83 * mm) / Dist
export const PRODUCTION_SCALE_CONSTANT = 70.83;

// Pricing Constants in INR (1 USD = 84.0 INR)
export const COST_PER_IMAGE = 2.50; // ~0.03 USD
export const COST_PER_VIDEO = 12.60; // ~0.15 USD
export const COST_PER_1K_TOKENS = 0.0084; // ~0.0001 USD
