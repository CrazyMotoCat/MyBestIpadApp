import { describe, expect, it, vi } from "vitest";
import { parseServiceWorkerRuntimeStatus, requestServiceWorkerRuntimeStatus } from "@/shared/lib/pwa/runtimeStatus";

describe("parseServiceWorkerRuntimeStatus", () => {
  it("returns normalized runtime status for SW_STATUS payloads", () => {
    expect(
      parseServiceWorkerRuntimeStatus({
        type: "SW_STATUS",
        cacheVersion: "v7",
        checkedAt: "2026-04-02T00:00:00.000Z",
        hasOfflineShell: true,
      }),
    ).toEqual({
      cacheVersion: "v7",
      checkedAt: "2026-04-02T00:00:00.000Z",
      hasOfflineShell: true,
    });
  });

  it("ignores unrelated messages", () => {
    expect(parseServiceWorkerRuntimeStatus({ type: "OTHER" })).toBeNull();
  });
});

describe("requestServiceWorkerRuntimeStatus", () => {
  it("requests runtime status from each available worker once", async () => {
    const controller = { postMessage: vi.fn() };
    const waiting = { postMessage: vi.fn() };
    const registration = {
      active: controller,
      waiting,
      installing: waiting,
    };

    Object.defineProperty(globalThis, "navigator", {
      value: {
        serviceWorker: {
          controller,
          getRegistration: vi.fn().mockResolvedValue(registration),
        },
      },
      configurable: true,
    });

    await requestServiceWorkerRuntimeStatus();

    expect(controller.postMessage).toHaveBeenCalledTimes(1);
    expect(controller.postMessage).toHaveBeenCalledWith({ type: "REQUEST_STATUS" });
    expect(waiting.postMessage).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "REQUEST_STATUS" });
  });
});
