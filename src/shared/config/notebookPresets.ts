import {
  NotebookStylePreset,
  NotebookStylePresetId,
  NotebookTypePreset,
  NotebookTypePresetId,
} from "@/shared/types/presets";

export const notebookStylePresets: NotebookStylePreset[] = [
  {
    id: "nebula-carbon",
    label: "Туманность карбона",
    description: "Карбоновая текстура, холодный неон и аккуратная техничность.",
    accent: "#7f6cff",
    surface: "linear-gradient(135deg, #15182a 0%, #2a3050 45%, #0b0f17 100%)",
    symbol: "✦",
    artwork: "карбон • орбита • неон",
  },
  {
    id: "chrome-comet",
    label: "Хром кометы",
    description: "Холодный хром, отблески скорости и металлическая чистота.",
    accent: "#7bd4ff",
    surface: "linear-gradient(135deg, #0f1725 0%, #17354b 35%, #5ba2c7 100%)",
    symbol: "☄",
    artwork: "хром • свет • скорость",
  },
  {
    id: "midnight-racer",
    label: "Ночной рейсер",
    description: "Асфальт, красные огни и спортивное чувство дороги.",
    accent: "#ff6a63",
    surface: "linear-gradient(135deg, #120d12 0%, #28151d 40%, #521d28 100%)",
    symbol: "✶",
    artwork: "рейсер • асфальт • огни",
  },
  {
    id: "aurora-track",
    label: "Трасса и сияние",
    description: "Холодная динамика с зелёным свечением и северным воздухом.",
    accent: "#78ffd8",
    surface: "linear-gradient(135deg, #07121a 0%, #153744 42%, #1a6a64 100%)",
    symbol: "❄",
    artwork: "сияние • трасса • холод",
  },
  {
    id: "burnout-red",
    label: "Красный разгон",
    description: "Тёплая агрессия мотора, спорт и контрастный неон.",
    accent: "#ff9366",
    surface: "linear-gradient(135deg, #1a0d10 0%, #48171f 46%, #9c342e 100%)",
    symbol: "⚡",
    artwork: "пламя • рывок • мотор",
  },
  {
    id: "starlit-leather",
    label: "Звёздная кожа",
    description: "Кожаная глубина с вкраплениями света и уютом дорогой вещи.",
    accent: "#ffd49a",
    surface: "linear-gradient(135deg, #2f1f16 0%, #5f3a2a 45%, #1f1410 100%)",
    symbol: "✷",
    artwork: "кожа • звёзды • тепло",
  },
  {
    id: "retro-wave",
    label: "Ретро-волна",
    description: "Графика плакатов, неоновый закат и винтажное настроение.",
    accent: "#ff79df",
    surface: "linear-gradient(135deg, #1a1430 0%, #4a1f5f 45%, #161025 100%)",
    symbol: "♫",
    artwork: "ретро • постер • закат",
  },
];

export const notebookTypePresets: NotebookTypePreset[] = [
  {
    id: "garage-log",
    label: "Гаражный журнал",
    description: "Записи по технике, идеям и настройкам.",
    symbol: "⚙",
  },
  {
    id: "travel-journal",
    label: "Маршрутный дневник",
    description: "Истории дорог, маршруты и путевые заметки.",
    symbol: "➤",
  },
  {
    id: "idea-book",
    label: "Книга идей",
    description: "Концепты, вдохновение, эскизы и быстрые мысли.",
    symbol: "✹",
  },
  {
    id: "project-board",
    label: "Проектный блокнот",
    description: "Планирование задач, схем и вложений по проекту.",
    symbol: "▦",
  },
  {
    id: "track-notes",
    label: "Трековые заметки",
    description: "Сессии, замеры, разборы и визуальные пометки.",
    symbol: "🏁",
  },
  {
    id: "daily-journal",
    label: "Ежедневник",
    description: "Ежедневные записи, мысли, задачи и итоги дня.",
    symbol: "☀",
  },
  {
    id: "spiral-notebook",
    label: "Блокнот с пружиной",
    description: "Быстрые заметки и рабочие записи в повседневном формате.",
    symbol: "⟲",
  },
  {
    id: "planner-book",
    label: "Планер",
    description: "Планы, трекеры и расписание в структурированном виде.",
    symbol: "☰",
  },
  {
    id: "pocket-notebook",
    label: "Записная книжка",
    description: "Компактный формат для коротких заметок и мыслей.",
    symbol: "✎",
  },
];

export const defaultNotebookStyleId: NotebookStylePresetId = "nebula-carbon";
export const defaultNotebookTypeId: NotebookTypePresetId = "garage-log";

