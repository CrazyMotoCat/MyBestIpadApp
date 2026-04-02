import { expect, test } from "@playwright/test";
import { acceptAppConfirm, makeFilePayload } from "./test-helpers";

const WARNING_ASSET_SIZE = 12 * 1024 * 1024;
const BLOCKED_ASSET_SIZE = 32 * 1024 * 1024 + 1;

test.describe("Sprint 2 upload preflight", () => {
  test("blocks oversized cover uploads and accepts warning-sized background uploads", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Создать" }).click();
    const createDialog = page.getByRole("dialog", { name: "Создать блокнот" });
    await expect(createDialog).toBeVisible();

    await createDialog.locator('input[type="file"][accept="image/*"]').setInputFiles(
      makeFilePayload("blocked-cover.png", "image/png", BLOCKED_ASSET_SIZE),
    );
    await expect(createDialog.getByText("слишком рискованный размер")).toBeVisible();

    await createDialog.getByLabel("Закрыть").evaluate((button) => {
      (button as HTMLButtonElement).click();
    });

    await page.getByRole("button", { name: "Настроить фон приложения" }).click();
    const backgroundDialog = page.getByRole("dialog", { name: "Настроить фон приложения" });
    await expect(backgroundDialog).toBeVisible();

    await backgroundDialog.locator('input[type="file"][accept="image/*"]').setInputFiles(
      makeFilePayload("warning-background.png", "image/png", WARNING_ASSET_SIZE),
    );
    await acceptAppConfirm(page, "Загрузить фон приложения?", "Загрузить");

    await expect(backgroundDialog.locator(".preset-card--background.preset-card--active .preset-card__title")).toHaveText(
      "Своя картинка",
    );
  });

  test("warns on large page images and blocks oversized page files", async ({ page }) => {
    const notebookTitle = `Sprint 2 upload ${Date.now()}`;

    await page.goto("/");

    await page.getByRole("button", { name: "Создать" }).click();
    const createDialog = page.getByRole("dialog", { name: "Создать блокнот" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Название").fill(notebookTitle);
    await createDialog.getByRole("button", { name: "Создать" }).click();

    await expect(page).toHaveURL(/#\/pages\//);
    const coachDismiss = page.getByRole("button", { name: "Понятно" });
    if (await coachDismiss.isVisible().catch(() => false)) {
      await coachDismiss.click();
    }

    await page.getByRole("button", { name: "Вставки" }).click();

    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(
      makeFilePayload("warning-image.png", "image/png", WARNING_ASSET_SIZE),
    );
    await acceptAppConfirm(page, "Добавить изображения?", "Добавить");

    await expect(page.locator(".page-media--image")).toHaveCount(1);

    await page.getByRole("button", { name: "Вставки" }).click();
    await page.locator('input[type="file"]:not([accept])').setInputFiles(
      makeFilePayload("blocked-attachment.bin", "application/octet-stream", BLOCKED_ASSET_SIZE),
    );

    await expect(page.locator(".editor-sidebar .inline-notice--warning")).toContainText("слишком рискованный размер");
    await expect(page.locator(".page-media--file")).toHaveCount(0);
  });
});
