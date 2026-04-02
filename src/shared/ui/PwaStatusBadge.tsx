import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  downloadDatabaseBackup,
  getBackupExportWarning,
  formatBackupSummary,
  getBackupImportWarning,
  importDatabaseBackup,
} from "@/shared/lib/db/backup";
import { getOfflineReadinessView, getStandaloneState } from "@/shared/lib/pwa/offlineReadiness";
import {
  EMPTY_SERVICE_WORKER_RUNTIME_STATUS,
  parseServiceWorkerRuntimeStatus,
  requestServiceWorkerRuntimeStatus,
  ServiceWorkerRuntimeStatus,
} from "@/shared/lib/pwa/runtimeStatus";
import {
  PWA_CONTROLLER_UPDATED_EVENT,
  PWA_UPDATE_AVAILABLE_EVENT,
  PwaControllerUpdatedReason,
} from "@/shared/lib/pwa/registerServiceWorker";
import { formatStorageBytes } from "@/shared/lib/db/storageErrors";
import {
  getStorageHealthSummarySnapshot,
  recordStorageWriteFailure,
  recordStorageWriteSuccess,
  StorageHealthSummary,
} from "@/shared/lib/db/storageHealth";
import { buildStorageRecoveryPlan } from "@/shared/lib/db/storageRecoveryPlan";
import { auditStorageIntegrity, repairStorageIntegrity, StorageIntegrityReport } from "@/shared/lib/db/storageIntegrity";
import { getStorageInsightsSummary, StorageInsightsSummary } from "@/shared/lib/db/storageInsights";
import {
  clearAllPendingPageRecoveryDrafts,
  getPageRecoveryDraftDiagnostics,
  PageRecoveryDraftDiagnostics,
} from "@/features/editor/lib/pageRecoveryDraftDiagnostics";

interface PwaStatusSnapshot {
  isOnline: boolean;
  isStandalone: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  isControlled: boolean;
  storageQuotaBytes: number | null;
  storageUsageBytes: number | null;
  isPersistentStorage: boolean | null;
}

