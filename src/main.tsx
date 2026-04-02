import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import "@/app/styles.css";
import { registerServiceWorker } from "@/shared/lib/pwa/registerServiceWorker";
import { ConfirmProvider } from "@/shared/ui/ConfirmProvider";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfirmProvider>
      <RouterProvider router={router} />
    </ConfirmProvider>
  </React.StrictMode>,
);
