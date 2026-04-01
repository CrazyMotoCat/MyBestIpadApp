import { getDatabase } from "@/shared/lib/db/database";

const STORAGE_HEALTH_KEY = "mybestipadapp:storage-health";

export type StorageWriteOutcome = "success" | "failure";

export interface StorageHealthWriteStatus {
  outcome: StorageWriteOutcome;
  operation: string;
  message: string;
  timestamp: string;
}

export interface StorageAvailabilityStatus {
  checkedAt: string;
  indexedDbAvailable: boolean;
  localStorageAvailable: boolean;
  databaseAvailable: boolean;
}

export interface StorageHealthSnapshot extends StorageAvailabilityStatus {
  lastWrite: StorageHealthWriteStatus | null;
}

export interface StorageHealthSummary {
  tone: "ready" | "warning" | "danger";
  title: string;
  description: string;
  availability: StorageAvailabilityStatus;
  lastWrite: StorageHealthWriteStatus | null;
  details: string[];
}

function nowIso() {
  return new Date().toISOString();
}

function getLocalStorage() {
  return typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;
}

function readJsonFromStorage<T>(storage: Storage | undefined, key: string) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonToStorage(storage: Storage | undefined, key: string, value: unknown) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeFromStorage(storage: Storage | undefined, key: string) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage availability issues and keep the app usable.
  }
}

function isLocalStorageAvailable() {
  try {
    const storage = getLocalStorage();

    if (!storage) {
      return false;
    }

    const probeKey = `${STORAGE_HEALTH_KEY}:probe`;
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

async function isIndexedDbAvailable() {
  if (typeof globalThis.indexedDB === "undefined") {
    return false;
  }

  try {
    await getDatabase();
    return true;
  } catch {
    return false;
  }
}

export function readStorageHealthStatus() {
  return readJsonFromStorage<StorageHealthWriteStatus>(getLocalStorage(), STORAGE_HEALTH_KEY);
}

export function writeStorageHealthStatus(status: Omit<StorageHealthWriteStatus, "timestamp"> & { timestamp?: string }) {
  const nextStatus: StorageHealthWriteStatus = {
    outcome: status.outcome,
    operation: status.operation,
    message: status.message,
    timestamp: status.timestamp ?? nowIso(),
  };

  writeJsonToStorage(getLocalStorage(), STORAGE_HEALTH_KEY, nextStatus);
  return nextStatus;
}

export function recordStorageWriteSuccess(operation: string, message: string) {
  return writeStorageHealthStatus({
    outcome: "success",
    operation,
    message,
  });
}

export function recordStorageWriteFailure(operation: string, error: unknown, fallbackMessage = "Storage write failed") {
  const message = error instanceof Error ? error.message : fallbackMessage;

  return writeStorageHealthStatus({
    outcome: "failure",
    operation,
    message,
  });
}

export function clearStorageHealthStatus() {
  removeFromStorage(getLocalStorage(), STORAGE_HEALTH_KEY);
}

export async function getStorageAvailabilityStatus(): Promise<StorageAvailabilityStatus> {
  const [indexedDbAvailable, localStorageAvailable] = await Promise.all([isIndexedDbAvailable(), Promise.resolve(isLocalStorageAvailable())]);

  return {
    checkedAt: nowIso(),
    indexedDbAvailable,
    localStorageAvailable,
    databaseAvailable: indexedDbAvailable,
  };
}

export async function getStorageHealthSnapshot(): Promise<StorageHealthSnapshot> {
  const availability = await getStorageAvailabilityStatus();

  return {
    ...availability,
    lastWrite: readStorageHealthStatus(),
  };
}

function formatStatusTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getStorageHealthSummary(snapshot: StorageHealthSnapshot): StorageHealthSummary {
  const details = [
    `IndexedDB: ${snapshot.indexedDbAvailable ? "доступна" : "недоступна"}`,
    `localStorage: ${snapshot.localStorageAvailable ? "доступен" : "недоступен"}`,
  ];

  if (snapshot.lastWrite) {
    details.push(
      `Последняя запись: ${snapshot.lastWrite.outcome === "success" ? "успех" : "ошибка"} • ${snapshot.lastWrite.operation} • ${formatStatusTimestamp(snapshot.lastWrite.timestamp)}`,
    );
    details.push(`Сообщение: ${snapshot.lastWrite.message}`);
  } else {
    details.push("Последняя запись: нет сохранённого статуса");
  }

  if (!snapshot.indexedDbAvailable) {
    return {
      tone: "danger",
      title: "Локальная БД недоступна",
      description: "IndexedDB не отвечает, поэтому persistence и recovery могут быть недоступны.",
      availability: snapshot,
      lastWrite: snapshot.lastWrite,
      details,
    };
  }

  if (!snapshot.localStorageAvailable || snapshot.lastWrite?.outcome === "failure") {
    return {
      tone: "warning",
      title: "Хранилище работает с риском",
      description: "Базовая БД доступна, но локальный журнал состояния или последняя запись указывают на проблему.",
      availability: snapshot,
      lastWrite: snapshot.lastWrite,
      details,
    };
  }

  return {
    tone: "ready",
    title: "Локальное хранилище в порядке",
    description: "IndexedDB и локальный журнал статуса доступны, можно опираться на local-first поведение.",
    availability: snapshot,
    lastWrite: snapshot.lastWrite,
    details,
  };
}

export async function getStorageHealthSummarySnapshot() {
  return getStorageHealthSummary(await getStorageHealthSnapshot());
}
