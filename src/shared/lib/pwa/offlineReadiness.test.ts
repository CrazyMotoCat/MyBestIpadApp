import { describe, expect, it } from "vitest";
import { getOfflineReadinessView } from "@/shared/lib/pwa/offlineReadiness";

describe("getOfflineReadinessView", () => {
  it("возвращает danger без secure context", () => {
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

  it("возвращает ready только когда все условия выполнены", () => {
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
