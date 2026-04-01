import { describe, expect, it } from "vitest";
import { getOfflineReadinessView } from "@/shared/lib/pwa/offlineReadiness";

describe("getOfflineReadinessView", () => {
  it("returns danger without a secure context", () => {
    const result = getOfflineReadinessView({
      isSecureContext: false,
      hasServiceWorker: false,
      isControlled: false,
      isStandalone: false,
      hasOfflineShell: false,
    });

    expect(result.isReady).toBe(false);
    expect(result.tone).toBe("danger");
  });

  it("returns warning while the page is still uncontrolled and shell is not confirmed", () => {
    const result = getOfflineReadinessView({
      isSecureContext: true,
      hasServiceWorker: true,
      isControlled: false,
      isStandalone: false,
      hasOfflineShell: false,
    });

    expect(result.isReady).toBe(false);
    expect(result.tone).toBe("warning");
    expect(result.statusLabel).toBe("Офлайн не подтверждён");
  });

  it("returns warning when the shell is ready but the app is not launched as standalone", () => {
    const result = getOfflineReadinessView({
      isSecureContext: true,
      hasServiceWorker: true,
      isControlled: true,
      isStandalone: false,
      hasOfflineShell: true,
    });

    expect(result.isReady).toBe(false);
    expect(result.tone).toBe("warning");
    expect(result.statusLabel).toBe("Почти готово");
  });

  it("returns ready only when all conditions are satisfied", () => {
    const result = getOfflineReadinessView({
      isSecureContext: true,
      hasServiceWorker: true,
      isControlled: true,
      isStandalone: true,
      hasOfflineShell: true,
    });

    expect(result.isReady).toBe(true);
    expect(result.statusLabel).toBe("Офлайн готов");
  });
});
