import { CSSProperties, ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PaperPresetPicker } from "@/features/editor/components/PaperPresetPicker";
import { ToolPresetPicker } from "@/features/editor/components/ToolPresetPicker";
import { NotebookBinding } from "@/features/notebooks/components/NotebookBinding";
import { BindingPresetPicker } from "@/features/notebooks/components/BindingPresetPicker";
import { CoverPresetPicker } from "@/features/notebooks/components/CoverPresetPicker";
import { getCoverPreset } from "@/shared/config/coverPresets";
import { notebookStylePresets, notebookTypePresets } from "@/shared/config/notebookPresets";
import { getPaperPreset } from "@/shared/config/paperPresets";
import { getToolPreset } from "@/shared/config/toolPresets";
import { Notebook } from "@/shared/types/models";
import {
  BindingPresetId,
  CoverPresetId,
  NotebookStylePresetId,
  NotebookTypePresetId,
  PaperPresetId,
  ToolPresetId,
} from "@/shared/types/presets";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";

interface NotebookFormState {
  title: string;
  color: string;
  style: NotebookStylePresetId;
  notebookType: NotebookTypePresetId;
  paperType: PaperPresetId;
  paperColor: string;
  defaultTool: ToolPresetId;
  coverPreset: CoverPresetId;
  bindingType: BindingPresetId;
  coverMode: "preset" | "custom";
  coverImage: File | null;
}

interface CreateNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: NotebookFormState) => Promise<Notebook>;
  initialValues?: Partial<NotebookFormState>;
  titleText?: string;
  submitText?: string;
  closeDelayMs?: number;
}

const colorPalette = ["#6f7cff", "#ff6a63", "#78ffd8", "#ff9a6a", "#96b7ff", "#d38dff"];
const DEFAULT_NOTEBOOK_TITLE = "Новый блокнот";

