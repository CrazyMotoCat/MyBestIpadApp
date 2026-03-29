import { ChangeEvent } from "react";
import { appBackgroundPresets } from "@/shared/config/appBackgroundPresets";
import { useAssetObjectUrl } from "@/shared/lib/useAssetObjectUrl";
import { AppSettings } from "@/shared/types/models";
import { Modal } from "@/shared/ui/Modal";

interface BackgroundSettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSelect: (backgroundId: AppSettings["backgroundId"]) => void;
  onUpload: (file: File) => void;
  onDimChange: (dimAmount: number) => void;
  onBlurChange: (blurAmount: number) => void;
}

function CustomBackgroundCard({
  settings,
  onUpload,
}: {
  settings: AppSettings;
  onUpload: (file: File) => void;
}) {
  const customUrl = useAssetObjectUrl(settings.customBackgroundAssetId);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onUpload(file);
    event.target.value = "";
  }

  return (
    <label className={`preset-card preset-card--background ${settings.backgroundMode === "custom" ? "preset-card--active" : ""}`}>
      <span
        className="preset-card__swatch"
        style={{
          background: customUrl
            ? `linear-gradient(180deg, rgba(6,8,14,.42), rgba(6,8,14,.56)), url("${customUrl}") center / cover no-repeat`
            : "linear-gradient(135deg, #0d1320, #2a3652)",
        }}
      >
        <span className="preset-card__badge">↑</span>
      </span>
      <span className="preset-card__title">Своя картинка</span>
      <span className="preset-card__description">
        Загруженный фон хранится локально и восстанавливается после перезагрузки.
      </span>
      <input type="file" accept="image/*" onChange={handleFileChange} />
    </label>
  );
}

export function BackgroundSettingsModal({
  isOpen,
  settings,
  onClose,
  onSelect,
  onUpload,
  onDimChange,
  onBlurChange,
}: BackgroundSettingsModalProps) {
  return (
    <Modal
      title="Настроить фон приложения"
      subtitle="Выберите готовую сцену или загрузите своё изображение. Затемнение и размытие помогают удержать читаемость интерфейса."
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="preset-grid preset-grid--backgrounds">
        {appBackgroundPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-card preset-card--background ${
              settings.backgroundMode === "preset" && settings.backgroundId === preset.id
                ? "preset-card--active"
                : ""
            }`}
            onClick={() => onSelect(preset.id)}
          >
            <span className="preset-card__swatch" style={{ background: preset.preview }}>
              <span className="preset-card__badge">✦</span>
            </span>
            <span className="preset-card__title">{preset.label}</span>
            <span className="preset-card__description">{preset.description}</span>
          </button>
        ))}

        <CustomBackgroundCard settings={settings} onUpload={onUpload} />
      </div>

      <div className="background-controls">
        <div className="setting-slider-card">
          <span>Сила затемнения: {Math.round(settings.backgroundDimAmount * 100)}%</span>
          <input
            className="range"
            type="range"
            min={0.2}
            max={0.92}
            step={0.01}
            value={settings.backgroundDimAmount}
            onChange={(event) => onDimChange(Number(event.target.value))}
          />
        </div>

        <div className="setting-slider-card">
          <span>Сила размытия: {settings.backgroundBlurAmount.toFixed(0)} px</span>
          <input
            className="range"
            type="range"
            min={0}
            max={24}
            step={1}
            value={settings.backgroundBlurAmount}
            onChange={(event) => onBlurChange(Number(event.target.value))}
          />
        </div>
      </div>
    </Modal>
  );
}
