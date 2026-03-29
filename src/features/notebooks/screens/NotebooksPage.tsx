import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { createNotebook, listNotebooks } from "@/features/notebooks/api/notebooks";
import { BackgroundSettingsModal } from "@/features/notebooks/components/BackgroundSettingsModal";
import { CreateNotebookModal } from "@/features/notebooks/components/CreateNotebookModal";
import { NotebookCard } from "@/features/notebooks/components/NotebookCard";
import { listPages } from "@/features/pages/api/pages";
import { getAppBackgroundPreset } from "@/shared/config/appBackgroundPresets";
import { ensureBootstrapData } from "@/shared/lib/db/bootstrap";
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
            <NotebookCard key={notebook.id} notebook={notebook} pagesCount={notebook.pagesCount} />
          ))}
        </div>
      </section>

      <CreateNotebookModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (input) => {
          const notebook = await createNotebook(input);
          await load();
          navigate(`/notebooks/${notebook.id}`);
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
          void uploadBackground(file);
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
