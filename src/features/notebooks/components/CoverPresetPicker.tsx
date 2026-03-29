import { coverPresets } from "@/shared/config/coverPresets";
import { CoverPresetId } from "@/shared/types/presets";

interface CoverPresetPickerProps {
  selectedId: CoverPresetId;
  onSelect: (coverId: CoverPresetId) => void;
}

export function CoverPresetPicker({ selectedId, onSelect }: CoverPresetPickerProps) {
  return (
    <div className="preset-grid">
      {coverPresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`preset-card ${selectedId === preset.id ? "preset-card--active" : ""}`}
          onClick={() => onSelect(preset.id)}
        >
          <span className="preset-card__swatch" style={{ background: preset.preview }}>
            <span className="preset-card__badge">{preset.emboss}</span>
          </span>
          <span className="preset-card__title">{preset.label}</span>
          <span className="preset-card__description">{preset.description}</span>
        </button>
      ))}
    </div>
  );
}

