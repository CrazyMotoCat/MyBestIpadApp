import { toolPresets } from "@/shared/config/toolPresets";
import { ToolPresetId } from "@/shared/types/presets";

interface ToolPresetPickerProps {
  selectedId: ToolPresetId;
  onSelect: (toolId: ToolPresetId) => void;
  categories?: Array<keyof typeof categoryLabels>;
}

const categoryLabels = {
  pens: "Ручки",
  pencils: "Карандаши",
  brushes: "Кисти",
  markers: "Маркеры",
  special: "Специнструменты",
};

export function ToolPresetPicker({ selectedId, onSelect, categories }: ToolPresetPickerProps) {
  const sourceEntries = Object.entries(categoryLabels).filter(([category]) =>
    categories ? categories.includes(category as keyof typeof categoryLabels) : true,
  );
  const grouped = sourceEntries.map(([category, label]) => ({
    category,
    label,
    items: toolPresets.filter((preset) => preset.category === category),
  }));

  return (
    <div className="stack">
      {grouped.map((group) => (
        <div key={group.category} className="stack">
          <div className="panel-label">{group.label}</div>
          <div className="preset-grid preset-grid--tools">
            {group.items.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-card ${selectedId === preset.id ? "preset-card--active" : ""}`}
                onClick={() => onSelect(preset.id)}
              >
                <span
                  className="tool-chip"
                  style={{
                    background: `linear-gradient(135deg, ${preset.defaultColor}, rgba(255,255,255,.08))`,
                  }}
                />
                <span className="preset-card__title">{preset.label}</span>
                <span className="preset-card__description">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
