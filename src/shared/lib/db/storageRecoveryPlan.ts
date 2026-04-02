import { PageRecoveryDraftDiagnostics } from "@/features/editor/lib/pageRecoveryDraftDiagnostics";
import { StorageHealthSummary } from "@/shared/lib/db/storageHealth";
import { StorageInsightsSummary } from "@/shared/lib/db/storageInsights";

export interface StorageRecoveryPlan {
  steps: string[];
  primaryNotebookId: string | null;
  shouldOpenHome: boolean;
  shouldClearDrafts: boolean;
}

interface BuildStorageRecoveryPlanInput {
  storageTone: "neutral" | "safe" | "warning" | "danger";
  storageInsights: StorageInsightsSummary | null;
  storageHealth: StorageHealthSummary | null;
  draftDiagnostics: PageRecoveryDraftDiagnostics | null;
}

export function buildStorageRecoveryPlan({
  storageTone,
  storageInsights,
  storageHealth,
  draftDiagnostics,
}: BuildStorageRecoveryPlanInput): StorageRecoveryPlan {
  if (storageTone === "neutral" || storageTone === "safe") {
    return {
      steps: [],
      primaryNotebookId: null,
      shouldOpenHome: false,
      shouldClearDrafts: false,
    };
  }

  const steps: string[] = [
    "Сначала экспортируйте локальную копию базы, если браузер ещё отвечает без ошибок.",
  ];

  const primaryNotebook = storageInsights?.topNotebooks[0] ?? null;
  if (primaryNotebook) {
    steps.push(
      `Проверьте блокнот «${primaryNotebook.title}»: сейчас это самый тяжёлый локальный набор данных и главный кандидат на cleanup.`,
    );
  }

  if ((storageInsights?.appBackgroundBytes ?? 0) > 0) {
    steps.push("Если нужен быстрый выигрыш по месту, начните с замены пользовательского фона на более лёгкий preset.");
  }

  if ((draftDiagnostics?.totalEntries ?? 0) > 0) {
    steps.push("После проверки восстановления очистите stale recovery drafts, если они больше не нужны.");
  }

  if (storageHealth?.lastWrite?.outcome === "failure") {
    steps.push(
      `Последняя локальная запись завершилась ошибкой (${storageHealth.lastWrite.operation}), поэтому после cleanup повторите проблемное действие вручную.`,
    );
  }

  if (storageTone === "danger") {
    steps.push("До cleanup не добавляйте новые крупные изображения, файлы, обложки или backup-импорты.");
  }

  return {
    steps,
    primaryNotebookId: primaryNotebook?.notebookId ?? null,
    shouldOpenHome: (storageInsights?.appBackgroundBytes ?? 0) > 0,
    shouldClearDrafts: (draftDiagnostics?.totalEntries ?? 0) > 0,
  };
}
