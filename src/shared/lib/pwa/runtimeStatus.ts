export interface ServiceWorkerRuntimeStatus {
  cacheVersion: string | null;
  checkedAt: string | null;
  hasOfflineShell: boolean | null;
}

export const EMPTY_SERVICE_WORKER_RUNTIME_STATUS: ServiceWorkerRuntimeStatus = {
  cacheVersion: null,
  checkedAt: null,
  hasOfflineShell: null,
};

interface ServiceWorkerRuntimeStatusPayload {
  type?: string;
  cacheVersion?: string;
  checkedAt?: string;
  hasOfflineShell?: boolean;
}

export function parseServiceWorkerRuntimeStatus(payload: unknown): ServiceWorkerRuntimeStatus | null {
  const candidate = payload as ServiceWorkerRuntimeStatusPayload | undefined;

  if (candidate?.type !== "SW_STATUS") {
    return null;
  }

  return {
    cacheVersion: candidate.cacheVersion ?? null,
    checkedAt: candidate.checkedAt ?? null,
    hasOfflineShell: candidate.hasOfflineShell ?? null,
  };
}

export async function requestServiceWorkerRuntimeStatus() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const targets = new Set<ServiceWorker>();

  if (navigator.serviceWorker.controller) {
    targets.add(navigator.serviceWorker.controller);
  }

  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);

  if (registration?.active) {
    targets.add(registration.active);
  }

  if (registration?.waiting) {
    targets.add(registration.waiting);
  }

  if (registration?.installing) {
    targets.add(registration.installing);
  }

  targets.forEach((worker) => {
    worker.postMessage({ type: "REQUEST_STATUS" });
  });
}
