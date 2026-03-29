export type NotebookStylePresetId =
  | "nebula-carbon"
  | "chrome-comet"
  | "midnight-racer"
  | "aurora-track"
  | "burnout-red"
  | "starlit-leather"
  | "retro-wave";

export type NotebookTypePresetId =
  | "garage-log"
  | "travel-journal"
  | "idea-book"
  | "project-board"
  | "track-notes"
  | "daily-journal"
  | "spiral-notebook"
  | "planner-book"
  | "pocket-notebook";

export type CoverPresetId =
  | "leather-midnight"
  | "cardboard-racer"
  | "pattern-nebula"
  | "graphic-road"
  | "decor-vinyl"
  | "carbon-metal";

export type BindingPresetId = "spiral" | "clip" | "rings";

export type PaperCategoryId =
  | "basic"
  | "creative"
  | "technical"
  | "planning"
  | "study";

export type PaperPresetId =
  | "plain"
  | "lined"
  | "grid"
  | "dotted"
  | "millimeter"
  | "engineering-grid"
  | "isometric"
  | "music"
  | "calligraphy"
  | "sketch"
  | "kraft"
  | "cream"
  | "dark"
  | "daily"
  | "planner"
  | "checklist"
  | "cornell"
  | "storyboard"
  | "comic"
  | "school"
  | "lab"
  | "architect"
  | "drafting";

export type ToolCategoryId = "pens" | "brushes" | "markers" | "pencils" | "special";

export type ToolStrokeStyle = "solid" | "marker" | "dashed" | "grain" | "eraser";

export type ToolPresetId =
  | "ballpoint"
  | "gel"
  | "fountain"
  | "technical-pen"
  | "liner"
  | "marker"
  | "highlighter"
  | "pencil"
  | "mechanical-pencil"
  | "brush"
  | "calligraphy-brush"
  | "thin-brush"
  | "thick-brush"
  | "felt-tip"
  | "charcoal"
  | "eraser";

export type AppBackgroundPresetId =
  | "deep-space"
  | "meteor-shift"
  | "track-night"
  | "aurora-engine"
  | "saturn-dust"
  | "carbon-drift";

export type ShapeInsertPresetId =
  | "rectangle-note"
  | "square-card"
  | "oval-cloud"
  | "speech-bubble"
  | "sticker"
  | "paper-note"
  | "index-card";

export interface NotebookStylePreset {
  id: NotebookStylePresetId;
  label: string;
  description: string;
  accent: string;
  surface: string;
  symbol: string;
  artwork: string;
}

export interface NotebookTypePreset {
  id: NotebookTypePresetId;
  label: string;
  description: string;
  symbol: string;
}

export interface CoverPreset {
  id: CoverPresetId;
  label: string;
  description: string;
  preview: string;
  emboss: string;
}

export interface BindingPreset {
  id: BindingPresetId;
  label: string;
  description: string;
  symbol: string;
}

export interface PaperPreset {
  id: PaperPresetId;
  label: string;
  description: string;
  category: PaperCategoryId;
  baseColor: string;
  lineColor: string;
  overlay: string;
}

export interface ToolPreset {
  id: ToolPresetId;
  label: string;
  description: string;
  category: ToolCategoryId;
  defaultColor: string;
  defaultWidth: number;
  defaultOpacity: number;
  strokeStyle: ToolStrokeStyle;
  smoothing: number;
}

export interface AppBackgroundPreset {
  id: AppBackgroundPresetId;
  label: string;
  description: string;
  shellBackground: string;
  preview: string;
  shellGlow: string;
  cardTint: string;
  overlay: string;
}

export interface ShapeInsertPreset {
  id: ShapeInsertPresetId;
  label: string;
  description: string;
  symbol: string;
  preview: string;
}
