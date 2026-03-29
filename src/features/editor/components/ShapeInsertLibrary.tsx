import { shapeInsertPresets } from "@/shared/config/shapeInsertPresets";
import { PaperPresetId, ShapeInsertPresetId } from "@/shared/types/presets";
import { Button } from "@/shared/ui/Button";

interface ShapeInsertLibraryProps {
  color: string;
  edgeStyle: "straight" | "torn";
  paperStyle: PaperPresetId;
  onColorChange: (value: string) => void;
  onEdgeStyleChange: (value: "straight" | "torn") => void;
  onPaperStyleChange: (value: PaperPresetId) => void;
  onInsert: (shapePreset: ShapeInsertPresetId) => void;
}

export function ShapeInsertLibrary({
  color,
  edgeStyle,
  paperStyle,
  onColorChange,
  onEdgeStyleChange,
  onPaperStyleChange,
  onInsert,
}: ShapeInsertLibraryProps) {
  return (
    <div className="stack">
      <div className="preset-grid">
        {shapeInsertPresets.map((preset) => (
          <button key={preset.id} type="button" className="preset-card" onClick={() => onInsert(preset.id)}>
            <span className="preset-card__swatch" style={{ background: preset.preview }}>
              <span className="preset-card__badge">{preset.symbol}</span>
            </span>
            <span className="preset-card__title">{preset.label}</span>
            <span className="preset-card__description">{preset.description}</span>
          </button>
        ))}
      </div>

      <label className="stack">
        <span>Цвет вставки</span>
        <input className="color-input" type="color" value={color} onChange={(event) => onColorChange(event.target.value)} />
      </label>

      <label className="stack">
        <span>Стиль бумаги внутри вставки</span>
        <select
          className="select"
          value={paperStyle}
          onChange={(event) => onPaperStyleChange(event.target.value as PaperPresetId)}
        >
          <option value="plain">Чистая</option>
          <option value="lined">Линованная</option>
          <option value="grid">В клетку</option>
          <option value="dotted">В точку</option>
          <option value="kraft">Крафтовая</option>
          <option value="cream">Кремовая</option>
        </select>
      </label>

      <div className="inline-actions">
        <Button
          type="button"
          variant={edgeStyle === "straight" ? "primary" : "ghost"}
          onClick={() => onEdgeStyleChange("straight")}
        >
          Ровный край
        </Button>
        <Button
          type="button"
          variant={edgeStyle === "torn" ? "primary" : "ghost"}
          onClick={() => onEdgeStyleChange("torn")}
        >
          Оторванный край
        </Button>
      </div>
    </div>
  );
}

