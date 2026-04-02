import { expect, test } from "@playwright/test";

test.describe("Sprint 3 editor happy path", () => {
  test("creates a notebook, opens the first page, writes text, and preserves it after reload", async ({ page }) => {
    const notebookTitle = `Sprint 3 E2E ${Date.now()}`;
    const noteText = `Sprint 3 happy path ${Date.now()}`;

    await page.goto("/");

    const coachDismiss = page.getByRole("button", { name: "Понятно" });
    if (await coachDismiss.isVisible().catch(() => false)) {
      await coachDismiss.click();
    }

    await page.getByRole("button", { name: "Создать" }).click();
    const dialog = page.getByRole("dialog", { name: "Создать блокнот" });
    await expect(dialog).toBeVisible();
    await page.getByLabel("Название").fill(notebookTitle);
    await dialog.getByRole("button", { name: "Создать" }).click();

    await expect(page).toHaveURL(/#\/pages\//);
    await expect(page.getByText(notebookTitle)).toBeVisible();

    await page.locator(".editor-sheet__page").click({ position: { x: 240, y: 200 } });

    const textareas = page.locator("textarea.editor-sheet__textarea");
    await expect(textareas).toHaveCount(1);
    const editor = textareas.first();

    await editor.fill(noteText);
    await page.getByRole("button", { name: "Сохранить" }).click();

    await expect(page.locator(".editor-screen__status .editor-sheet__status-pill")).toHaveText(/Все изменения сохранены/);

    await page.reload();
    await expect(page.getByText(notebookTitle)).toBeVisible();
    await expect(page.locator("textarea.editor-sheet__textarea")).toHaveValue(noteText);
  });
});
