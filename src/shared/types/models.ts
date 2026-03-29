import {
  AppBackgroundPresetId,
  BindingPresetId,
  CoverPresetId,
  NotebookStylePresetId,
  NotebookTypePresetId,
  PaperPresetId,
  ShapeInsertPresetId,
  ToolPresetId,
  ToolStrokeStyle,
} from "@/shared/types/presets";

export type PageLayout = "freeform" | "focus" | "split";
export type PageElementType = "text" | "drawing" | "image" | "fileAttachment" | "shapeNote";
export type AssetKind = "image" | "file" | "background" | "cover";
export type BackgroundMode = "preset" | "custom";
export type CoverMode = "preset" | "custom";
export type ShapeEdgeStyle = "straight" | "torn";

export interface Notebook {
  id: string;
  title: string;
  color: string;
  style: NotebookStylePresetId;
  stylePreset: NotebookStylePresetId;
  notebookType: NotebookTypePresetId;
  paperType: PaperPresetId;
  defaultPaperType: PaperPresetId;
  defaultPaperColor: string;
  defaultTool: ToolPresetId;
  coverPreset: CoverPresetId;
  coverMode: CoverMode;
  coverImageAssetId: string | null;
  coverBackground: string;
  bindingType: BindingPresetId;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  notebookId: string;
  title: string;
  order: number;
  pageOrder: number;
  paperType: PaperPresetId;
  paperColor: string;
  layout: PageLayout;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BasePageElement {
  id: string;
  pageId: string;
  type: PageElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface TextPageElement extends BasePageElement {
  type: "text";
  content: string;
  style: {
    fontSize: number;
    lineHeight: number;
    color: string;
  };
}

export interface DrawingPageElement extends BasePageElement {
  type: "drawing";
  toolId: ToolPresetId;
  label: string;
}

export interface ImagePageElement extends BasePageElement {
  type: "image";
  assetId: string;
  name: string;
  mimeType: string;
  size: number;
  caption: string;
}

export interface FileAttachmentPageElement extends BasePageElement {
  type: "fileAttachment";
  assetId: string;
  name: string;
  mimeType: string;
  size: number;
  note: string;
}

export interface ShapeNoteElement extends BasePageElement {
  type: "shapeNote";
  shapePreset: ShapeInsertPresetId;
  color: string;
  paperStyle: PaperPresetId;
  edgeStyle: ShapeEdgeStyle;
  text: string;
}

export type PageElement =
  | TextPageElement
  | DrawingPageElement
  | ImagePageElement
  | FileAttachmentPageElement
  | ShapeNoteElement;

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  pageId: string;
  toolId: ToolPresetId;
  color: string;
  width: number;
  opacity: number;
  strokeStyle: ToolStrokeStyle;
  smoothing: number;
  points: DrawingPoint[];
  createdAt: string;
}

export interface StoredAsset {
  id: string;
  kind: AssetKind;
  ownerId: string;
  blob: Blob;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface NotebookAttachment {
  id: string;
  notebookId: string;
  assetId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface AppSettings {
  id: "app-settings";
  backgroundMode: BackgroundMode;
  backgroundId: AppBackgroundPresetId;
  customBackgroundAssetId: string | null;
  backgroundDimAmount: number;
  backgroundBlurAmount: number;
  updatedAt: string;
}
