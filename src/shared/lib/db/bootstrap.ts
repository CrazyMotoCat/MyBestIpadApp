import { ensureDrawingLayer, saveTextElement } from "@/features/editor/api/editor";
import { createNotebook } from "@/features/notebooks/api/notebooks";
import { createPage } from "@/features/pages/api/pages";
import { getDatabase } from "@/shared/lib/db/database";

let bootstrapPromise: Promise<void> | null = null;

export function ensureBootstrapData() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const db = await getDatabase();
      const notebooksCount = await db.count("notebooks");

      if (notebooksCount > 0) {
        return;
      }

      const notebook = await createNotebook({
        title: "Мой гаражный блокнот",
        color: "#5d78ff",
        style: "nebula-carbon",
        notebookType: "garage-log",
        paperType: "lined",
        paperColor: "#f7f2e6",
        defaultTool: "ballpoint",
        coverPreset: "carbon-metal",
        bindingType: "spiral",
        coverMode: "preset",
      });

      const page = await createPage(notebook.id, "Первый выезд");
      await saveTextElement(
        page.id,
        "Здесь можно писать заметки, рисовать схемы, хранить изображения и прикреплять файлы полностью офлайн.",
      );
      await ensureDrawingLayer(page.id, notebook.defaultTool);
    })();
  }

  return bootstrapPromise;
}
