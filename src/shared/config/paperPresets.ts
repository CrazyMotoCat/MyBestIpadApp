import { PaperPreset, PaperPresetId } from "@/shared/types/presets";

export const paperPresets: PaperPreset[] = [
  {
    id: "plain",
    label: "Чистая",
    description: "Свободный лист для текста и эскизов без направляющих.",
    category: "basic",
    baseColor: "#f6f2ea",
    lineColor: "rgba(255,255,255,0)",
    overlay: "none",
  },
  {
    id: "lined",
    label: "Линованная",
    description: "Классическая линейка для заметок и дневниковых записей.",
    category: "basic",
    baseColor: "#f7f2e6",
    lineColor: "rgba(125, 157, 220, 0.25)",
    overlay: "repeating-linear-gradient(180deg, transparent 0 30px, rgba(125,157,220,.25) 30px 32px)",
  },
  {
    id: "grid",
    label: "В клетку",
    description: "Ровная сетка для быстрых схем и структурированных заметок.",
    category: "basic",
    baseColor: "#f4efe4",
    lineColor: "rgba(128, 160, 200, 0.22)",
    overlay:
      "linear-gradient(rgba(128,160,200,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(128,160,200,.22) 1px, transparent 1px)",
  },
  {
    id: "dotted",
    label: "В точку",
    description: "Лёгкая сетка из точек для bullet journal и гибкой верстки.",
    category: "basic",
    baseColor: "#f4efe7",
    lineColor: "rgba(128, 160, 200, 0.28)",
    overlay: "radial-gradient(circle, rgba(128,160,200,.28) 1.2px, transparent 1.3px)",
  },
  {
    id: "millimeter",
    label: "Миллиметровка",
    description: "Тонкая плотная сетка для точных схем и чертежей.",
    category: "technical",
    baseColor: "#eef3ef",
    lineColor: "rgba(98, 160, 128, 0.25)",
    overlay:
      "linear-gradient(rgba(98,160,128,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(98,160,128,.18) 1px, transparent 1px), linear-gradient(rgba(98,160,128,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(98,160,128,.3) 1px, transparent 1px)",
  },
  {
    id: "engineering-grid",
    label: "Инженерная сетка",
    description: "Техническая разметка для узлов, схем и замеров.",
    category: "technical",
    baseColor: "#edf1f6",
    lineColor: "rgba(99, 132, 182, 0.26)",
    overlay:
      "linear-gradient(rgba(99,132,182,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(99,132,182,.16) 1px, transparent 1px), linear-gradient(rgba(99,132,182,.32) 1px, transparent 1px), linear-gradient(90deg, rgba(99,132,182,.32) 1px, transparent 1px)",
  },
  {
    id: "isometric",
    label: "Изометрическая",
    description: "Треугольная сетка для объёмных схем и пространственных набросков.",
    category: "technical",
    baseColor: "#f4f2ee",
    lineColor: "rgba(176, 138, 102, 0.24)",
    overlay:
      "linear-gradient(30deg, rgba(176,138,102,.24) 1px, transparent 1px), linear-gradient(150deg, rgba(176,138,102,.24) 1px, transparent 1px), linear-gradient(90deg, rgba(176,138,102,.18) 1px, transparent 1px)",
  },
  {
    id: "music",
    label: "Музыкальная",
    description: "Пять линеек в группе для нот и ритмических схем.",
    category: "creative",
    baseColor: "#f8f5ed",
    lineColor: "rgba(88, 88, 88, 0.26)",
    overlay:
      "repeating-linear-gradient(180deg, transparent 0 20px, rgba(88,88,88,.26) 20px 21px, transparent 21px 28px, rgba(88,88,88,.26) 28px 29px, transparent 29px 36px, rgba(88,88,88,.26) 36px 37px, transparent 37px 44px, rgba(88,88,88,.26) 44px 45px, transparent 45px 52px, rgba(88,88,88,.26) 52px 53px, transparent 53px 84px)",
  },
  {
    id: "calligraphy",
    label: "Каллиграфическая",
    description: "Наклонные направляющие для каллиграфии и леттеринга.",
    category: "creative",
    baseColor: "#f7f1e8",
    lineColor: "rgba(141, 111, 175, 0.22)",
    overlay:
      "repeating-linear-gradient(180deg, transparent 0 31px, rgba(141,111,175,.18) 31px 32px), repeating-linear-gradient(75deg, rgba(141,111,175,.14) 0 1px, transparent 1px 28px)",
  },
  {
    id: "sketch",
    label: "Для скетчинга",
    description: "Тёплая бумага с мягкой фактурой для быстрых зарисовок.",
    category: "creative",
    baseColor: "#e7dcc8",
    lineColor: "rgba(90, 72, 53, 0.08)",
    overlay: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.12), transparent 30%)",
  },
  {
    id: "kraft",
    label: "Крафтовая",
    description: "Грубая тёплая бумага для заметок с характером.",
    category: "creative",
    baseColor: "#b78f63",
    lineColor: "rgba(76, 45, 15, 0.14)",
    overlay: "radial-gradient(circle at 10% 10%, rgba(255,255,255,.08), transparent 24%)",
  },
  {
    id: "cream",
    label: "Кремовая",
    description: "Мягкая нейтральная основа для долгого чтения и письма.",
    category: "basic",
    baseColor: "#f4ecd8",
    lineColor: "rgba(186, 156, 112, 0.14)",
    overlay: "none",
  },
  {
    id: "dark",
    label: "Тёмная",
    description: "Тёмный лист для светлых набросков и контрастных пометок.",
    category: "creative",
    baseColor: "#141822",
    lineColor: "rgba(130, 160, 255, 0.18)",
    overlay:
      "linear-gradient(rgba(130,160,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(130,160,255,.14) 1px, transparent 1px)",
  },
  {
    id: "daily",
    label: "Ежедневник",
    description: "Разметка для дат, планов и итогов дня.",
    category: "planning",
    baseColor: "#f7f2e8",
    lineColor: "rgba(130, 141, 182, 0.2)",
    overlay:
      "linear-gradient(90deg, rgba(130,141,182,.18) 140px, transparent 140px), repeating-linear-gradient(180deg, transparent 0 35px, rgba(130,141,182,.2) 35px 36px)",
  },
  {
    id: "planner",
    label: "Планер",
    description: "Колонки и секции для приоритетов, сроков и трекеров.",
    category: "planning",
    baseColor: "#f5efe5",
    lineColor: "rgba(112, 156, 134, 0.2)",
    overlay:
      "linear-gradient(90deg, rgba(112,156,134,.2) 1px, transparent 1px), repeating-linear-gradient(180deg, transparent 0 40px, rgba(112,156,134,.2) 40px 41px)",
  },
  {
    id: "checklist",
    label: "Чек-лист",
    description: "Строки с местом под отметки и быстрый контроль задач.",
    category: "planning",
    baseColor: "#f6f1e8",
    lineColor: "rgba(137, 150, 172, 0.2)",
    overlay:
      "repeating-linear-gradient(180deg, transparent 0 35px, rgba(137,150,172,.18) 35px 36px), repeating-linear-gradient(90deg, rgba(137,150,172,.24) 0 18px, transparent 18px 44px)",
  },
  {
    id: "cornell",
    label: "Cornell notes",
    description: "Поле под ключевые тезисы, заметки и выводы.",
    category: "study",
    baseColor: "#f6f0e4",
    lineColor: "rgba(164, 122, 96, 0.24)",
    overlay:
      "linear-gradient(90deg, transparent 0 140px, rgba(164,122,96,.26) 140px 142px, transparent 142px), linear-gradient(180deg, transparent 0 calc(100% - 88px), rgba(164,122,96,.26) calc(100% - 88px) calc(100% - 86px), transparent calc(100% - 86px)), repeating-linear-gradient(180deg, transparent 0 30px, rgba(164,122,96,.16) 30px 31px)",
  },
  {
    id: "storyboard",
    label: "Storyboard",
    description: "Кадры и подписи для сценариев, сцен и визуальных серий.",
    category: "creative",
    baseColor: "#f8f4ee",
    lineColor: "rgba(91, 91, 91, 0.22)",
    overlay:
      "linear-gradient(rgba(91,91,91,.22) 2px, transparent 2px), linear-gradient(90deg, rgba(91,91,91,.22) 2px, transparent 2px)",
  },
  {
    id: "comic",
    label: "Комикс-разметка",
    description: "Крупные панели для графических историй и заметок по кадрам.",
    category: "creative",
    baseColor: "#f4efe7",
    lineColor: "rgba(52, 52, 52, 0.22)",
    overlay:
      "linear-gradient(rgba(52,52,52,.24) 3px, transparent 3px), linear-gradient(90deg, rgba(52,52,52,.24) 3px, transparent 3px)",
  },
  {
    id: "school",
    label: "Школьная",
    description: "Привычная ученическая разметка для конспектов и домашней работы.",
    category: "study",
    baseColor: "#f6f3eb",
    lineColor: "rgba(114, 149, 222, 0.22)",
    overlay:
      "linear-gradient(90deg, rgba(227,108,108,.24) 72px, transparent 72px), repeating-linear-gradient(180deg, transparent 0 30px, rgba(114,149,222,.22) 30px 31px)",
  },
  {
    id: "lab",
    label: "Лабораторная",
    description: "Техническая разметка для формул, наблюдений и таблиц.",
    category: "study",
    baseColor: "#f1f5f4",
    lineColor: "rgba(88, 148, 142, 0.22)",
    overlay:
      "linear-gradient(90deg, rgba(88,148,142,.2) 1px, transparent 1px), repeating-linear-gradient(180deg, transparent 0 34px, rgba(88,148,142,.22) 34px 35px)",
  },
  {
    id: "architect",
    label: "Архитектурная",
    description: "Сетка для планов, посадок и объёмных набросков.",
    category: "technical",
    baseColor: "#edf1ea",
    lineColor: "rgba(120, 146, 116, 0.22)",
    overlay:
      "linear-gradient(rgba(120,146,116,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(120,146,116,.16) 1px, transparent 1px), linear-gradient(rgba(120,146,116,.28) 2px, transparent 2px), linear-gradient(90deg, rgba(120,146,116,.28) 2px, transparent 2px)",
  },
  {
    id: "drafting",
    label: "Чертёжная",
    description: "Жёсткая геометрическая подложка для аккуратных линий и планов.",
    category: "technical",
    baseColor: "#eef2f5",
    lineColor: "rgba(115, 135, 172, 0.24)",
    overlay:
      "linear-gradient(rgba(115,135,172,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(115,135,172,.18) 1px, transparent 1px), linear-gradient(rgba(115,135,172,.34) 2px, transparent 2px), linear-gradient(90deg, rgba(115,135,172,.34) 2px, transparent 2px)",
  },
];

export const defaultPaperPresetId: PaperPresetId = "lined";

export function getPaperPreset(paperId: PaperPresetId) {
  return paperPresets.find((preset) => preset.id === paperId) ?? paperPresets[0]!;
}

