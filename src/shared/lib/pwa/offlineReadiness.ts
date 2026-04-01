export interface OfflineReadinessSnapshot {
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  isControlled: boolean;
  isStandalone: boolean;
  hasOfflineShell: boolean;
}

export interface OfflineReadinessView {
  isReady: boolean;
  tone: "ready" | "warning" | "danger";
  title: string;
  description: string;
  steps: string[];
  statusLabel: string;
}

export function getStandaloneState() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function getAddToHomeScreenSteps() {
  return [
    "Откройте меню Поделиться в Safari.",
    "Выберите «На экран Домой».",
    "После этого запускайте приложение уже через иконку на iPad.",
  ];
}

export function getOfflineReadinessView(snapshot: OfflineReadinessSnapshot): OfflineReadinessView {
  if (!snapshot.isSecureContext || !snapshot.hasServiceWorker) {
    return {
      isReady: false,
      tone: "danger",
      statusLabel: "Офлайн не готов",
      title: "Офлайн-режим ещё не готов",
      description: "Нужен HTTPS-контекст и активный Service Worker. Без этого приложение не сможет надёжно запускаться офлайн.",
      steps: ["Откройте приложение по HTTPS.", "После этого дождитесь полной загрузки страницы и проверьте статус снова."],
    };
  }

  if (!snapshot.isControlled || !snapshot.hasOfflineShell) {
    return {
      isReady: false,
      tone: "warning",
      statusLabel: "Офлайн не подтверждён",
      title: "Оболочка ещё не прогрета",
      description: "Приложение уже близко к офлайн-режиму, но текущее окно ещё не подтверждено как полностью подготовленное для запуска без сети.",
      steps: [
        "Откройте приложение один раз онлайн и дождитесь полной загрузки.",
        "Закройте и откройте его снова, чтобы Service Worker перехватил окно.",
      ],
    };
  }

  if (!snapshot.isStandalone) {
    return {
      isReady: false,
      tone: "warning",
      statusLabel: "Почти готово",
      title: "Остался последний шаг для iPad",
      description: "Офлайн-оболочка уже прогрета. Теперь лучше запускать приложение с экрана Домой, а не из Safari.",
      steps: getAddToHomeScreenSteps(),
    };
  }

  return {
    isReady: true,
    tone: "ready",
    statusLabel: "Офлайн готов",
    title: "Офлайн-запуск готов",
    description: "Приложение выглядит готовым к надёжному запуску без сети через иконку на iPad.",
    steps: ["Можно запускать иконку приложения с рабочего стола iPad даже без интернета."],
  };
}
