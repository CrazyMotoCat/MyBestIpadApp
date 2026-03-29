import { CoverPreset, CoverPresetId } from "@/shared/types/presets";

export const coverPresets: CoverPreset[] = [
  {
    id: "leather-midnight",
    label: "Кожа",
    description: "Тёмная кожаная обложка с мягким тиснением.",
    preview: "linear-gradient(135deg, #251915 0%, #55362a 50%, #1d120e 100%)",
    emboss: "✶",
  },
  {
    id: "cardboard-racer",
    label: "Картон",
    description: "Плотная картонная обложка с графикой дороги.",
    preview: "linear-gradient(135deg, #70553e 0%, #b88d5b 46%, #6e4932 100%)",
    emboss: "▦",
  },
  {
    id: "pattern-nebula",
    label: "Узоры",
    description: "Декоративный космический узор с геометрическими линиями.",
    preview:
      "linear-gradient(135deg, #191c2e 0%, #3d2e62 45%, #101320 100%), linear-gradient(90deg, transparent 0 40%, rgba(255,255,255,.16) 40% 42%, transparent 42% 100%)",
    emboss: "✦",
  },
  {
    id: "graphic-road",
    label: "Рисунок дороги",
    description: "Графическая обложка с мотивом трассы и дальнего света.",
    preview:
      "linear-gradient(140deg, #0d1016 0%, #1f2633 48%, #090b12 100%), linear-gradient(90deg, transparent 47%, rgba(255,255,255,.7) 49%, transparent 51%)",
    emboss: "➤",
  },
  {
    id: "decor-vinyl",
    label: "Декоративная",
    description: "Гладкая декоративная обложка с блеском пластинки и постерной графикой.",
    preview: "linear-gradient(135deg, #2d1739 0%, #6f2b67 46%, #1b1025 100%)",
    emboss: "♫",
  },
  {
    id: "carbon-metal",
    label: "Карбон",
    description: "Металлическая карбоновая обложка с техно-рисунком.",
    preview:
      "linear-gradient(135deg, #0d131e 0%, #2c394d 45%, #0b1018 100%), linear-gradient(45deg, rgba(255,255,255,.05) 25%, transparent 25% 50%, rgba(255,255,255,.05) 50% 75%, transparent 75%)",
    emboss: "⚙",
  },
];

export const defaultCoverPresetId: CoverPresetId = "carbon-metal";

export function getCoverPreset(coverId: CoverPresetId) {
  return coverPresets.find((preset) => preset.id === coverId) ?? coverPresets[0]!;
}

