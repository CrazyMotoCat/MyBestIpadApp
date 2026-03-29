import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getOrCreateNotebookEntryPage } from "@/features/pages/api/pages";
import { Panel } from "@/shared/ui/Panel";

export function NotebookEntryPage() {
  const { notebookId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "missing">("loading");

  useEffect(() => {
    let isActive = true;

    async function openNotebook() {
      if (!notebookId) {
        if (isActive) {
          setStatus("missing");
        }
        return;
      }

      setStatus("loading");

      try {
        const page = await getOrCreateNotebookEntryPage(notebookId);

        if (!isActive) {
          return;
        }

        navigate(`/pages/${page.id}`, { replace: true });
      } catch (error) {
        console.error("Failed to open notebook", error);

        if (isActive) {
          setStatus("missing");
        }
      }
    }

    void openNotebook();

    return () => {
      isActive = false;
    };
  }, [navigate, notebookId]);

  if (status === "loading") {
    return (
      <section className="page-section">
        <Panel className="empty-state">Открываем блокнот и подготавливаем рабочую страницу...</Panel>
      </section>
    );
  }

  return (
    <section className="page-section">
      <Panel className="empty-state">
        Блокнот не найден. <Link to="/">Вернуться к списку</Link>
      </Panel>
    </section>
  );
}
