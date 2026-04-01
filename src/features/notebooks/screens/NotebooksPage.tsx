import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { createNotebook, deleteNotebook, listNotebooks } from "@/features/notebooks/api/notebooks";
import { BackgroundSettingsModal } from "@/features/notebooks/components/BackgroundSettingsModal";
import { CreateNotebookModal } from "@/features/notebooks/components/CreateNotebookModal";
import { NotebookCard } from "@/features/notebooks/components/NotebookCard";
import { listPages } from "@/features/pages/api/pages";
import { getAppBackgroundPreset } from "@/shared/config/appBackgroundPresets";
import { ensureBootstrapData } from "@/shared/lib/db/bootstrap";
import { getStorageRecoveryMessage } from "@/shared/lib/db/storageErrors";
import { getAssetUploadPreflight } from "@/shared/lib/db/storagePreflight";
import { Notebook } from "@/shared/types/models";
import { Button } from "@/shared/ui/Button";
import { AppShellContextValue } from "@/shared/ui/AppShell";

interface NotebookCardData extends Notebook {
  pagesCount: number;
}

export function NotebooksPage() {
  const navigate = useNavigate();
  const { settings, updateBackground, uploadBackground, updateBackgroundDim, updateBackgroundBlur } =
    useOutletContext<AppShellContextValue>();
  const backgroundPreset = getAppBackgroundPreset(settings.backgroundId);
  const [notebooks, setNotebooks] = useState<NotebookCardData[]>([]);
  const [isBusy, setIsBusy] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBackgroundOpen, setIsBackgroundOpen] = useState(false);
  const [draggedNotebookId, setDraggedNotebookId] = useState<string | null>(null);
  const [isTrashHover, setIsTrashHover] = useState(false);
  const [deletingNotebookId, setDeletingNotebookId] = useState<string | null>(null);
  const [deleteOffset, setDeleteOffset] = useState({ x: 0, y: 0 });
  const [deleteDragOffset, setDeleteDragOffset] = useState({ x: 0, y: 0 });
  const [backgroundUploadError, setBackgroundUploadError] = useState<string | null>(null);
  const trashButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);

  async function load() {
    setIsBusy(true);
    await ensureBootstrapData();
    const items = await listNotebooks();
    const withCounts = await Promise.all(
      items.map(async (notebook) => ({
        ...notebook,
        pagesCount: (await listPages(notebook.id)).length,
      })),
    );
    setNotebooks(withCounts);
    setIsBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current !== null) {
        window.clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  function getTrashBounds() {
    return trashButtonRef.current?.getBoundingClientRect() ?? null;
  }

  function isPointInsideTrash(point: { x: number; y: number }) {
    const trashBounds = getTrashBounds();
    if (!trashBounds) {
      return false;
    }

    return (
      point.x >= trashBounds.left &&
      point.x <= trashBounds.right &&
      point.y >= trashBounds.top &&
      point.y <= trashBounds.bottom
    );
  }

  function handleNotebookDragStart(notebookId: string) {
    setDraggedNotebookId(notebookId);
    setIsTrashHover(false);
  }

  function handleNotebookDragMove(point: { x: number; y: number }) {
    setIsTrashHover(isPointInsideTrash(point));
  }

  async function handleNotebookDragEnd(
    notebookId: string,
    point: { x: number; y: number },
    rect: DOMRect | null,
    dragOffset: { x: number; y: number },
  ) {
    const shouldDelete = isPointInsideTrash(point);
    setDraggedNotebookId(null);
    setIsTrashHover(false);

    if (!shouldDelete || !rect) {
      return;
    }

    const trashBounds = getTrashBounds();
    if (!trashBounds) {
      return;
    }

    setDeletingNotebookId(notebookId);
    setDeleteDragOffset(dragOffset);
    setDeleteOffset({
      x: trashBounds.left + trashBounds.width / 2 - (rect.left + rect.width / 2),
      y: trashBounds.top + trashBounds.height / 2 - (rect.top + rect.height / 2),
    });

    deleteTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        await deleteNotebook(notebookId);
        setNotebooks((current) => current.filter((item) => item.id !== notebookId));
        setDeletingNotebookId(null);
        setDeleteOffset({ x: 0, y: 0 });
        setDeleteDragOffset({ x: 0, y: 0 });
      })();
    }, 340);
  }

  return (
    <section className="page-section notebooks-screen">
      <header className="hero-block">
        <span className="hero-block__eyebrow">Офлайн-блокнот для iPad</span>
        <h1 className="hero-block__title">Мои блокноты</h1>
        <p className="hero-block__subtitle">
          Космос, мото-эстетика и локальное хранение без сервера. Блокноты, страницы, рисунки, изображения, файлы и фон
          приложения сохраняются прямо на устройстве.
        </p>
        <div className="hero-block__actions">
          <Button onClick={() => setIsCreateOpen(true)}>Создать</Button>
          <Button variant="ghost" onClick={() => setIsBackgroundOpen(true)}>
            Настроить фон приложения
          </Button>
        </div>
        {backgroundUploadError ? <div className="inline-notice inline-notice--warning">{backgroundUploadError}</div> : null}
      </header>

      <div className="screen-caption">
        <span>{notebooks.length} блокнотов</span>
        <span>Фон: {settings.backgroundMode === "custom" ? "Своя картинка" : backgroundPreset.label}</span>
      </div>

      <section className="notebooks-gallery panel">
        <div className="grid grid--notebooks">
          {!isBusy && notebooks.length === 0 ? (
            <div className="empty-state empty-state--wide">
              Пока здесь пусто. Создайте первый блокнот и задайте ему свой характер.
            </div>
          ) : null}

          {notebooks.map((notebook) => (
            <NotebookCard
              key={notebook.id}
              notebook={notebook}
              pagesCount={notebook.pagesCount}
              isDeleting={deletingNotebookId === notebook.id}
              deleteOffset={deletingNotebookId === notebook.id ? deleteOffset : undefined}
              deleteDragOffset={deletingNotebookId === notebook.id ? deleteDragOffset : undefined}
              onOpen={(notebookId) => navigate(`/notebooks/${notebookId}`)}
              onDragStart={handleNotebookDragStart}
              onDragMove={handleNotebookDragMove}
              onDragEnd={handleNotebookDragEnd}
            />
          ))}
        </div>
      </section>

      {notebooks.length > 0 ? (
        <div className="notebooks-screen__dock">
          <button
            ref={trashButtonRef}
            type="button"
            className={`trash-dropzone ${draggedNotebookId ? "trash-dropzone--ready" : ""} ${
              isTrashHover ? "trash-dropzone--hot" : ""
            } ${deletingNotebookId ? "trash-dropzone--consume" : ""}`}
            aria-label={draggedNotebookId ? "Перетащите блокнот в корзину" : "Корзина для удаления блокнотов"}
            title={draggedNotebookId ? "Перетащите блокнот в корзину" : "Корзина для удаления блокнотов"}
          >
            {"\u{1F5D1}"}
          </button>
        </div>
      ) : null}

      <CreateNotebookModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (input) => {
          const notebook = await createNotebook(input);
          setIsCreateOpen(false);
          navigate(`/notebooks/${notebook.id}`);
          void load();
          return notebook;
        }}
      />

      <BackgroundSettingsModal
        isOpen={isBackgroundOpen}
        settings={settings}
        onClose={() => setIsBackgroundOpen(false)}
        onSelect={(backgroundId) => {
          void updateBackground(backgroundId);
        }}
        onUpload={(file) => {
          const preflight = getAssetUploadPreflight(file, "Фон приложения");

          if (preflight.level === "blocked") {
            setBackgroundUploadError(preflight.message);
            return;
          }

          if (
            preflight.level === "warning" &&
            preflight.message &&
            !window.confirm(`${preflight.message}\n\nПродолжить загрузку фона?`)
          ) {
            setBackgroundUploadError(preflight.message);
            return;
          }

          void uploadBackground(file)
            .then(() => {
              setBackgroundUploadError(null);
            })
            .catch((error) => {
              console.error("Background upload failed", error);
              setBackgroundUploadError(getStorageRecoveryMessage(error, "фон приложения"));
            });
        }}
        onDimChange={(dimAmount) => {
          void updateBackgroundDim(dimAmount);
        }}
        onBlurChange={(blurAmount) => {
          void updateBackgroundBlur(blurAmount);
        }}
      />
    </section>
  );
}
