import { paperPresets } from "@/shared/config/paperPresets";
import { PaperPresetId } from "@/shared/types/presets";

interface PaperPresetPickerProps {
  selectedId: PaperPresetId;
  onSelect: (paperId: PaperPresetId) => void;
}

const categoryLabels = {
  basic: "Базовые",
  planning: "Планирование",
  study: "Учёба",
  technical: "Технические",
  creative: "Творческие",
};

export function PaperPresetPicker({ selectedId, onSelect }: PaperPresetPickerProps) {
  const grouped = Object.entries(categoryLabels).map(([category, label]) => ({
    category,
    label,
    items: paperPresets.filter((preset) => preset.category === category),
  }));

  return (
    <div className="stack">
      {grouped.map((group) => (
        <div key={group.category} className="stack">
          <div className="panel-label">{group.label}</div>
          <div className="preset-grid">
            {group.items.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-card ${selectedId === preset.id ? "preset-card--active" : ""}`}
                onClick={() => onSelect(preset.id)}
              >
                <span
                  className="preset-card__swatch"
                  style={{
                    backgroundColor: preset.baseColor,
                    backgroundImage: preset.overlay === "none" ? undefined : preset.overlay,
                    backgroundSize:
                      preset.id === "dotted"
                        ? "18px 18px"
                        : preset.id === "grid" || preset.id === "dark"
                          ? "24px 24px"
                          : preset.id === "millimeter" || preset.id === "engineering-grid"
                            ? "10px 10px, 10px 10px, 50px 50px, 50px 50px"
                            : preset.id === "storyboard" || preset.id === "comic"
                              ? "50% 50%, 50% 50%"
                              : preset.id === "isometric"
                                ? "36px 36px, 36px 36px, 36px 36px"
                                : preset.id === "drafting" || preset.id === "architect"
                                  ? "24px 24px, 24px 24px, 96px 96px, 96px 96px"
                                  : "100% 100%",
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

