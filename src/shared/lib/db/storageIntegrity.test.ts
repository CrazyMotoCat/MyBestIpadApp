import { describe, expect, it } from "vitest";
import { buildStorageIntegrityReport } from "@/shared/lib/db/storageIntegrity";

describe("buildStorageIntegrityReport", () => {
  it("находит orphan assets и битые singleton-ссылки", () => {
    const report = buildStorageIntegrityReport({
      notebooks: [
        {
          id: "notebook-1",
          title: "Тест",
          color: "#000",
          style: "nebula-carbon",
          stylePreset: "nebula-carbon",
          notebookType: "garage-log",
          paperType: "lined",
          defaultPaperType: "lined",
          defaultPaperColor: "#fff",
          defaultTool: "ballpoint",
          coverPreset: "carbon-metal",
          coverMode: "custom",
          coverImageAssetId: "missing-cover",
          coverBackground: "",
          bindingType: "spiral",
          createdAt: "",
          updatedAt: "",
        },
      ],
      pages: [],
      pageElements: [
        {
          id: "element-1",
          pageId: "missing-page",
          type: "image",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 1,
          createdAt: "",
          updatedAt: "",
          assetId: "missing-asset",
          name: "image.png",
          mimeType: "image/png",
          size: 10,
          caption: "",
        },
      ],
      assets: [
        {
          id: "orphan-asset",
          kind: "image",
          ownerId: "missing-owner",
          blob: new Blob(["a"]),
          name: "a",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
      ],
      notebookAttachments: [
        {
          id: "attachment-1",
          notebookId: "notebook-1",
          assetId: "missing-attachment-asset",
          name: "a",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
      ],
      appSettings: {
        id: "app-settings",
        backgroundMode: "custom",
        backgroundId: "deep-space",
        customBackgroundAssetId: "missing-background",
        backgroundDimAmount: 0.5,
        backgroundBlurAmount: 0,
        updatedAt: "",
      },
    });

    expect(report.orphanAssetIds).toEqual(["orphan-asset"]);
    expect(report.orphanAssetBytes).toBe(1);
    expect(report.danglingNotebookAttachmentIds).toEqual(["attachment-1"]);
    expect(report.danglingPageElementIds).toEqual(["element-1"]);
    expect(report.missingCoverNotebookIds).toEqual(["notebook-1"]);
    expect(report.missingBackgroundAsset).toBe(true);
  });
});
