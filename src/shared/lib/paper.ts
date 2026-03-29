import { CSSProperties } from "react";
import { getPaperPreset } from "@/shared/config/paperPresets";
import { PaperPresetId } from "@/shared/types/presets";

function resolveBackgroundSize(paperId: PaperPresetId) {
  switch (paperId) {
    case "dotted":
      return "18px 18px";
    case "grid":
    case "dark":
      return "24px 24px";
    case "millimeter":
    case "engineering-grid":
      return "10px 10px, 10px 10px, 50px 50px, 50px 50px";
    case "storyboard":
    case "comic":
      return "50% 50%, 50% 50%";
    case "isometric":
      return "36px 36px, 36px 36px, 36px 36px";
    case "drafting":
    case "architect":
      return "24px 24px, 24px 24px, 96px 96px, 96px 96px";
    default:
      return "100% 100%";
  }
}

export function buildPaperStyle(paperId: PaperPresetId, baseColorOverride?: string): CSSProperties {
  const preset = getPaperPreset(paperId);
  const baseColor = baseColorOverride ?? preset.baseColor;

  return {
    backgroundColor: baseColor,
    backgroundImage: preset.overlay === "none" ? undefined : preset.overlay,
    backgroundSize: resolveBackgroundSize(paperId),
    color: paperId === "dark" ? "#eef3ff" : "#261f19",
  };
}