function getStatusTone(snapshot: PwaStatusSnapshot, hasOfflineShell: boolean) {
  if (snapshot.hasServiceWorker && snapshot.isControlled && hasOfflineShell) {
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
  const [isClearingDrafts, setIsClearingDrafts] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [swRuntimeStatus, setSwRuntimeStatus] = useState<ServiceWorkerRuntimeStatus>(EMPTY_SERVICE_WORKER_RUNTIME_STATUS);
  const [updateState, setUpdateState] = useState<"idle" | "update-ready" | "reload-required">("idle");
  const [storageInsights, setStorageInsights] = useState<StorageInsightsSummary | null>(null);
  const [storageIntegrity, setStorageIntegrity] = useState<StorageIntegrityReport | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealthSummary | null>(null);
  const [draftDiagnostics, setDraftDiagnostics] = useState<PageRecoveryDraftDiagnostics | null>(null);
  const [snapshot, setSnapshot] = useState<PwaStatusSnapshot>({
    isOnline: navigator.onLine,
    isStandalone: getStandaloneState(),
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    isControlled: Boolean(navigator.serviceWorker?.controller),
    storageQuotaBytes: null,
    storageUsageBytes: null,
    isPersistentStorage: null,
  });
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const [nextSnapshot, nextInsights, nextIntegrity, nextHealth] = await Promise.all([
      collectSnapshot(),
      getStorageInsightsSummary(),
      auditStorageIntegrity(),
      getStorageHealthSummarySnapshot(),
    ]);
    setSnapshot(nextSnapshot);
    setStorageInsights(nextInsights);
    setStorageIntegrity(nextIntegrity);
    setStorageHealth(nextHealth);
    setDraftDiagnostics(getPageRecoveryDraftDiagnostics());
  }, []);

  useEffect(() => {
    let isMounted = true;

    const refreshIfMounted = async () => {
      const [nextSnapshot, nextInsights, nextIntegrity, nextHealth] = await Promise.all([
        collectSnapshot(),
        getStorageInsightsSummary(),
        auditStorageIntegrity(),
        getStorageHealthSummarySnapshot(),
      ]);

      if (isMounted) {
        setSnapshot(nextSnapshot);
        setStorageInsights(nextInsights);
        setStorageIntegrity(nextIntegrity);
        setStorageHealth(nextHealth);
        setDraftDiagnostics(getPageRecoveryDraftDiagnostics());
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
      void requestServiceWorkerRuntimeStatus();
    };
    const handleUpdateAvailable = () => {
      if (isMounted) {
        setUpdateState("update-ready");
      }
    };
    const handleControllerUpdated = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: PwaControllerUpdatedReason }>).detail?.reason;

      if (reason !== "update" || !isMounted) {
        return;
      }

      setUpdateState("reload-required");
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      const nextStatus = parseServiceWorkerRuntimeStatus(event.data);

      if (!nextStatus) {
        return;
      }

      if (!isMounted) {
        return;
      }

      setSwRuntimeStatus(nextStatus);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleVisibility);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleVisibility);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleConnectivity);
    window.addEventListener("offline", handleConnectivity);
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    window.addEventListener(PWA_CONTROLLER_UPDATED_EVENT, handleControllerUpdated);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    void requestServiceWorkerRuntimeStatus();

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
      window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
      window.removeEventListener(PWA_CONTROLLER_UPDATED_EVENT, handleControllerUpdated);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, []);

  const tone = getStatusTone(snapshot, swRuntimeStatus.hasOfflineShell === true);
  const storageUsagePercent = getStorageUsagePercent(snapshot);
  const storageTone = getStorageUsageTone(storageUsagePercent);
  const storageRecoverySteps = getStorageRecoverySteps(storageTone);
  const storageRecoveryPlan = buildStorageRecoveryPlan({
    storageTone,
    storageInsights,
    storageHealth,
    draftDiagnostics,
  });
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
      recordStorageWriteSuccess("export backup", `Резервная копия экспортирована: ${formatBackupSummary(summary)}.`);
      setBackupMessage(`Локальная копия базы экспортирована в JSON-файл: ${formatBackupSummary(summary)}.`);
      await refresh();
    } catch (error) {
      console.error("Backup export failed", error);
      recordStorageWriteFailure("export backup", error, "Не удалось экспортировать локальную копию базы.");
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
      recordStorageWriteSuccess("import backup", `Локальная база импортирована из ${file.name}.`);
      setBackupMessage("Backup импортирован. Перезагружаем приложение...");
      await refresh();
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error("Backup import failed", error);
      recordStorageWriteFailure("import backup", error, "Не удалось импортировать backup-файл.");
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
      recordStorageWriteFailure("repair storage integrity", error, "Не удалось автоматически починить локальные ссылки.");
      setBackupMessage("Не удалось автоматически починить локальные ссылки.");
    } finally {
      setIsRepairingStorage(false);
    }
  }

  async function handleClearDrafts() {
    if (
      !window.confirm(
        "Приложение очистит pending recovery drafts и snapshot-черновики страницы из sessionStorage/localStorage. Продолжить?",
      )
    ) {
      return;
    }

    try {
      setIsClearingDrafts(true);
      clearAllPendingPageRecoveryDrafts();
      recordStorageWriteSuccess("clear recovery drafts", "Локальные recovery drafts и snapshot-черновики очищены.");
      await refresh();
      setBackupMessage("Локальные recovery drafts очищены.");
    } catch (error) {
      console.error("Draft cleanup failed", error);
      recordStorageWriteFailure("clear recovery drafts", error, "Не удалось очистить recovery drafts.");
      setBackupMessage("Не удалось очистить recovery drafts.");
    } finally {
      setIsClearingDrafts(false);
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
            <strong>{swRuntimeStatus.hasOfflineShell ? "Подтверждена SW" : "Не подтверждена"}</strong>
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
            <span>Обновление оболочки</span>
            <strong>
              {updateState === "reload-required"
                ? "Нужна перезагрузка"
                : updateState === "update-ready"
                  ? "Ждёт применения"
                  : "Без ожидания"}
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
          {storageHealth ? (
            <div className={`pwa-status__actions pwa-status__readiness pwa-status__readiness--${storageHealth.tone}`}>
              <div className="pwa-status__actions-title">{storageHealth.title}</div>
              <div className="pwa-status__readiness-text">{storageHealth.description}</div>
              <ul className="pwa-status__actions-list">
                {storageHealth.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {draftDiagnostics && draftDiagnostics.totalEntries > 0 ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">Pending recovery drafts</div>
              <div className="pwa-status__readiness-text">
                Найдены незавершённые page recovery drafts. Это полезный safety net для reopen/recovery, но под quota-pressure их
                тоже полезно видеть и уметь очищать вручную.
              </div>
              <div className="pwa-status__cleanup-meta">
                Всего записей: {draftDiagnostics.totalEntries} • страниц: {draftDiagnostics.uniquePageCount} • sessionStorage:{" "}
                {draftDiagnostics.sourceCounts.sessionStorage} • localStorage: {draftDiagnostics.sourceCounts.localStorage}
              </div>
              <div className="pwa-status__cleanup-meta">
                Recovery: {draftDiagnostics.kindCounts.recovery} • Snapshot: {draftDiagnostics.kindCounts.snapshot}
                {draftDiagnostics.invalidEntryCount > 0 ? ` • подозрительных записей: ${draftDiagnostics.invalidEntryCount}` : ""}
              </div>
              <div className="pwa-status__cleanup-list">
                {draftDiagnostics.pages.map((page) => (
                  <div key={page.pageId} className="pwa-status__cleanup-item">
                    <div className="pwa-status__cleanup-head">
                      <strong>{page.pageId}</strong>
                      <span>{page.entryCount}</span>
                    </div>
                    <div className="pwa-status__cleanup-meta">
                      {page.sources.join(" • ")} • {page.kinds.join(" • ")}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="pwa-status__action-button"
                onClick={() => void handleClearDrafts()}
                disabled={isClearingDrafts}
              >
                {isClearingDrafts ? "Очищаем..." : "Очистить recovery drafts"}
              </button>
            </div>
          ) : null}
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
          {updateState !== "idle" ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">Состояние обновления</div>
              <div className="pwa-status__readiness-text">
                {updateState === "update-ready"
                  ? "Новая версия офлайн-оболочки уже найдена. Примените обновление в верхнем баннере, чтобы не оставаться на старом screen-state."
                  : "Новый Service Worker уже активирован. Перезагрузите приложение, чтобы экран и кэш снова работали в одном состоянии."}
              </div>
            </div>
          ) : null}
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
          {storageRecoveryPlan.steps.length ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">План восстановления после quota-pressure</div>
              <ul className="pwa-status__actions-list">
                {storageRecoveryPlan.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <div className="pwa-status__button-group">
                {storageRecoveryPlan.primaryNotebookId ? (
                  <button
                    type="button"
                    className="pwa-status__action-button"
                    onClick={() => handleOpenNotebook(storageRecoveryPlan.primaryNotebookId!)}
                  >
                    Открыть самый тяжёлый блокнот
                  </button>
                ) : null}
                {storageRecoveryPlan.shouldOpenHome ? (
                  <button type="button" className="pwa-status__action-button" onClick={handleOpenHome}>
                    Перейти к фону приложения
                  </button>
                ) : null}
                {storageRecoveryPlan.shouldClearDrafts ? (
                  <button
                    type="button"
                    className="pwa-status__action-button"
                    onClick={() => void handleClearDrafts()}
                    disabled={isClearingDrafts}
                  >
                    {isClearingDrafts ? "Очищаем черновики..." : "Очистить stale drafts"}
                  </button>
                ) : null}
              </div>
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




