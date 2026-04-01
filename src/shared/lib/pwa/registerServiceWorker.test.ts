import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PWA_CONTROLLER_UPDATED_EVENT,
  PWA_UPDATE_AVAILABLE_EVENT,
  applyServiceWorkerUpdate,
  registerServiceWorker,
} from "@/shared/lib/pwa/registerServiceWorker";

type TestWorker = EventTarget & {
  state?: ServiceWorkerState;
  postMessage: ReturnType<typeof vi.fn>;
};

type TestRegistration = EventTarget & {
  waiting: TestWorker | null;
  installing: TestWorker | null;
  active: TestWorker | null;
};

type TestNavigator = {
  serviceWorker: EventTarget & {
    controller: TestWorker | null;
    register: ReturnType<typeof vi.fn>;
    ready: Promise<{ active: TestWorker | null }>;
    getRegistration: ReturnType<typeof vi.fn>;
  };
};

function getTestWindow() {
  return globalThis.window as EventTarget & {
    addEventListener: Window["addEventListener"];
    removeEventListener: Window["removeEventListener"];
    isSecureContext: boolean;
    location: { href: string; origin: string };
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
}

function getTestNavigator() {
  return globalThis.navigator as unknown as TestNavigator;
}

function defineGlobal<T>(name: string, value: T) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function createWorker(state: ServiceWorkerState = "installing") {
  const worker = new EventTarget() as TestWorker;
  worker.state = state;
  worker.postMessage = vi.fn();
  return worker;
}

function createWindow() {
  const win = new EventTarget() as EventTarget & {
    isSecureContext: boolean;
    location: { href: string; origin: string };
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };

  win.isSecureContext = true;
  win.location = {
    href: "https://example.test/app/",
    origin: "https://example.test",
  };
  win.setTimeout = setTimeout;
  win.clearTimeout = clearTimeout;
  return win;
}

function createDocument() {
  const doc = {
    readyState: "complete",
    querySelectorAll: vi.fn().mockReturnValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as any;

  return doc;
}

function createNavigator() {
  const serviceWorker = new EventTarget() as TestNavigator["serviceWorker"];
  serviceWorker.controller = null;
  serviceWorker.register = vi.fn();
  serviceWorker.ready = Promise.resolve({ active: null });
  serviceWorker.getRegistration = vi.fn();

  return { serviceWorker };
}

function installBaseEnvironment() {
  defineGlobal("window", createWindow());
  defineGlobal("document", createDocument());
  defineGlobal("navigator", createNavigator());
  defineGlobal("caches", {
    open: vi.fn().mockResolvedValue({
      put: vi.fn(),
    }),
  });
  defineGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, type: "basic", clone: vi.fn() }));
  defineGlobal("performance", {
    getEntriesByType: vi.fn().mockReturnValue([]),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  installBaseEnvironment();
});

installBaseEnvironment();

describe("applyServiceWorkerUpdate", () => {
  it("posts SKIP_WAITING to the waiting worker when an update is available", async () => {
    const waiting = { postMessage: vi.fn() } as TestWorker;
    const serviceWorker = getTestNavigator().serviceWorker as unknown as TestNavigator["serviceWorker"];
    serviceWorker.getRegistration.mockResolvedValue({ waiting } as Partial<TestRegistration>);

    await expect(applyServiceWorkerUpdate()).resolves.toBe(true);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("returns false when there is no waiting worker", async () => {
    const serviceWorker = getTestNavigator().serviceWorker as unknown as TestNavigator["serviceWorker"];
    serviceWorker.getRegistration.mockResolvedValue({ waiting: null } as Partial<TestRegistration>);

    await expect(applyServiceWorkerUpdate()).resolves.toBe(false);
  });
});

describe("registerServiceWorker", () => {
  it("emits update-ready without auto-skipping a waiting worker", async () => {
    const controller = createWorker("activated");
    const waiting = createWorker("installed");
    const installing = createWorker("installed");
    const registration = new EventTarget() as TestRegistration;
    registration.waiting = waiting;
    registration.installing = installing;
    registration.active = controller;

    const serviceWorker = getTestNavigator().serviceWorker as unknown as TestNavigator["serviceWorker"];
    serviceWorker.controller = controller;
    serviceWorker.register.mockResolvedValue(registration);
    serviceWorker.ready = Promise.resolve({ active: controller });

    const updateAvailable = vi.fn();
    getTestWindow().addEventListener(PWA_UPDATE_AVAILABLE_EVENT, updateAvailable);

    registerServiceWorker();
    await Promise.resolve();

    registration.dispatchEvent(new Event("updatefound"));
    installing.dispatchEvent(new Event("statechange"));
    await Promise.resolve();

    expect(updateAvailable).toHaveBeenCalled();
    expect(waiting.postMessage).not.toHaveBeenCalled();
    getTestWindow().removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, updateAvailable);
  });

  it("marks controllerchange as an update when the app was already controlled", async () => {
    const controller = createWorker("activated");
    const serviceWorker = getTestNavigator().serviceWorker as unknown as TestNavigator["serviceWorker"];
    serviceWorker.controller = controller;
    const registration = new EventTarget() as TestRegistration;
    registration.waiting = null;
    registration.installing = null;
    registration.active = controller;
    serviceWorker.register.mockResolvedValue(registration);
    serviceWorker.ready = Promise.resolve({ active: controller });

    const controllerUpdated = vi.fn();
    getTestWindow().addEventListener(PWA_CONTROLLER_UPDATED_EVENT, controllerUpdated);

    registerServiceWorker();
    await Promise.resolve();

    serviceWorker.dispatchEvent(new Event("controllerchange"));
    await Promise.resolve();

    expect(controllerUpdated).toHaveBeenCalledTimes(1);
    expect(controllerUpdated.mock.calls[0]?.[0]).toMatchObject({
      detail: { reason: "update" },
    });
    getTestWindow().removeEventListener(PWA_CONTROLLER_UPDATED_EVENT, controllerUpdated);
  });

  it("marks first controllerchange as initial control when there was no previous controller", async () => {
    const controller = createWorker("activated");
    const serviceWorker = getTestNavigator().serviceWorker as unknown as TestNavigator["serviceWorker"];
    serviceWorker.controller = null;
    const registration = new EventTarget() as TestRegistration;
    registration.waiting = null;
    registration.installing = null;
    registration.active = controller;
    serviceWorker.register.mockResolvedValue(registration);
    serviceWorker.ready = Promise.resolve({ active: controller });

    const controllerUpdated = vi.fn();
    getTestWindow().addEventListener(PWA_CONTROLLER_UPDATED_EVENT, controllerUpdated);

    registerServiceWorker();
    await Promise.resolve();

    serviceWorker.controller = controller;
    serviceWorker.dispatchEvent(new Event("controllerchange"));
    await Promise.resolve();

    expect(controllerUpdated).toHaveBeenCalledTimes(1);
    expect(controllerUpdated.mock.calls[0]?.[0]).toMatchObject({
      detail: { reason: "initial-control" },
    });
    getTestWindow().removeEventListener(PWA_CONTROLLER_UPDATED_EVENT, controllerUpdated);
  });
});
