# Changelog

Все заметные изменения проекта следует фиксировать здесь.

Этот файл начинает формальную историю изменений **с текущего baseline репозитория**. Ранние шаги развития не восстановлены commit-by-commit, поэтому ниже зафиксировано то, что уже видно в актуальном состоянии проекта.

## [Unreleased]

### Added
- рабочая product-основа русскоязычного офлайн-блокнота для iPad в формате PWA;
- экран «Мои блокноты»;
- создание и редактирование блокнотов;
- выбор фона приложения из пресетов и собственного изображения;
- визуальные стили блокнотов;
- обложки и переплёты;
- расширяемый каталог бумаги;
- расширяемый каталог инструментов;
- экран блокнота со страницами и файлами;
- прямое открытие блокнота в рабочую страницу;
- редактор страницы с текстом, рисованием, изображениями, файлами и вставками;
- drag/resize для части объектов страницы;
- корзина для удаления объектов перетаскиванием;
- закладки страниц;
- локальное хранение через IndexedDB;
- базовая PWA-инфраструктура и Service Worker;
- CI workflow для `npm run check` и `npm run build`;
- issue templates и PR template.

### Changed
- начат `v1.3 — Notebook Power Features`: на главном экране, экране блокнота и в панели закладок редактора появился локальный поиск, а список страниц блока получил быстрый `page strip` с мини-метаданными для перехода между недавними листами;
- проект ушёл от уровня «стартовый шаблон» к более цельной локальной продуктовой базе;
- данные, пресеты и конфигурации вынесены из UI в отдельные типы, конфиги и shared-слой;
- архитектура сохранена модульной: `app`, `features`, `shared/config`, `shared/lib`, `shared/types`, `shared/ui`.
- начат этап `v1.1 — Editor Foundation`: редактор переходит к единой модели активного объекта;
- выбор media/shape/text объекта теперь заметнее отделён от page flip и создания нового текстового блока на листе;
- режимы выбора объекта и редактирования текста стали чище пересекаться между собой внутри редактора.
- текстовые блоки начали вести себя ближе к другим page-объектам: состояние «блок выбран» теперь отделяется от состояния «печатаю внутри блока».
- текстовые блоки жёстче встроены в общую overlay-модель редактора: drag/resize больше не должны конфликтовать с созданием нового текста на листе.
- внутри редактора появился более общий selection lifecycle для page-объектов: text/media/shape чаще проходят через одинаковые helpers выбора и снятия выбора.
- `shape/image/file` начали использовать более единый commit/delete path в editor shell, что уменьшает ручной разнобой между типами page-элементов.
- текстовые блоки тоже переведены на более явный `commit/delete` path, чтобы завершение drag/edit/delete меньше зависело от отдельных ручных веток логики.
- часть editor interaction state вынесена из `PageEditorPage` в отдельный helper-layer, чтобы selection и базовые коллекционные операции меньше жили прямо внутри экранного компонента.
- повторяющиеся transform-утилиты вынесены в общий editor-lib слой и теперь используются в screen/media/shape частях редактора вместо нескольких локальных копий.
- long-press и pointer-capture часть transform lifecycle для `media` и `shape` тоже начала использовать общий helper-layer вместо двух почти одинаковых локальных реализаций.
- `finish interaction` для object layers тоже начал проходить через общий helper, так что media и shape меньше дублируют commit/delete завершение drag-сценариев.
- текстовые блоки тоже переведены на тот же общий `finish interaction` helper-path, так что text перестаёт выбиваться из общего drag/resize finish flow редактора.
- `media` и `shape` начали использовать общий draft-collection hook для временного interaction-state, вместо отдельных локальных схем `state + ref + resync`.
- `media` и `shape` теперь используют и общий transform-controller hook, поэтому их long-press / drag / resize / finish lifecycle уже сведён к одной модели, а не двум параллельным реализациям.
- в `PageEditorPage` появился более явный слой derived interaction-guards, чтобы page flip, создание нового текста и object interactions опирались на более единые правила;
- закрыт special-case `Pencil` поверх текстового блока: рисование больше не должно упираться в overlay-guard текстового элемента.

- transform lifecycle текстовых блоков начал выноситься в отдельный `useTextTransformController`, при этом keyboard/focus orchestration сознательно остаётся в `PageEditorPage`, чтобы не ломать iPad Safari input flow.

- transform lifecycle С‚РµРєСЃС‚РѕРІС‹С… Р±Р»РѕРєРѕРІ РЅР°С‡Р°Р» Р¶РёС‚СЊ РІ РѕС‚РґРµР»СЊРЅРѕРј `useTextTransformController`, РїСЂРё СЌС‚РѕРј keyboard/focus orchestration РѕСЃС‚Р°С‘С‚СЃСЏ РІ `PageEditorPage`, С‡С‚РѕР±С‹ РЅРµ Р»РѕРјР°С‚СЊ iPad focus timing.

- sheet-level text guards стали явнее: keyboard entry и drawing routing теперь проходят через отдельные helper-правила, чтобы text input и text transform меньше конфликтовали внутри `PageEditorPage`.
- для page shell и text blocks добавлен лёгкий session-level recovery draft: при незавершённых изменениях редактор может восстановить заголовок, бумагу, layout и текстовые блоки после перезагрузки вкладки, не залезая в более тяжёлый offline/quota слой `v1.2`.

