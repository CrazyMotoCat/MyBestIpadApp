export const SOFT_ASSET_SIZE_LIMIT_BYTES = 12 * 1024 * 1024;

export class StorageWriteError extends Error {
  readonly code: "quota-exceeded" | "write-failed" | "file-too-large";

  constructor(
    message: string,
    code: "quota-exceeded" | "write-failed" | "file-too-large",
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "StorageWriteError";
    this.code = code;

    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
      });
    }
  }
}

export interface StorageEstimateSnapshot {
  quotaBytes: number | null;
  usageBytes: number | null;
  availableBytes: number | null;
}

export function formatStorageBytes(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Недоступно";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} КБ`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

export function createOversizedAssetError(size: number) {
  return new StorageWriteError(
    `Файл слишком большой для локального хранения на iPad Safari: ${formatStorageBytes(size)}. Лучше уменьшить его или разбить на более лёгкие вложения.`,
    "file-too-large",
  );
}

export function isQuotaExceededError(error: unknown) {
  if (error instanceof StorageWriteError) {
    return error.code === "quota-exceeded";
  }

  if (!(error instanceof DOMException)) {
    return false;
  }

  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    (error.name === "AbortError" && /quota|storage|space|disk/i.test(error.message))
  );
}

export function toStorageWriteError(error: unknown, context: string) {
  if (error instanceof StorageWriteError) {
    return error;
  }

  if (isQuotaExceededError(error)) {
    return new StorageWriteError(`Недостаточно места в локальном хранилище, чтобы ${context}.`, "quota-exceeded", {
      cause: error,
    });
  }

  return new StorageWriteError(`Не удалось ${context}. Проверьте локальное хранилище и повторите попытку.`, "write-failed", {
    cause: error,
  });
}

export function getStorageRecoveryMessage(error: unknown, entityLabel: string) {
  if (error instanceof StorageWriteError && error.code === "file-too-large") {
    return error.message;
  }

  if (isQuotaExceededError(error)) {
    return `Не удалось сохранить ${entityLabel}: в локальном хранилище Safari почти не осталось места. Попробуйте удалить ненужные блокноты или крупные вложения, либо экспортировать backup.`;
  }

  return `Не удалось сохранить ${entityLabel}. Проверьте локальное хранилище и повторите попытку.`;
}

export async function getStorageEstimateSnapshot(): Promise<StorageEstimateSnapshot> {
  if (!("storage" in navigator) || typeof navigator.storage?.estimate !== "function") {
    return {
      quotaBytes: null,
      usageBytes: null,
      availableBytes: null,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const quotaBytes = estimate.quota ?? null;
    const usageBytes = estimate.usage ?? null;

    return {
      quotaBytes,
      usageBytes,
      availableBytes: quotaBytes !== null && usageBytes !== null ? Math.max(0, quotaBytes - usageBytes) : null,
    };
  } catch {
    return {
      quotaBytes: null,
      usageBytes: null,
      availableBytes: null,
    };
  }
}

export function getStoragePressureWarningMessage(entityLabel: string, projectedBytes: number, availableBytes: number | null) {
  if (availableBytes === null || projectedBytes <= availableBytes * 0.35) {
    return null;
  }

  if (projectedBytes > availableBytes * 0.95) {
    return `Похоже, что ${entityLabel} слишком большой для текущего запаса локального хранилища. Нужно около ${formatStorageBytes(projectedBytes)}, а свободно примерно ${formatStorageBytes(availableBytes)}.`;
  }

  return `У ${entityLabel} большой размер: около ${formatStorageBytes(projectedBytes)}. Свободного места в локальном хранилище осталось примерно ${formatStorageBytes(availableBytes)}, поэтому на iPad Safari лучше продолжать осторожнее.`;
}

export function throwIfLikelyOverQuota(entityLabel: string, projectedBytes: number, availableBytes: number | null) {
  if (availableBytes === null || projectedBytes <= availableBytes * 0.95) {
    return;
  }

  throw new StorageWriteError(
    `Недостаточно места для ${entityLabel}. Нужно около ${formatStorageBytes(projectedBytes)}, а свободно примерно ${formatStorageBytes(availableBytes)}.`,
    "quota-exceeded",
  );
}
