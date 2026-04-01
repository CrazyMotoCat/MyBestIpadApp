import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  downloadDatabaseBackup,
  getBackupExportWarning,
  formatBackupSummary,
  getBackupImportWarning,
  importDatabaseBackup,
} from "@/shared/lib/db/backup";
import { getOfflineReadinessView, getStandaloneState } from "@/shared/lib/pwa/offlineReadiness";
import { formatStorageBytes } from "@/shared/lib/db/storageErrors";
import { auditStorageIntegrity, repairStorageIntegrity, StorageIntegrityReport } from "@/shared/lib/db/storageIntegrity";
import { getStorageInsightsSummary, StorageInsightsSummary } from "@/shared/lib/db/storageInsights";

interface PwaStatusSnapshot {
  isOnline: boolean;
  isStandalone: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  isControlled: boolean;
  hasOfflineShell: boolean;
  storageQuotaBytes: number | null;
  storageUsageBytes: number | null;
  isPersistentStorage: boolean | null;
}

interface ServiceWorkerRuntimeStatus {
  cacheVersion: string | null;
  checkedAt: string | null;
  hasOfflineShell: boolean | null;
}

const STATIC_CACHE = "mybestipadapp-static-v7";

async function probeOfflineShell() {
  if (!window.isSecureContext || !("caches" in window)) {
    return false;
  }

  try {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    const scopeUrl = new URL("./", baseUrl).toString();
    const indexUrl = new URL("./index.html", baseUrl).toString();
    const offlineUrl = new URL("./offline.html", baseUrl).toString();
    const cache = await caches.open(STATIC_CACHE);

    const [shellResponse, indexResponse, offlineResponse] = await Promise.all([
      cache.match(scopeUrl, { ignoreSearch: true }),
      cache.match(indexUrl, { ignoreSearch: true }),
      cache.match(offlineUrl, { ignoreSearch: true }),
    ]);

    return Boolean(shellResponse || indexResponse || offlineResponse);
  } catch {
    return false;
  }
}

function getStatusTone(snapshot: PwaStatusSnapshot) {
  if (snapshot.hasServiceWorker && snapshot.isControlled && snapshot.hasOfflineShell) {
    return "ready";
  }

  if (snapshot.hasServiceWorker) {
    return "partial";
  }

  return "missing";
}

function getStorageUsagePercent(snapshot: PwaStatusSnapshot) {
  if (!snapshot.storageQuotaBytes || !snapshot.storageUsageBytes) {
    return null;
  }

  return Math.min(100, Math.round((snapshot.storageUsageBytes / snapshot.storageQuotaBytes) * 100));
}

function getStorageUsageTone(percent: number | null) {
  if (percent === null) {
    return "neutral";
  }

  if (percent >= 85) {
    return "danger";
  }

  if (percent >= 65) {
    return "warning";
  }

  return "safe";
}

function getStorageRecoverySteps(tone: "neutral" | "safe" | "warning" | "danger") {
  if (tone === "danger") {
    return [
      "Сначала вручную сохраните текущую страницу.",
      "Удалите ненужные блокноты или тяжёлые вложения с изображениями.",
      "Не добавляйте новые крупные файлы, пока запас по памяти не освободится.",
    ];
  }

  if (tone === "warning") {
    return [
      "Проверьте, нет ли лишних изображений и файлов в текущих блокнотах.",
      "Перед длинной офлайн-сессией лучше вручную сохранить страницу.",
      "С крупными вложениями стоит работать осторожнее, особенно на iPad Safari.",
    ];
  }

  return [];
}