- РµС‰С‘ РѕРґРёРЅ recovery-слой РґРѕР±Р°РІР»РµРЅ РґР»СЏ drawing draft: РєРѕСЂРѕС‚РєРёРµ РІРЅСѓС‚СЂРµРЅРЅРёРµ С€С‚СЂРёС…Рё С‚РµРїРµСЂСЊ РјРѕРіСѓС‚ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°С‚СЊСЃСЏ РёР· sessionStorage РїРѕСЃР»Рµ reload/pagehide, РїРѕРєР° РѕРЅРё РµС‰С‘ РЅРµ СѓС€Р»Рё РІ СЏРІРЅРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ.
- text-specific guards РІ `PageEditorPage` СЃС‚Р°Р»Рё СЏРІРЅРµРµ: Р»РѕРіРёРєР° keyboard entry, text eraser, bottom-flip touch Рё СЃРѕР·РґР°РЅРёСЏ РЅРѕРІРѕРіРѕ text block РЅР°Рґ sheet surface СЂР°Р·РІРµРґРµРЅР° РїРѕ РѕС‚РґРµР»СЊРЅС‹Рј helper-РїСЂР°РІРёР»Р°Рј.
- page touch gestures РІ `PageEditorPage` С‚РѕР¶Рµ СЃС‚Р°Р»Рё С‡РёС‰Рµ: start / abort / reset flip-gesture РґР»СЏ Р»РёСЃС‚Р° СЃРІРµРґРµРЅС‹ Рє РѕС‚РґРµР»СЊРЅС‹Рј helper-РїСЂР°РІРёР»Р°Рј, С‡С‚Рѕ РјРµРЅСЊС€Рµ РґСѓР±Р»РёСЂСѓРµС‚ touch-РІРµС‚РєРё Рё СѓРїСЂРѕС‰Р°РµС‚ РєРѕРЅС„Р»РёРєС‚С‹ РјРµР¶РґСѓ flip/select/drawing.
- text-layer keyboard cleanup РІ `PageEditorPage` С‚РѕР¶Рµ СЃРІРµРґС‘РЅ Рє Р±РѕР»РµРµ СЏРІРЅРѕРјСѓ helper-РїСѓС‚Рё: pointer capture, blur Рё pen-triggered text deactivation РјРµРЅСЊС€Рµ РґСѓР±Р»РёСЂСѓСЋС‚ СЂСѓС‡РЅСѓСЋ Р»РѕРіРёРєСѓ.

- page recovery/persistence draft objects СЃРѕР±РёСЂР°СЋС‚СЃСЏ С‡РµСЂРµР· РѕР±С‰РёР№ helper-layer `pageRecoveryDraft`, С‡С‚Рѕ РјРµРЅСЊС€Рµ РґСѓР±Р»РёСЂСѓРµС‚ РѕРґРёРЅ Рё С‚РѕС‚ Р¶Рµ page snapshot РІ РЅРµСЃРєРѕР»СЊРєРёС… persistence/recovery С‚РѕС‡РєР°С… `PageEditorPage`.
- `v1.1 — Editor Foundation` подведён к состоянию almost-closed milestone: editor shell заметно меньше зависит от разрозненных special-case paths для text/media/shape/page gestures/recovery, и следующий крупный фокус логично смещается к `v1.2`.
- также начат `v1.2 — Offline Reliability`: в `PWA статус` добавлена storage/quota diagnostics по `navigator.storage`, чтобы было видно usage, quota и persistent-storage сигналы локального хранилища.
- в `PWA статус` исправлены битые русские строки и добавлен более явный recovery-блок с подсказками, что делать при warning/danger состоянии локального хранилища.
- для загрузки изображений, файлов, обложек и фона добавлен более явный quota/storage error handling: ошибки локального хранилища теперь подхватываются user-friendly сообщениями вместо молчаливых срывов UI.
- reload/reopen путь страницы стал предсказуемее: если редактор поднял локальный черновик после перезапуска, пользователь теперь видит явный recovery-баннер и может либо сохранить изменения, либо сбросить черновик к последней сохранённой версии.
- исправлена эвристика dirty-state у рисования: очищенный до пустого состояния drawing layer теперь тоже остаётся recovery-aware черновиком до явного сохранения, а не выглядит ложным `saved`.
- recovery drafts страницы теперь пишутся не только в `sessionStorage`, но и в persisted fallback через `localStorage`, поэтому реальный reopen/PWA relaunch стал устойчивее без отдельной IndexedDB migration.
- recovery snapshot страницы теперь включает и overlay draft-domain (`images/files/shapes`), поэтому mid-drag и незавершённые transform-сценарии этих объектов лучше переживают `pagehide/reopen`.
- overlay draft-mutations теперь сами триггерят debounced refresh recovery snapshot, поэтому локальные drag/resize/edit сценарии `images/files/shapes` меньше зависят только от `pagehide` или позднего parent-state commit.
- `PWA статус` стал активнее для offline/install readiness: теперь он не только показывает диагностику, но и объясняет, готово ли приложение к офлайн-запуску, что сделать дальше, и позволяет явно запросить `persistent storage`, если браузер это поддерживает.
- лёгкий `recoveryDraft` страницы теперь тоже реагирует на `images/files/shapes`, поэтому inline-edit сценарии overlay-объектов меньше зависят только от snapshot/pagehide-path и стали ближе по надёжности к обычным text blocks.
- app-level offline readiness теперь опирается на явный `SW ready marker`: Service Worker подтверждает успешный прогрев shell, и `PWA статус` показывает readiness уже по этому контракту, а не только по косвенной эвристике кэша.
- install/reopen path в `PWA статус` стал пошаговым: теперь там есть checklist прогресса по HTTPS/SW, прогреву shell и запуску как иконки iPad, плюс явная кнопка перепроверки readiness.
- в `PWA статус` добавлен ручной backup path: экспорт и импорт локальной базы в JSON-файл, чтобы у приложения был recovery fallback помимо service worker, storage drafts и quota diagnostics.

