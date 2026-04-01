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

## Release plan

### v1.1 — Editor Foundation
- привести text / drawing / image / file / shape note к одной ментальной модели;
- выровнять select / move / resize / delete для всех page elements;
- сделать слойность и режимы редактирования предсказуемыми;
- улучшить touch-first UX на iPad;
- стабилизировать autosave/recovery вокруг страницы.

Current status:
- этап почти закрыт как foundation milestone;
- основные interaction cleanup-шаги для text / media / shape / page gestures уже сделаны;
- recovery для page shell, text blocks и drawing draft уже добавлен на session-level;
- остающиеся долги в основном относятся уже не к foundation, а к следующему reliability-слою `v1.2`.

In progress now:
- единый active-object flow уже начат для media/shape/text;
- текстовые блоки переводятся на более объектную модель, где selection и keyboard editing не смешиваются в одно состояние.
- текстовые drag/resize-сценарии выравниваются с overlay-правилами редактора, чтобы они не конкурировали с созданием новых блоков и жестами листа.
- в редакторе начинает появляться общий interaction-layer для selection lifecycle, чтобы меньше держать ручную логику отдельно для text/media/shape.
- следующий слой того же направления уже начат в editor shell: commit/delete path для разных page-объектов постепенно сводится к общим helper-правилам.
- тот же commit/delete path теперь дотягивается и до текстовых блоков, чтобы text не оставался отдельным special-case внутри editor foundation.
- interaction state постепенно выносится из `PageEditorPage` в отдельный editor-lib слой, чтобы экран меньше оставался центральным coordinator-компонентом.
- next step in the same direction: transform-утилиты move/resize/trash-hover тоже начинают жить в общем editor-lib слое, а не в трёх отдельных локальных реализациях.
- long-press drag и pointer-capture cleanup для object layers тоже постепенно сводятся к общим helper-правилам, чтобы media и shape меньше расходились по lifecycle.
- `finish interaction` для object layers тоже сводится к общему helper-path, чтобы commit/delete после drag/resize не оставались двумя отдельными почти одинаковыми реализациями.
- тот же общий `finish interaction` path дотягивается и до text blocks, чтобы завершение transform-сценариев стало единообразным уже для всех основных page-элементов.
- следующий structural слой editor foundation: `media` и `shape` уже начинают использовать общий draft-collection pattern, чтобы временное object state меньше дублировалось между слоями.
- `media` и `shape` уже переведены на общий transform-controller pattern; следующим логичным шагом остаётся решить, насколько далеко тем же путём нужно вести `text`, не ломая keyboard-specific flow.
- параллельно к structural refactor добавляется более явный слой derived interaction-guards, чтобы режимы page gesture / drawing / text editing / object transform меньше конфликтовали между собой.
- безопасный следующий подшаг внутри `v1.1`: продолжать отделять text transform lifecycle от text input lifecycle, оставляя iPad-specific keyboard/focus orchestration в screen-слое.

- text blocks теперь переводятся на отдельный `useTextTransformController`: transform lifecycle выносится из screen-shell, но keyboard/focus orchestration остаётся в `PageEditorPage` как особенно хрупкая iPad-specific зона.

- next safe cleanup inside `v1.1`: continue reducing text-specific guards in `PageEditorPage`, so keyboard entry and transform lifecycle share fewer hidden conditions while iPad focus flow stays local to the screen.
- page-level recovery в `v1.1` усиливается через лёгкий session draft для page shell и text blocks: это закрывает самый частый случай потери несохранённых правок при reload, но ещё не уводит этап в полноценный offline/quota scope `v1.2`.

- внутри `v1.1` добавляется ещё один безопасный recovery-слой: session-level draft для drawing state, чтобы reload/pagehide не откатывали страницу к слишком старому состоянию между ручными сохранениями.

- ещё один маленький cleanup inside `v1.1`: текстовые guard-правила в `PageEditorPage` постепенно сводятся к отдельным helper-ам для keyboard entry, text eraser, bottom-flip touch и sheet-based text creation, чтобы text input и page gestures меньше зависели от разрозненных inline conditions.
- ещё один маленький cleanup inside `v1.1`: touch flip-жесты листа тоже сводятся к отдельным helper-правилам start / abort / reset, чтобы page gestures меньше конфликтовали с selected objects, drawing и text-focused состояниями.
- ещё один маленький cleanup inside `v1.1`: keyboard cleanup текстового слоя тоже сводится к отдельному helper-path, чтобы blur, pen-pointer deactivation и text-layer pointer capture меньше жили как special-case ветки внутри `PageEditorPage`.

- ещё один безопасный cleanup inside `v1.1`: page recovery/persistence helper-слой выносится из `PageEditorPage`, чтобы screen-shell меньше одновременно держал и interaction-логику, и сборку recovery draft objects.

- ещё один маленький cleanup inside `v1.1`: page persistence orchestration постепенно сводится к более явным helper-path для recovery snapshot и update payload, чтобы `PageEditorPage` меньше вручную дублировал одну и ту же shell-state схему между autosave, manual save и recovery.

### v1.2 — Offline Reliability
- усилить Service Worker и cache strategy;
- подготовить UX для quota/storage ошибок в iPad Safari;
- добавить диагностику локального хранилища и recovery path;
- довести reload/reopen/installable offline path до предсказуемого состояния;
- подготовить экспорт/импорт как резервный путь восстановления.

