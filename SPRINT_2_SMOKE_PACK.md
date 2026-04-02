# Sprint 2 Smoke Pack

Этот smoke-pack фиксирует ручную проверку для `v1.2 / Offline Reliability`.

## Preconditions

- запускать сборку из актуального `main`;
- проверять минимум в desktop Chrome и в iPad Safari / Home Screen path;
- тестировать на профиле, где уже есть несколько блокнотов, страниц, изображений и файлов;
- для quota-pressure сценариев подготовить хотя бы один тяжёлый блокнот и пользовательский фон.

## Upload Preflight

- [ ] Добавление тяжёлого изображения на страницу сначала показывает warning/block до записи в IndexedDB.
- [ ] Добавление тяжёлого файла на страницу сначала показывает warning/block до записи в IndexedDB.
- [ ] Добавление тяжёлых файлов в блокнот проходит через тот же preflight path.
- [ ] Пользовательская обложка блокнота проходит через quota-aware preflight.
- [ ] Пользовательский фон приложения проходит через quota-aware preflight.

## Storage Error UX

- [ ] При storage/quota ошибке UI не падает молча и показывает user-facing сообщение.
- [ ] Для backup export/import warning и blocked состояния различаются и объясняются до запуска тяжёлой операции.
- [ ] После неудачной локальной записи в `PWA статусе` виден последний failed write.

## Recovery And Cleanup

- [ ] `PWA статус` показывает storage health summary без DevTools.
- [ ] При warning/danger состоянии в `PWA статусе` появляется recovery plan с явными следующими действиями.
- [ ] Если есть тяжёлый блокнот, recovery plan ведёт к нему отдельной кнопкой.
- [ ] Если есть пользовательский фон, recovery plan даёт отдельный путь вернуться на главный экран и облегчить фон.
- [ ] Если есть pending recovery drafts, их можно увидеть и очистить вручную.
- [ ] Если есть orphan assets или broken local links, `repair storage` чинит безопасные случаи без silent data loss.

## Backup Path

- [ ] Export backup создаёт JSON-файл и не ломает текущее UI-состояние.
- [ ] Import backup заменяет локальную базу, чистит stale recovery drafts и перезагружает приложение.
- [ ] После import/reload приложение поднимается в согласованном состоянии без старого screen-state поверх новой базы.

## Done Criteria

Sprint 2 можно считать закрытым только если:
- все пункты выше проходят без silent failure;
- `PWA статус` даёт один понятный ответ по storage health, recovery и cleanup;
- новые тяжёлые local-first операции либо проходят предсказуемо, либо заранее блокируются/предупреждаются.
