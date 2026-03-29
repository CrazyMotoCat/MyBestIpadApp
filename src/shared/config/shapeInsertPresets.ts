import { ShapeInsertPreset, ShapeInsertPresetId } from "@/shared/types/presets";

export const shapeInsertPresets: ShapeInsertPreset[] = [
  {
    id: "rectangle-note",
    label: "Прямоугольник",
    description: "Базовая прямоугольная вставка для текста и пометок.",
    symbol: "▭",
    preview: "linear-gradient(135deg, #f7f2e7, #efe0c7)",
  },
  {
    id: "square-card",
    label: "Квадрат",
    description: "Квадратная карточка для коротких заметок и стикеров.",
    symbol: "□",
    preview: "linear-gradient(135deg, #f3e7ce, #e8d4af)",
  },
  {
    id: "oval-cloud",
    label: "Овал",
    description: "Мягкая овальная форма для акцентов и маркеров.",
    symbol: "◯",
    preview: "linear-gradient(135deg, #eff6ff, #dce8ff)",
  },
  {
    id: "speech-bubble",
    label: "Выноска",
    description: "Облачко для коротких мыслей и комментариев.",
    symbol: "💬",
    preview: "linear-gradient(135deg, #f7efff, #e8d8ff)",
  },
  {
    id: "sticker",
    label: "Стикер",
    description: "Клеящаяся заметка для напоминаний.",
    symbol: "✦",
    preview: "linear-gradient(135deg, #fff4ac, #f7d968)",
  },
  {
    id: "paper-note",
    label: "Бумажная заметка",
    description: "Текстурная бумажная вставка с тёплым тоном.",
    symbol: "✎",
    preview: "linear-gradient(135deg, #f0e2c4, #e0c49a)",
  },
  {
    id: "index-card",
    label: "Карточка",
    description: "Плотная карточка для структурированных блоков.",
    symbol: "▤",
    preview: "linear-gradient(135deg, #ffffff, #dfe8f9)",
  },
];

export const defaultShapeInsertId: ShapeInsertPresetId = "rectangle-note";

export function getShapeInsertPreset(shapeId: ShapeInsertPresetId) {
  return shapeInsertPresets.find((preset) => preset.id === shapeId) ?? shapeInsertPresets[0]!;
}
