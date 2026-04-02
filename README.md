# MyBestIpadApp

Русскоязычный `offline-first` блокнот для iPad в формате `PWA`.

Проект развивается как локальное notebook-приложение с упором на:
- работу без интернета;
- хранение данных на устройстве;
- touch-first UX для iPad;
- локальный редактор страниц с текстом, рисованием и вложениями;
- архитектуру без giant editor component.

## Текущее состояние

Проект уже не является стартовым шаблоном. Сейчас это рабочая локальная продуктовая база со следующими возможностями:
- экран `Мои блокноты`;
- создание и редактирование блокнотов;
- выбор фона приложения, обложек и визуальных стилей;
- экран блокнота со страницами и файлами;
- редактор страницы с текстом, рисованием, изображениями, файлами и вставками;
- локальное хранение через `IndexedDB`;
- `Service Worker`, installable `PWA` path и offline shell;
- `PWA статус`, backup import/export и базовая storage/quota diagnostics.

## Sprint 1

Sprint 1 по offline launch hardening завершён.

Что зафиксировано в коде и UX:
- offline readiness считается через единый shared gate;
- `AppShell` и `PWA статус` используют один worker-confirmed runtime status;
- обновление `Service Worker` больше не применяется молча;
- update flow теперь явный: `update available -> apply update -> reload`;
- после takeover нового shell приложение просит явную перезагрузку;
- smoke-check для релизной проверки вынесен в отдельный документ.

Практический чеклист спринта:
- [SPRINT_1_SMOKE_PACK.md](/D:/Codex/MyBestIpadApp/SPRINT_1_SMOKE_PACK.md)

## Что дальше

`Sprint 2 / v1.2 storage-quota safety` на текущем baseline можно считать закрытым.

Что уже закрыто в этом слое:
- quota-aware preflight для тяжёлых изображений, файлов, обложек и фона;
- storage/quota diagnostics, storage health summary и backup import/export в `PWA статус`;
- cleanup/repair path для локальных links и stale recovery drafts;
- явный recovery plan для blob-heavy quota-pressure сценариев;
- зафиксированные версии зависимостей вместо `latest`;
- отдельный smoke-check для ручной проверки storage/quota/recovery сценариев.

Следующий рабочий фокус проекта: `v1.3 / Notebook Power Features`.

## Стек

- `React`
- `TypeScript`
- `Vite`
- `PWA`
- `IndexedDB`
- `Service Worker`

## Структура проекта

```text
src/
  app/        routes и shell приложения
  features/   notebooks, pages, editor, drawing
  shared/     config, lib, types, ui
```

## Запуск

```bash
npm ci
npm run dev
```

## Проверки

```bash
npm run test
npm run check
npm run build
```

## Архитектурные ориентиры

Важно сохранять текущее модульное разбиение:
- `app` для shell и маршрутов;
- `features` для предметных сценариев;
- `shared/lib` для persistence, PWA и инфраструктуры;
- `shared/types` и `shared/config` для доменной модели и пресетов;
- `shared/ui` для общих компонентов.

Важно не допускать:
- возвращения к giant `PageEditorPage` как центральному god-component;
- разъезда offline state между несколькими UI-поверхностями;
- silent update behavior у `Service Worker`;
- роста product features раньше, чем доказана storage/offline надёжность.

## Ограничения текущей версии

Пока ещё требуют внимания:
- лимиты `iPad Safari` по storage/quota;
- blob-heavy сценарии с изображениями, файлами, фонами и обложками;
- полное выравнивание editor interaction model для всех типов page-элементов;
- расширение regression coverage на критичные пользовательские сценарии.

## Не входит в ближайший scope

- cloud sync;
- multi-user collaboration;
- сложная серверная часть;
- переход в нативный iOS stack;
- декоративные улучшения раньше, чем закрыта надёжность editor/storage слоя.

## Документация

- [ROADMAP.md](/D:/Codex/MyBestIpadApp/ROADMAP.md) — куда проект идёт дальше;
- [CHANGELOG.md](/D:/Codex/MyBestIpadApp/CHANGELOG.md) — заметные изменения;
- [SPRINT_1_SMOKE_PACK.md](/D:/Codex/MyBestIpadApp/SPRINT_1_SMOKE_PACK.md) — release smoke-check для Sprint 1;
- [SPRINT_2_SMOKE_PACK.md](/D:/Codex/MyBestIpadApp/SPRINT_2_SMOKE_PACK.md) — storage/quota/recovery smoke-check для Sprint 2;
- [PROJECT_SUMMARY.md](/D:/Codex/MyBestIpadApp/PROJECT_SUMMARY.md) — ранний проектный контекст и продуктовая рамка.
