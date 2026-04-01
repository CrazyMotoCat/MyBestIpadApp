# MyBestIpadApp Roadmap

## Purpose

Этот документ фиксирует, **куда проект идёт дальше**.

README должен отвечать на вопрос «что проект представляет собой сейчас», а ROADMAP — на вопрос «что делать дальше, в каком порядке и почему».

## Product direction

Целевое состояние проекта:
- красивый русскоязычный offline-first блокнот для iPad;
- ощущение нативного notebook experience, а не просто сайта;
- надёжный локальный редактор страниц;
- хорошая работа с touch/scroller/stylus сценариями;
- расширяемая архитектура без гигантских монолитных компонентов.

## Current priorities

### P0 — Editor reliability
- сделать поведение редактора устойчивым при реальных touch-сценариях;
- выровнять drag / resize / selection / delete для разных типов page-элементов;
- улучшить автосохранение и восстановление состояния страницы;
- избежать потери данных при перезагрузке, случайном закрытии или обновлении.

### P0 — Offline and storage robustness
- укрепить Service Worker и cache-стратегию;
- аккуратно работать с крупными вложениями и Blob-данными;
- добавить более прозрачную диагностику ошибок local persistence;
- учесть лимиты Safari/iPad по хранилищу и квотам.

### P1 — Architecture of the editor
- отделить page model, canvas interaction, media layer и UI chrome;
- не допустить превращения редактора в один центральный god-component;
- сделать сценарии страницы проще для тестирования и сопровождения.

### P1 — Product UX polish
- довести визуальную консистентность темы «космос + мото»;
- выровнять touch targets, нижние панели, боковую колонку и floating actions;
- улучшить ощущение «реального блокнота», а не набора карточек.

### P2 — Advanced notebook features
- развить навигацию по страницам;
- улучшить работу с файлами и изображениями;
- подготовить основу для шаблонов страниц, richer bookmarks и smart page tools.

## Main technical hotspots

### 1. Editor interaction model
Сейчас это наиболее чувствительная часть продукта:
- текст;
- рисование;
- вставки;
- изображения;
- файлы;
- выделение/перемещение/масштабирование.

Именно здесь выше всего риск накопления хаотичной логики.

### 2. Offline persistence
`IndexedDB` и хранение `Blob` уже стали реальной product-critical частью приложения. Следующий этап — не просто «сохранять», а делать это предсказуемо, устойчиво и объяснимо при ошибках.

### 3. Touch UX for iPad
Большая часть ценности приложения завязана на комфорт touch-использования:
- жесты;
- области попадания;
- режимы рисования/ластика;
- page navigation;
- lower-center tools и drag-to-trash сценарии.

### 4. Asset-heavy UI
Фоны, обложки, пользовательские изображения и файлы усиливают продукт, но одновременно увеличивают нагрузку на storage, rendering и offline cache.

## Review backlog

Актуальные долги и зоны внимания:
- привести все page-элементы к единой модели интерактивности;
- отделить чистую модель страницы от UI-представления;
- усилить graceful handling для крупных локальных вложений;
- улучшить recoverability после storage/quota ошибок;
- выровнять offline-поведение между первым запуском, повторным запуском и installable PWA-path;
- усилить quality gates вокруг touch UX и editor regression paths;
- добавить больше прозрачности в статус сохранения и ошибки persistence.

## Phased roadmap

### Phase 1 — Stabilize the editor core
Цель: сделать редактор надёжным и предсказуемым.

Suggested work:
- unify selection / move / resize behavior;
- довести erase/delete сценарии;
- выровнять поведение text/image/file/shape elements;
- стабилизировать page restore after reopen;
- сократить количество скрытых side effects внутри editor state.

Success signal:
- пользователь не теряет контекст и объекты;
- элементами страницы можно управлять единообразно;
- reopen страницы не приводит к неожиданным расхождениям.

### Phase 2 — Strengthen offline and persistence
Цель: сделать offline-first обещание действительно надёжным.

Suggested work:
- улучшить cache strategy для shell и assets;
- добавить диагностику storage/quota failures;
- аккуратнее обрабатывать Blob-heavy scenarios;
- ввести recovery guidance для пользователя;
- проверить install/reopen/update сценарии PWA.

Success signal:
- меньше рисков silent failure в local storage;
- понятнее recovery после ошибки;
- installable/offline path ведёт себя стабильнее.

### Phase 3 — Refactor editor architecture
Цель: не дать росту функций сломать сопровождение.

Suggested work:
- отделить page composition layer;
- вынести interaction state в более узкие модули;
- развести layout/editor/media/persistence ответственности;
- подготовить поверхность для тестов и будущих фич.

Success signal:
- новые фичи не требуют переписывать editor shell;
- код легче читать и безопаснее менять.

### Phase 4 — Deepen notebook features
Цель: усилить ценность продукта как ежедневного notebook tool.

Suggested work:
- шаблоны страниц;
- richer bookmarks/navigation;
- улучшенная работа с файлами и изображениями;
- более сильные сценарии page organization;
- smarter paper/tool presets.

Success signal:
- приложение становится не только красивым, но и действительно удобным для ежедневных записей.

### Phase 5 — Polish the product feel
Цель: довести experience до уровня цельного продукта.

Suggested work:
- продолжить polish темы «космос + мото»;
- улучшить microinteractions;
- выровнять иерархию панелей и модалок;
- усилить ощущение physical notebook там, где это не мешает usability;
- убрать остаточный «web app feel» в ключевых сценариях.

Success signal:
- приложение ощущается собранным, дорогим и уверенным в использовании.

## Versioned backlog

### vNext — Editor Reliability
- unify interaction model for all page elements;
- improve autosave and reopen consistency;
- stabilize erase / delete / drag-to-trash flows;
- reduce accidental state loss.

### vNext+1 — Offline Hardening
- improve Service Worker strategy;
- add storage diagnostics and quota-aware UX;
- review large Blob handling;
- strengthen persistence recovery paths.

### vNext+2 — Editor Architecture
- split editor orchestration into narrower layers;
- isolate interaction state from rendering state;
- reduce coupling between page data and UI controls.

### vNext+3 — Product Features
- richer page templates;
- better file and image workflows;
- page organization improvements;
- more powerful notebook customization.

### vNext+4 — UX Polish
- continue iPad-first touch polish;
- improve panel density and readability;
- refine notebook visual identity;
- reduce rough edges in navigation and state transitions.

## Suggested immediate next steps

Лучший практический порядок сейчас:
1. Стабилизировать editor interactions.
2. Усилить local persistence и quota/error handling.
3. Дробить editor architecture только после фикса самых болезненных interaction flows.
4. Только затем расширять user-facing features.

## Explicit non-goals for the near term

Что не должно съедать фокус раньше времени:
- cloud sync;
- multi-user collaboration;
- сложная серверная часть;
- «нативизация» через полный переход в iOS stack;
- декоративные эффекты, если под ними ещё нестабилен editor core.

## Success criteria

Roadmap можно считать успешным, если проект придёт в такое состояние:
- приложение надёжно работает offline;
- touch-редактор предсказуем и не раздражает;
- локальное хранение не выглядит хрупким;
- новые функции добавляются без архитектурного хаоса;
- визуально это действительно premium notebook experience, а не просто PWA с красивым фоном.

