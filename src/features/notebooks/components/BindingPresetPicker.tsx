import { bindingPresets } from "@/shared/config/bindingPresets";
import { BindingPresetId } from "@/shared/types/presets";

interface BindingPresetPickerProps {
  selectedId: BindingPresetId;
  onSelect: (bindingId: BindingPresetId) => void;
}

export function BindingPresetPicker({ selectedId, onSelect }: BindingPresetPickerProps) {
  return (
    <div className="preset-grid">
      {bindingPresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`preset-card ${selectedId === preset.id ? "preset-card--active" : ""}`}
          onClick={() => onSelect(preset.id)}
        >
          <span className="binding-preview">
            <span className="binding-preview__symbol">{preset.symbol}</span>
          </span>
          <span className="preset-card__title">{preset.label}</span>
          <span className="preset-card__description">{preset.description}</span>
        </button>
      ))}
    </div>
  );
}
