import { describe, expect, it } from "vitest";
import {
  getNextDirtyPersistenceStatus,
  getPagePersistenceView,
  getRecoveredPagePersistenceStatus,
} from "@/features/editor/lib/pagePersistenceState";

describe("pagePersistenceState", () => {
  it("returns explicit recovery states for restored pages", () => {
    expect(getRecoveredPagePersistenceStatus(true)).toBe("conflicted");
    expect(getRecoveredPagePersistenceStatus(false)).toBe("saved");
  });

  it("keeps conflict and failure visible instead of collapsing them into a generic draft state", () => {
    expect(getNextDirtyPersistenceStatus("conflicted")).toBe("conflicted");
    expect(getNextDirtyPersistenceStatus("failed")).toBe("failed");
  });

  it("describes user-facing save and restore states", () => {
    expect(getPagePersistenceView("saving")).toEqual({
      label: "Сохраняем",
      description: "Сейчас закрепляем изменения страницы в локальной базе.",
      tone: "save",
    });

    expect(getPagePersistenceView("restoring")).toEqual({
      label: "Восстанавливаем",
      description: "Поднимаем локальное состояние после перезапуска или прерванной сессии.",
      tone: "warning",
    });
  });
});
