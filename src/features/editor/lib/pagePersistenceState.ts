export type PagePersistenceStatus =
  | "loading"
  | "dirty"
  | "saving"
  | "saved"
  | "restoring"
  | "conflicted"
  | "failed";

export interface PagePersistenceView {
  label: string;
  description: string;
  tone: "quiet" | "save" | "warning" | "error";
}

const PAGE_PERSISTENCE_VIEWS: Record<PagePersistenceStatus, PagePersistenceView> = {
  loading: {
    label: "Загрузка",
    description: "Поднимаем страницу и локальные черновики.",
    tone: "quiet",
  },
  dirty: {
    label: "Черновик",
    description: "Есть локальные изменения, которые ещё не закреплены в сохранённой версии страницы.",
    tone: "quiet",
  },
  saving: {
    label: "Сохраняем",
    description: "Сейчас закрепляем изменения страницы в локальной базе.",
    tone: "save",
  },
  saved: {
    label: "Все изменения сохранены",
    description: "Текущая версия страницы уже записана в сохранённое состояние.",
    tone: "save",
  },
  restoring: {
    label: "Восстанавливаем",
    description: "Поднимаем локальное состояние после перезапуска или прерванной сессии.",
    tone: "warning",
  },
  conflicted: {
    label: "Есть восстановленный черновик",
    description: "Страница открыта с локальным восстановлением. Сохраните или сбросьте этот черновик.",
    tone: "warning",
  },
  failed: {
    label: "Ошибка сохранения",
    description: "Не удалось закрепить изменения. Локальный черновик пока остаётся в памяти устройства.",
    tone: "error",
  },
};

export function getPagePersistenceView(status: PagePersistenceStatus) {
  return PAGE_PERSISTENCE_VIEWS[status];
}

export function getRecoveredPagePersistenceStatus(hasRecoveredDraft: boolean): PagePersistenceStatus {
  return hasRecoveredDraft ? "conflicted" : "saved";
}

export function getNextDirtyPersistenceStatus(current: PagePersistenceStatus): PagePersistenceStatus {
  if (current === "conflicted" || current === "failed") {
    return current;
  }

  if (current === "loading" || current === "restoring") {
    return current;
  }

  return "dirty";
}