- persistence orchestration РІ `PageEditorPage` С‚РѕР¶Рµ СЃС‚Р°Р»Р° С‡РёС‰Рµ: build-path РґР»СЏ recovery draft Рё update payload СЃРІРµРґС‘РЅ Рє СЏРІРЅС‹Рј helper-Р°Рј РІРјРµСЃС‚Рѕ РїРѕРІС‚РѕСЂРµРЅРёСЏ РѕРґРЅРѕР№ Рё С‚РѕР№ Р¶Рµ page-shell С…РµРјС‹ РІ РЅРµСЃРєРѕР»СЊРєРёС… РјРµСЃС‚Р°С….

### Notes
- Текущая версия ещё не считается финальным продуктом.
- Следующий фокус: editor reliability, offline robustness и архитектурная стабилизация редактора.



- app shell now shows a lightweight offline coach banner until HTTPS / shell warmup / Home Screen launch path looks ready, so the install flow is visible without opening the full PWA status panel.
- service worker now pushes confirmed runtime status right after `activate`, so reopen/update UI receives the new shell state without waiting for a manual refresh.

- service worker update/reopen path now surfaces a reload banner after a new shell takes over, so the app does not silently keep running an old screen state on top of a new cache contract.
- service worker update/reopen path now exposes an explicit app-shell banner, so a newly activated offline shell asks for reload instead of updating silently in the background.
- storage-heavy backup flow now performs preflight checks before export/import, shows clearer size-risk messaging, and blocks obviously unsafe restore scenarios before Safari starts parsing a huge JSON payload.
- storage quota errors and size warnings are now normalized in clean Russian text, so heavy asset and backup failures no longer fall back to broken mojibake recovery messages.
- heavy upload flows now warn or block earlier for page images, page files, notebook attachments, custom covers and custom backgrounds, so large local-first operations fail before IndexedDB writes instead of collapsing mid-upload.
- asset persistence now does an extra quota-aware preflight before writing blobs, so oversized or almost-over-quota uploads are rejected with clearer recovery guidance.
- PWA status now includes a cleanup-oriented storage breakdown, so Safari quota pressure is tied to concrete notebooks and assets instead of only a generic usage percent.
- cleanup-oriented storage breakdown now includes quick actions, so from the PWA status panel you can jump straight to the heaviest notebook or back to the home screen to lighten a custom background.
- storage integrity audit now detects orphan assets, broken cover/background references and dangling local links, and the PWA status panel can run a safe repair pass for the non-destructive cases.
- custom cover/background replacement now cleans up stale previous assets instead of leaving silent local blobs behind.
- a lightweight Vitest smoke layer now covers storage preflight and storage integrity helpers, so `v1.2` has its first direct automated checks beyond build/typecheck.
- offline launch state is now derived from a shared readiness gate used by both the shell coach and PWA status panel, so the app gives one consistent answer to “offline is ready or not”.
- service worker updates now wait for explicit user action instead of silently forcing `skipWaiting`, so Sprint 1 update flow is `apply update -> takeover -> reload`.
- app shell and `PWA статус` now read the same worker-confirmed runtime status, so offline readiness and update state no longer diverge between two UI surfaces.
- CI now runs `npm run test` in addition to typecheck and build, and Sprint 1 has a dedicated smoke checklist in `SPRINT_1_SMOKE_PACK.md`.
- `PWA статус` now includes storage health diagnostics for `IndexedDB` / `localStorage` availability and the last known local write result, so QA and support can inspect persistence state without opening DevTools.
- pending page recovery drafts are now observable inside `PWA статус`, including storage source and draft kind, and can be cleared manually when reopen/recovery state needs a clean reset.
- storage-heavy local operations now leave a lightweight write-status trail for support/debug scenarios, so storage failures are easier to localize after asset writes, background updates and integrity repair actions.
- стартовал `v1.3 — Notebook Power Features`: добавлены локальный поиск по блокнотам и страницам, фильтр bookmarked pages, поиск по закладкам в редакторе и быстрый jump-strip внутри блокнота.