function formatRuntimeCheckedAt(value: string | null) {
  if (!value) {
    return null;
  }

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

function getInstallChecklist(snapshot: PwaStatusSnapshot, swRuntimeStatus: ServiceWorkerRuntimeStatus) {
  return [
    {
      id: "secure-context",
      label: "Открыто по HTTPS с доступным Service Worker",
      done: snapshot.isSecureContext && snapshot.hasServiceWorker,
      hint: "Без этого офлайн-PWA на iPad не сможет работать предсказуемо.",
    },
    {
      id: "shell-ready",
      label: "Service Worker подтвердил прогрев shell",
      done: snapshot.isControlled && swRuntimeStatus.hasOfflineShell === true,
      hint: "Лучше один раз открыть приложение онлайн и дождаться полной загрузки.",
    },
    {
      id: "standalone",
      label: "Приложение открыто как иконка на iPad",
      done: snapshot.isStandalone,
      hint: "На iPad это обычно путь Поделиться → На экран Домой, после чего лучше запускать приложение уже через иконку.",
    },
  ];
}

async function collectSnapshot(): Promise<PwaStatusSnapshot> {
  let storageQuotaBytes: number | null = null;
  let storageUsageBytes: number | null = null;
  let isPersistentStorage: boolean | null = null;

  if ("storage" in navigator && typeof navigator.storage?.estimate === "function") {
    try {
      const estimate = await navigator.storage.estimate();
      storageQuotaBytes = estimate.quota ?? null;
      storageUsageBytes = estimate.usage ?? null;
    } catch {
      storageQuotaBytes = null;
      storageUsageBytes = null;
    }
  }

  if ("storage" in navigator && typeof navigator.storage?.persisted === "function") {
    try {
      isPersistentStorage = await navigator.storage.persisted();
    } catch {
      isPersistentStorage = null;
    }
  }

  return {
    isOnline: navigator.onLine,
    isStandalone: getStandaloneState(),
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    isControlled: Boolean(navigator.serviceWorker?.controller),
    hasOfflineShell: await probeOfflineShell(),
    storageQuotaBytes,
    storageUsageBytes,
    isPersistentStorage,
  };
}

export function PwaStatusBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRequestingPersistentStorage, setIsRequestingPersistentStorage] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isRepairingStorage, setIsRepairingStorage] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [swRuntimeStatus, setSwRuntimeStatus] = useState<ServiceWorkerRuntimeStatus>({
    cacheVersion: null,
    checkedAt: null,
    hasOfflineShell: null,
  });
  const [storageInsights, setStorageInsights] = useState<StorageInsightsSummary | null>(null);
  const [storageIntegrity, setStorageIntegrity] = useState<StorageIntegrityReport | null>(null);
  const [snapshot, setSnapshot] = useState<PwaStatusSnapshot>({
    isOnline: navigator.onLine,
    isStandalone: getStandaloneState(),
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    isControlled: Boolean(navigator.serviceWorker?.controller),
    hasOfflineShell: false,
    storageQuotaBytes: null,
    storageUsageBytes: null,
    isPersistentStorage: null,
  });
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const [nextSnapshot, nextInsights, nextIntegrity] = await Promise.all([
      collectSnapshot(),
      getStorageInsightsSummary(),
      auditStorageIntegrity(),
    ]);
    setSnapshot(nextSnapshot);
    setStorageInsights(nextInsights);
    setStorageIntegrity(nextIntegrity);
  }, []);

  const requestServiceWorkerStatus = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "REQUEST_STATUS" });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const refreshIfMounted = async () => {
      const [nextSnapshot, nextInsights, nextIntegrity] = await Promise.all([
        collectSnapshot(),
        getStorageInsightsSummary(),
        auditStorageIntegrity(),
      ]);

      if (isMounted) {
        setSnapshot(nextSnapshot);
        setStorageInsights(nextInsights);
        setStorageIntegrity(nextIntegrity);
      }
    };

    void refreshIfMounted();

    const mediaQuery = window.matchMedia("(display-mode: standalone)") as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    const handleVisibility = () => {
      void refreshIfMounted();
    };
    const handleConnectivity = () => {
      void refreshIfMounted();
    };
    const handleControllerChange = () => {
      void refreshIfMounted();
      requestServiceWorkerStatus();
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      const payload = event.data as
        | {
            type?: string;
            cacheVersion?: string;
            checkedAt?: string;
            hasOfflineShell?: boolean;
          }
        | undefined;

      if (payload?.type !== "SW_STATUS") {
        return;
      }

      if (!isMounted) {
        return;
      }

      setSwRuntimeStatus({
        cacheVersion: payload.cacheVersion ?? null,
        checkedAt: payload.checkedAt ?? null,
        hasOfflineShell: payload.hasOfflineShell ?? null,
      });
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleVisibility);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleVisibility);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleConnectivity);
    window.addEventListener("offline", handleConnectivity);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    requestServiceWorkerStatus();

    return () => {
      isMounted = false;
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleVisibility);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleVisibility);
      }

      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleConnectivity);
      window.removeEventListener("offline", handleConnectivity);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [requestServiceWorkerStatus]);

  const tone = getStatusTone(snapshot);
  const storageUsagePercent = getStorageUsagePercent(snapshot);
  const storageTone = getStorageUsageTone(storageUsagePercent);
  const storageRecoverySteps = getStorageRecoverySteps(storageTone);
  const offlineReadiness = getOfflineReadinessView({
    isSecureContext: snapshot.isSecureContext,
    hasServiceWorker: snapshot.hasServiceWorker,
    isControlled: snapshot.isControlled,
    isStandalone: snapshot.isStandalone,
    hasOfflineShell: swRuntimeStatus.hasOfflineShell === true,
  });
  const runtimeCheckedAtLabel = formatRuntimeCheckedAt(swRuntimeStatus.checkedAt);
  const installChecklist = getInstallChecklist(snapshot, swRuntimeStatus);

  async function handleRequestPersistentStorage() {
    if (!("storage" in navigator) || typeof navigator.storage?.persist !== "function") {
      return;
    }

    try {
      setIsRequestingPersistentStorage(true);
      await navigator.storage.persist();
      await refresh();
    } finally {
      setIsRequestingPersistentStorage(false);
    }
  }

  async function handleExportBackup() {
    try {
      setIsExportingBackup(true);
      setBackupMessage(null);
      const exportWarning = await getBackupExportWarning();

      if (
        exportWarning &&
        !window.confirm(
          `${exportWarning}\n\nЭкспорт всё равно возможен, но на iPad Safari он может занять больше времени. Продолжить?`,
        )
      ) {
        return;
      }

      const summary = await downloadDatabaseBackup();
      setBackupMessage(`Локальная копия базы экспортирована в JSON-файл: ${formatBackupSummary(summary)}.`);
    } catch (error) {
      console.error("Backup export failed", error);
      setBackupMessage("Не удалось экспортировать локальную копию базы.");
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const importWarning = await getBackupImportWarning(file);

      if (
        !window.confirm(
          importWarning
            ? `${importWarning}\n\nИмпорт заменит текущую локальную базу на содержимое backup-файла. Продолжить?`
            : "Импорт заменит текущую локальную базу на содержимое backup-файла. Продолжить?",
        )
      ) {
        return;
      }

      setIsImportingBackup(true);
      setBackupMessage(null);
      await importDatabaseBackup(file);
      setBackupMessage("Backup импортирован. Перезагружаем приложение...");
      await refresh();
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error("Backup import failed", error);
      setBackupMessage(error instanceof Error ? error.message : "Не удалось импортировать backup-файл.");
    } finally {
      event.target.value = "";
      setIsImportingBackup(false);
    }
  }

  async function handleRepairStorage() {
    if (
      !window.confirm(
        "Приложение попробует очистить битые локальные ссылки: orphan assets, пустые attachment-связи и сломанные ссылки на обложки/фон. Продолжить?",
      )
    ) {
      return;
    }

    try {
      setIsRepairingStorage(true);
      const result = await repairStorageIntegrity();
      await refresh();
      setBackupMessage(
        `Локальное хранилище проверено: удалено orphan assets ${result.deletedAssets}, сброшено обложек ${result.resetNotebookCovers}. Битых attachment-связей осталось ${result.unresolvedNotebookAttachments}, page-элементов ${result.unresolvedPageElements}.`,
      );
    } catch (error) {
      console.error("Storage repair failed", error);
      setBackupMessage("Не удалось автоматически починить локальные ссылки.");
    } finally {
      setIsRepairingStorage(false);
    }
  }

  function handleOpenNotebook(notebookId: string) {
    setIsOpen(false);
    window.location.assign(new URL(`notebooks/${notebookId}/manage`, new URL(import.meta.env.BASE_URL, window.location.origin)).toString());
  }

  function handleOpenHome() {
    setIsOpen(false);
    window.location.assign(new URL("./", new URL(import.meta.env.BASE_URL, window.location.origin)).toString());
  }

  return (
    <div className="pwa-status">
      <button
        type="button"
        className={`pwa-status__trigger pwa-status__trigger--${tone}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="pwa-status__dot" aria-hidden="true" />
        {offlineReadiness.statusLabel}
      </button>

      {isOpen ? (
        <div className="pwa-status__panel">
          <div className="pwa-status__row">
            <span>Режим</span>
            <strong>{snapshot.isStandalone ? "Иконка iPad" : "Safari"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Сеть</span>
            <strong>{snapshot.isOnline ? "Есть" : "Нет"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Service Worker</span>
            <strong>{snapshot.hasServiceWorker ? "Доступен" : "Нет"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>HTTPS-контекст</span>
            <strong>{snapshot.isSecureContext ? "Да" : "Нет"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Контроль окна</span>
            <strong>{snapshot.isControlled ? "Активен" : "Не активен"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Офлайн-оболочка</span>
            <strong>{snapshot.hasOfflineShell ? "В кэше" : "Не прогрета"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>SW cache contract</span>
            <strong>
              {swRuntimeStatus.cacheVersion
                ? `${swRuntimeStatus.cacheVersion}${swRuntimeStatus.hasOfflineShell ? " • shell ready" : " • warming"}`
                : "Нет ответа"}
            </strong>
          </div>
          <div className="pwa-status__row">
            <span>Занято в хранилище</span>
            <strong>{formatStorageBytes(snapshot.storageUsageBytes)}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Лимит хранилища</span>
            <strong>{formatStorageBytes(snapshot.storageQuotaBytes)}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Persistent storage</span>
            <strong>
              {snapshot.isPersistentStorage === null ? "Недоступно" : snapshot.isPersistentStorage ? "Да" : "Нет"}
            </strong>
          </div>
          <div className={`pwa-status__storage-note pwa-status__storage-note--${storageTone}`}>
            {storageUsagePercent === null
              ? "Safari не всегда отдаёт точную quota-оценку, но панель показывает доступные сигналы локального хранилища."
              : storageUsagePercent >= 85
                ? `Локальное хранилище заполнено примерно на ${storageUsagePercent}%. Для iPad Safari это уже зона риска для крупных вложений.`
                : storageUsagePercent >= 65
                  ? `Локальное хранилище занято примерно на ${storageUsagePercent}%. С крупными изображениями и файлами лучше работать осторожнее.`
                  : `Локальное хранилище занято примерно на ${storageUsagePercent}%. Запас по quota пока выглядит нормально.`}
          </div>
          <div className={`pwa-status__readiness pwa-status__readiness--${offlineReadiness.tone}`}>
            <div className="pwa-status__actions-title">{offlineReadiness.title}</div>
            <div className="pwa-status__readiness-text">{offlineReadiness.description}</div>
            {runtimeCheckedAtLabel ? (
              <div className="pwa-status__meta">Последний подтверждённый прогрев shell: {runtimeCheckedAtLabel}</div>
            ) : null}
            <ul className="pwa-status__actions-list">
              {offlineReadiness.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <div className="pwa-status__checklist">
              {installChecklist.map((step) => (
                <div
                  key={step.id}
                  className={`pwa-status__checklist-item ${step.done ? "pwa-status__checklist-item--done" : ""}`}
                >
                  <span className="pwa-status__checkmark" aria-hidden="true">
                    {step.done ? "✓" : "•"}
                  </span>
                  <div className="pwa-status__checklist-copy">
                    <strong>{step.label}</strong>
                    <span>{step.hint}</span>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="pwa-status__action-button" onClick={() => void refresh()}>
              Проверить статус ещё раз
            </button>
          </div>
          {storageRecoverySteps.length ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">Что делать сейчас</div>
              <ul className="pwa-status__actions-list">
                {storageRecoverySteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              </div>
            ) : null}
          {storageIntegrity &&
          (storageIntegrity.orphanAssetIds.length > 0 ||
            storageIntegrity.danglingNotebookAttachmentIds.length > 0 ||
            storageIntegrity.danglingPageElementIds.length > 0 ||
            storageIntegrity.missingCoverNotebookIds.length > 0 ||
            storageIntegrity.missingBackgroundAsset) ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">Проблемы локальных ссылок</div>
              <div className="pwa-status__readiness-text">
                Нашлись битые связи в локальной базе. Это может мешать recovery после quota-pressure или неудачных импортов.
              </div>
              <div className="pwa-status__cleanup-list">
                {storageIntegrity.orphanAssetIds.length > 0 ? (
                  <div className="pwa-status__cleanup-item">
                    <div className="pwa-status__cleanup-head">
                      <strong>Лишние локальные assets</strong>
                      <span>{storageIntegrity.orphanAssetIds.length}</span>
                    </div>
                    <div className="pwa-status__cleanup-meta">
                      Найдено orphan-вложений на {formatStorageBytes(storageIntegrity.orphanAssetBytes)}.
                    </div>
                  </div>
                ) : null}
                {storageIntegrity.danglingNotebookAttachmentIds.length > 0 ? (
                  <div className="pwa-status__cleanup-item">
                    <div className="pwa-status__cleanup-head">
                      <strong>Битые файлы блокнотов</strong>
                      <span>{storageIntegrity.danglingNotebookAttachmentIds.length}</span>
                    </div>
                    <div className="pwa-status__cleanup-meta">
                      Есть attachment-записи без блока или без реального asset-файла.
                    </div>
                  </div>
                ) : null}
                {storageIntegrity.danglingPageElementIds.length > 0 ? (
                  <div className="pwa-status__cleanup-item">
                    <div className="pwa-status__cleanup-head">
                      <strong>Битые элементы страниц</strong>
                      <span>{storageIntegrity.danglingPageElementIds.length}</span>
                    </div>
                    <div className="pwa-status__cleanup-meta">
                      Есть image/file элементы без страницы или без реального asset.
                    </div>
                  </div>
                ) : null}
                {storageIntegrity.missingCoverNotebookIds.length > 0 ? (
                  <div className="pwa-status__cleanup-item">
                    <div className="pwa-status__cleanup-head">
                      <strong>Сломанные обложки</strong>
                      <span>{storageIntegrity.missingCoverNotebookIds.length}</span>
                    </div>
                    <div className="pwa-status__cleanup-meta">
                      У части блокнотов ссылка на пользовательскую обложку больше не существует.
                    </div>
                  </div>
                ) : null}
                {storageIntegrity.missingBackgroundAsset ? (
                  <div className="pwa-status__cleanup-item">
                    <div className="pwa-status__cleanup-head">
                      <strong>Сломанный фон приложения</strong>
                      <span>1</span>
                    </div>
                    <div className="pwa-status__cleanup-meta">
                      Ссылка на пользовательский фон больше не ведёт к реальному asset.
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="pwa-status__action-button"
                onClick={() => void handleRepairStorage()}
                disabled={isRepairingStorage}
              >
                {isRepairingStorage ? "Чиним..." : "Починить локальные ссылки"}
              </button>
            </div>
          ) : null}
          {storageInsights && (storageInsights.topNotebooks.length > 0 || storageInsights.appBackgroundBytes > 0 || storageInsights.unassignedAssetBytes > 0) ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">Что занимает место</div>
              <div className="pwa-status__readiness-text">
                Это помогает понять, что чистить первым, если Safari начинает упираться в quota.
              </div>
              {storageInsights.topNotebooks.length ? (
                <div className="pwa-status__cleanup-list">
                  {storageInsights.topNotebooks.map((item) => (
                    <div key={item.notebookId} className="pwa-status__cleanup-item">
                      <div className="pwa-status__cleanup-head">
                        <strong>{item.title}</strong>
                        <span>{formatStorageBytes(item.totalBytes)}</span>
                      </div>
                      <div className="pwa-status__cleanup-meta">
                        {item.pageCount} стр. • {item.assetCount} assets • {item.attachmentCount} влож.
                      </div>
                      <div className="pwa-status__cleanup-meta">
                        Изображения {formatStorageBytes(item.imageBytes)} • Файлы {formatStorageBytes(item.fileBytes)} • Обложка {formatStorageBytes(item.coverBytes)}
                      </div>
                      <div className="pwa-status__cleanup-actions">
                        <button
                          type="button"
                          className="pwa-status__inline-button"
                          onClick={() => handleOpenNotebook(item.notebookId)}
                        >
                          Открыть блокнот
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {storageInsights.appBackgroundBytes > 0 ? (
                <div className="pwa-status__cleanup-item">
                  <div className="pwa-status__cleanup-head">
                    <strong>Фон приложения</strong>
                    <span>{formatStorageBytes(storageInsights.appBackgroundBytes)}</span>
                  </div>
                  <div className="pwa-status__cleanup-meta">
                    Если место заканчивается, начните с более лёгкого фона или уберите пользовательскую картинку.
                  </div>
                  <div className="pwa-status__cleanup-actions">
                    <button type="button" className="pwa-status__inline-button" onClick={handleOpenHome}>
                      Открыть главный экран
                    </button>
                  </div>
                </div>
              ) : null}
              {storageInsights.unassignedAssetBytes > 0 ? (
                <div className="pwa-status__cleanup-meta">
                  Прочие локальные assets: {formatStorageBytes(storageInsights.unassignedAssetBytes)}
                </div>
              ) : null}
            </div>
          ) : null}
          {snapshot.isPersistentStorage === false && "storage" in navigator && typeof navigator.storage?.persist === "function" ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">Зафиксировать локальное хранилище</div>
              <div className="pwa-status__readiness-text">
                Если браузер разрешит persistent storage, риск внезапной очистки локальных данных станет ниже.
              </div>
              <button
                type="button"
                className="pwa-status__action-button"
                onClick={() => void handleRequestPersistentStorage()}
                disabled={isRequestingPersistentStorage}
              >
                {isRequestingPersistentStorage ? "Запрашиваем..." : "Запросить persistent storage"}
              </button>
            </div>
          ) : null}
          <div className="pwa-status__actions">
            <div className="pwa-status__actions-title">Резервная копия локальной базы</div>
            <div className="pwa-status__readiness-text">
              Это ручной recovery path на случай проблем с local storage, quota или переносом данных между устройствами.
            </div>
            <div className="pwa-status__button-group">
              <button
                type="button"
                className="pwa-status__action-button"
                onClick={() => void handleExportBackup()}
                disabled={isExportingBackup || isImportingBackup}
              >
                {isExportingBackup ? "Экспортируем..." : "Экспортировать локальную копию"}
              </button>
              <button
                type="button"
                className="pwa-status__action-button"
                onClick={() => backupInputRef.current?.click()}
                disabled={isExportingBackup || isImportingBackup}
              >
                {isImportingBackup ? "Импортируем..." : "Импортировать backup"}
              </button>
            </div>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => void handleImportBackup(event)}
            />
            {backupMessage ? <div className="pwa-status__meta">{backupMessage}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}