function buildInitialState(initialValues?: Partial<NotebookFormState>): NotebookFormState {
  return {
    title: initialValues?.title ?? "",
    color: initialValues?.color ?? colorPalette[0]!,
    style: initialValues?.style ?? "nebula-carbon",
    notebookType: initialValues?.notebookType ?? "garage-log",
    paperType: initialValues?.paperType ?? "lined",
    paperColor: initialValues?.paperColor ?? "#f7f2e6",
    defaultTool: initialValues?.defaultTool ?? "ballpoint",
    coverPreset: initialValues?.coverPreset ?? "carbon-metal",
    bindingType: initialValues?.bindingType ?? "spiral",
    coverMode: initialValues?.coverMode ?? "preset",
    coverImage: initialValues?.coverImage ?? null,
  };
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");

  if (normalized.length !== 6) {
    return `rgba(126, 143, 255, ${alpha})`;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function CreateNotebookModal({
  isOpen,
  onClose,
  onCreate,
  initialValues,
  titleText = "Создать блокнот",
  submitText = "Создать",
  closeDelayMs = 0,
}: CreateNotebookModalProps) {
  const [form, setForm] = useState<NotebookFormState>(buildInitialState(initialValues));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const styleCards = useMemo(() => notebookStylePresets, []);
  const notebookStyle = styleCards.find((preset) => preset.id === form.style) ?? styleCards[0]!;
  const notebookType = notebookTypePresets.find((preset) => preset.id === form.notebookType) ?? notebookTypePresets[0]!;
  const paperPreset = getPaperPreset(form.paperType);
  const toolPreset = getToolPreset(form.defaultTool);
  const coverPreset = getCoverPreset(form.coverPreset);

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState(initialValues));
    }
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (!form.coverImage) {
      setCustomCoverUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(form.coverImage);
    setCustomCoverUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [form.coverImage]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function updateField<Key extends keyof NotebookFormState>(key: Key, value: NotebookFormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = form.title.trim() || DEFAULT_NOTEBOOK_TITLE;

    setIsSubmitting(true);

    await onCreate({
      ...form,
      title: normalizedTitle,
    });

    setIsSubmitting(false);
    setForm(buildInitialState(initialValues));

    if (closeDelayMs > 0) {
      closeTimeoutRef.current = window.setTimeout(() => {
        closeTimeoutRef.current = null;
        onClose();
      }, closeDelayMs);
      return;
    }

    onClose();
  }

  function handleCoverImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    updateField("coverImage", file);
    updateField("coverMode", file ? "custom" : "preset");
    event.target.value = "";
  }

  const previewCoverStyle =
    form.coverMode === "custom" && customCoverUrl
      ? {
          backgroundImage: `linear-gradient(180deg, rgba(7,9,15,.18), rgba(7,9,15,.4)), url("${customCoverUrl}")`,
          backgroundSize: "cover, cover",
          backgroundPosition: "center, center",
        }
      : {
          backgroundImage: `${coverPreset.preview}, ${notebookStyle.surface}`,
        };
  const previewStyle = {
    ...previewCoverStyle,
    "--preview-accent": notebookStyle.accent,
    "--preview-accent-soft": withAlpha(notebookStyle.accent, 0.24),
  } as CSSProperties & Record<"--preview-accent" | "--preview-accent-soft", string>;

  return (
    <Modal
      title={titleText}
      subtitle="Соберите образ блокнота из визуальных пресетов. Бумага, обложка, переплёт и стартовый инструмент сразу попадут в локальную модель."
      isOpen={isOpen}
      onClose={onClose}
    >
      <form className="create-notebook-form" onSubmit={handleSubmit}>
        <aside className="create-notebook-preview panel">
          <div className="create-notebook-preview__card">
            <div
              className="create-notebook-preview__cover"
              style={previewStyle}
            >
              <NotebookBinding bindingType={form.bindingType} />
              <div className="create-notebook-preview__shine" />
              <div className="create-notebook-preview__title-wrap">
                <h3>{form.title.trim() || "Новый блокнот"}</h3>
              </div>
            </div>
          </div>

          <div className="create-notebook-preview__meta">
            <span className="tag">{notebookType.label}</span>
            <span className="tag">{paperPreset.label}</span>
            <span className="tag">{toolPreset.label}</span>
          </div>

          <div className="stack">
            <div className="panel-label">Образ</div>
            <div className="create-notebook-preview__summary">
              <strong>{notebookStyle.label}</strong>
              <span>{notebookStyle.description}</span>
            </div>
          </div>

          <div className="stack">
            <div className="panel-label">Лист</div>
            <div className="create-notebook-sheet">
              <span
                className="create-notebook-sheet__paper"
                style={{
                  backgroundColor: form.paperColor,
                  backgroundImage: paperPreset.overlay === "none" ? undefined : paperPreset.overlay,
                }}
              />
            </div>
          </div>
        </aside>

        <div className="create-notebook-fields">
          <section className="create-notebook-section panel stack">
            <div className="section-head">
              <div>
                <h3>Основа</h3>
                <p>Название, акцент и общий характер блокнота.</p>
              </div>
            </div>

            <label className="stack">
              <span>Название</span>
              <input
                className="input"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Например, Ночной маршрут"
              />
            </label>

            <div className="stack">
              <span>Цвет акцента</span>
              <div className="color-grid">
                {colorPalette.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className={`color-pill ${form.color === presetColor ? "color-pill--active" : ""}`}
                    style={{ background: presetColor }}
                    onClick={() => updateField("color", presetColor)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="create-notebook-section panel stack">
            <div className="section-head">
              <div>
                <h3>Стиль и формат</h3>
                <p>Выберите визуальный язык и тип блокнота.</p>
              </div>
            </div>

            <div className="stack">
              <span>Стиль блокнота</span>
              <div className="preset-grid">
                {styleCards.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-card ${form.style === preset.id ? "preset-card--active" : ""}`}
                    onClick={() => updateField("style", preset.id)}
                  >
                    <span className="preset-card__swatch" style={{ background: preset.surface }}>
                      <span className="preset-card__badge">{preset.symbol}</span>
                    </span>
                    <span className="preset-card__title">{preset.label}</span>
                    <span className="preset-card__description">{preset.artwork}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="stack">
              <span>Тип блокнота</span>
              <div className="preset-grid">
                {notebookTypePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-card ${form.notebookType === preset.id ? "preset-card--active" : ""}`}
                    onClick={() => updateField("notebookType", preset.id)}
                  >
                    <span className="binding-preview">
                      <span className="binding-preview__symbol">{preset.symbol}</span>
                    </span>
                    <span className="preset-card__title">{preset.label}</span>
                    <span className="preset-card__description">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="create-notebook-section panel stack">
            <div className="section-head">
              <div>
                <h3>Внешний вид</h3>
                <p>Обложка и переплёт должны читаться сразу.</p>
              </div>
            </div>

            <div className="stack">
              <span>Обложка</span>
              <CoverPresetPicker
                selectedId={form.coverPreset}
                onSelect={(coverPresetId) => {
                  updateField("coverPreset", coverPresetId);
                  updateField("coverMode", "preset");
                  updateField("coverImage", null);
                }}
              />
            </div>

            <label className="upload-box">
              <span>Или загрузите свою обложку</span>
              <input type="file" accept="image/*" onChange={handleCoverImageChange} />
            </label>

            <div className="muted">
              {form.coverMode === "custom"
                ? form.coverImage
                  ? `Выбрана своя обложка: ${form.coverImage.name}`
                  : "Останется текущая пользовательская обложка"
                : "Используется выбранный пресет обложки"}
            </div>

            <div className="stack">
              <span>Переплёт</span>
              <BindingPresetPicker
                selectedId={form.bindingType}
                onSelect={(bindingType) => updateField("bindingType", bindingType)}
              />
            </div>
          </section>

          <section className="create-notebook-section panel stack">
            <div className="section-head">
              <div>
                <h3>Рабочая среда</h3>
                <p>Бумага, цвет листа и стартовый инструмент.</p>
              </div>
            </div>

            <div className="stack">
              <span>Тип бумаги</span>
              <PaperPresetPicker selectedId={form.paperType} onSelect={(paperType) => updateField("paperType", paperType)} />
            </div>

            <label className="stack">
              <span>Цвет листа</span>
              <input
                className="color-input"
                type="color"
                value={form.paperColor}
                onChange={(event) => updateField("paperColor", event.target.value)}
              />
            </label>

            <div className="stack">
              <span>Инструмент по умолчанию</span>
              <ToolPresetPicker selectedId={form.defaultTool} onSelect={(toolId) => updateField("defaultTool", toolId)} />
            </div>
          </section>

          <div className="inline-actions">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Сохраняем..." : submitText}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
