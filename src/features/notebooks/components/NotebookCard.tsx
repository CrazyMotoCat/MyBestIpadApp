import { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { NotebookBinding } from "@/features/notebooks/components/NotebookBinding";
import { getCoverPreset } from "@/shared/config/coverPresets";
import { notebookStylePresets } from "@/shared/config/notebookPresets";
import { useAssetObjectUrl } from "@/shared/lib/useAssetObjectUrl";
import { Notebook } from "@/shared/types/models";

interface NotebookCardProps {
  notebook: Notebook;
  pagesCount: number;
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

function buildNotebookStyle(notebook: Notebook, coverImageUrl: string | null, pagesCount: number): CSSProperties {
  const notebookStyle = notebookStylePresets.find((preset) => preset.id === notebook.style);
  const coverPreset = getCoverPreset(notebook.coverPreset);
  const accent = notebookStyle?.accent ?? notebook.color;
  const thickness = Math.min(30, 12 + Math.max(0, pagesCount - 1) * 1.6);
  const coverBackground =
    notebook.coverMode === "custom" && coverImageUrl
      ? `${notebook.coverBackground}, linear-gradient(180deg, rgba(7,9,15,.18), rgba(7,9,15,.4)), url("${coverImageUrl}") center / cover no-repeat`
      : `${notebook.coverBackground}, ${coverPreset.preview}`;

  return {
    "--notebook-accent": accent,
    "--notebook-accent-soft": withAlpha(accent, 0.26),
    "--notebook-surface": notebookStyle?.surface ?? notebook.coverBackground,
    "--notebook-cover": coverBackground,
    "--notebook-thickness": `${thickness}px`,
  } as CSSProperties;
}

export function NotebookCard({ notebook, pagesCount }: NotebookCardProps) {
  const coverImageUrl = useAssetObjectUrl(notebook.coverImageAssetId);
  const hasTitle = notebook.title.trim().length > 0;

  return (
    <Link className="notebook-link" to={`/notebooks/${notebook.id}`}>
      <article className="notebook-object" style={buildNotebookStyle(notebook, coverImageUrl, pagesCount)}>
        <div className="notebook-object__shadow" aria-hidden="true" />
        <div className="notebook-object__stack" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="notebook-object__body">
          <div className="notebook-object__spine" aria-hidden="true" />
          <div className="notebook-object__cover">
            <NotebookBinding bindingType={notebook.bindingType} />
            <div className="notebook-object__grain" aria-hidden="true" />
            <div className="notebook-object__shine" aria-hidden="true" />
            <div className="notebook-object__title-wrap">
              {hasTitle ? <h3 className="notebook-object__title">{notebook.title}</h3> : null}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
