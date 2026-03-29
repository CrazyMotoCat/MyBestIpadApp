import { Navigate, createHashRouter } from "react-router-dom";
import { PageEditorPage } from "@/features/editor/screens/PageEditorPage";
import { NotebooksPage } from "@/features/notebooks/screens/NotebooksPage";
import { NotebookPage } from "@/features/pages/screens/NotebookPage";
import { AppShell } from "@/shared/ui/AppShell";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <NotebooksPage />,
      },
      {
        path: "notebooks/:notebookId",
        element: <NotebookPage />,
      },
      {
        path: "pages/:pageId",
        element: <PageEditorPage />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