In progress now:
- первый шаг взят с самого безопасного слоя: storage/quota diagnostics в `PWA статус`, чтобы local-first поведение стало наблюдаемым до более рискованных изменений service worker и offline install path.
- следующий подшаг на том же слое: явный recovery path прямо в `PWA статус`, чтобы при warning/danger состоянии пользователь сразу видел, что делать с локальным хранилищем и крупными вложениями.
- текущий практический шаг на том же слое: quota-safe upload flow для изображений, файлов, обложек и фона, чтобы IndexedDB/storage ошибки не терялись молча в editor/notebook/background сценариях.
- следующий practical step на том же reliability-слое: predictable reopen/reload path для страницы, чтобы после локального recovery было явно видно, что восстановилось, и можно было безопасно сохранить или сбросить черновик.
- внутри predictable reopen/reload path отдельный cleanup идёт на drawing dirty-state, чтобы даже очищенный до пустого canvas не терял recovery semantics до ручного сохранения.
- следующий безопасный reliability-шаг уже начат через persisted draft fallback: recovery слоям страницы добавляется `localStorage`-уровень поверх быстрого `sessionStorage`, чтобы reopen/PWA relaunch меньше зависел от одного session lifecycle.
- тот же reliability-слой теперь дотягивается и до overlay draft-domain: `images/files/shapes` начинают попадать в page-level recovery snapshot, чтобы незавершённые transform-сценарии не терялись так легко на `pagehide/reopen`.
- следующий incremental cleanup в том же overlay reliability-слое: локальные draft-mutations этих объектов сами обновляют debounced recovery snapshot, чтобы overlay recovery меньше зависел только от pagehide и parent commit timing.
- следующий low-risk слой install/offline reliability теперь переводится из пассивной диагностики в понятный readiness UX: `PWA статус` должен не только показывать service worker/storage signals, но и объяснять, готово ли приложение к офлайн-запуску и какое следующее действие нужно пользователю.
- внутри page reliability лёгкий `recoveryDraft` теперь тоже дотягивается до `images/files/shapes`, чтобы overlay inline-edit был менее хрупким и не держался только на более тяжёлом snapshot/pagehide пути.
- следующий слой app-level offline reliability уже начинает опираться на явный readiness contract между приложением и Service Worker, чтобы install/reopen path меньше зависел от эвристики кэша и точнее показывал реальную готовность shell к офлайн-запуску.
- поверх этого readiness contract install/offline UX теперь развивается в пошаговый flow, чтобы пользователь видел не только итоговый статус, но и текущий прогресс: HTTPS/SW, прогрев shell, запуск как иконка iPad.
- на том же reliability-слое теперь появляется и ручной backup fallback: экспорт/импорт локальной базы, чтобы recovery path не зависел только от service worker и текущего браузерного storage state.
- следующий cleanup этого же пути уже закрыт: backup import должен полностью сбрасывать stale recovery drafts и перезагружать приложение в чистое восстановленное состояние, а не оставлять старый screen-state поверх новой базы.

### v1.3 — Notebook Power Features
- добавить шаблоны блокнотов и стартовых страниц;
- усилить bookmarks, page thumbnails и быстрый переход;
- добавить поиск по блокнотам и страницам;
- улучшить организацию вложений и page metadata;
- подготовить готовые продуктовые сценарии вроде дневника и проектного блокнота.

### v1.4 — Quality, Polish, Shipping
- закрыть сценарные тесты вокруг editor/data/storage flows;
- усилить regression coverage для IndexedDB и критичных user flows;
- довести loading / empty / error states;
- сделать perf-pass по тяжёлым страницам и большим вложениям;
- нормализовать release discipline, changelog и upgrade path.

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
1. Начать `v1.1` с единой модели активного объекта: selection, deselect, move, resize, delete без конфликтов с page flip и созданием нового текста.
2. Довести эту же модель до одинакового поведения text / image / file / shape note.
3. После этого переходить к `v1.2`: local persistence, quota/error handling и offline recovery.
4. Только затем расширять product power-features и shipping quality layer.

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



- current v1.2 follow-up: app-shell should keep a lightweight offline coach banner until the user has a clearly warmed and install-ready launch path, not just a hidden diagnostics panel.
- current v1.2 follow-up: cache/update discipline should acknowledge the new shell immediately after `activate`, so reopen/update feedback does not lag behind the actual service worker state.

- current v1.2 step: after a new service worker version takes over, the app should ask for an explicit reload instead of silently continuing on stale in-memory UI state.
- current v1.2 follow-up: service worker updates should surface an explicit reload path in app shell, so update/reopen is visible and not hidden behind silent SKIP_WAITING behavior.
- current v1.2 follow-up: heavy backup export/import should preflight size and quota risk before Safari starts a large JSON/base64 roundtrip, so recovery paths fail early and clearly instead of dying mid-operation.
- current v1.2 follow-up: user-facing storage errors should stay readable and scenario-specific for backup, background, cover, image and file flows, especially under iPad Safari quota pressure.
- current v1.2 step: all major local upload entry points should perform quota-aware preflight before starting image/file/background/cover writes, not only after IndexedDB throws.
- current v1.2 follow-up: after upload preflight is in place, the next storage-quality pass should focus on stronger recovery for the heaviest attachment scenarios and more explicit cleanup guidance under Safari pressure.
- current v1.2 step: storage diagnostics should point to actual cleanup targets (heavy notebooks/background assets), not only generic quota percentages.
- current v1.2 follow-up: storage diagnostics should also offer direct cleanup/navigation actions, so users can move from quota warning to a concrete notebook/background cleanup path in one tap.
- current v1.2 step: integrity repair should safely clean orphan blobs and broken singleton links without silently deleting user content that still needs manual review.
- current v1.2 follow-up: keep growing a small automated safety net around storage/offline helpers while the project is still local-first and schema-light.
- current v1.2 step: offline readiness should be computed by one shared gate across shell/status UI, so the app stops giving mixed signals about whether offline launch is actually safe.
