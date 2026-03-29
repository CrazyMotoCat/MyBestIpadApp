import { BindingPreset, BindingPresetId } from "@/shared/types/presets";

export const bindingPresets: BindingPreset[] = [
  {
    id: "spiral",
    label: "Пружина",
    description: "Классический спиральный переплёт с частыми витками.",
    symbol: "◎",
  },
  {
    id: "clip",
    label: "Скрепка",
    description: "Лёгкий канцелярский акцент с зажимом сверху.",
    symbol: "⌂",
  },
  {
    id: "rings",
    label: "Кольца",
    description: "Кольцевой переплёт, хорошо заметный в макете блокнота.",
    symbol: "◌",
  },
];

export const defaultBindingPresetId: BindingPresetId = "spiral";

export function getBindingPreset(bindingId: BindingPresetId) {
  return bindingPresets.find((preset) => preset.id === bindingId) ?? bindingPresets[0]!;
}

