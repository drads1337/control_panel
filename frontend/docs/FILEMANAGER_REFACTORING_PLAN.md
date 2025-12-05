# План рефакторинга FileManager

## Текущее состояние

- **Размер файла:** ~1110 строк
- **Проблемы:**
  - Смешанная логика и UI
  - Большой монолитный компонент
  - Сложно тестировать
  - Сложно поддерживать

## Уже выполненные улучшения

✅ **Созданы хуки:**
- `useFileManagerSelection` - управление выбором файлов
- `useFileManagerDialogs` - управление диалогами
- `useFileManagerFilters` - фильтрация файлов
- `useFileManagerUpload` - загрузка файлов

✅ **Созданы утилитарные функции:**
- `file-utils.ts` - `getFileIcon`, `formatFileSize`

✅ **Создан хук бизнес-логики:**
- `use-file-manager-logic.ts` - вся логика загрузки данных, операций с файлами

✅ **Вынесены UI компоненты:**
- `FileItem.tsx` - компоненты для отображения файлов (Desktop/Mobile)

## Структура после рефакторинга

```
files/
├── components/
│   ├── FileItem.tsx ✅ (Desktop/Mobile компоненты)
│   ├── FilesList.tsx (список файлов с виртуализацией)
│   ├── FileManagerHeader.tsx (заголовок с селектором)
│   ├── FileManagerEmptyState.tsx (пустое состояние)
│   ├── FileManagerSelectionBar.tsx (панель выбранных файлов)
│   └── index.ts
├── hooks/
│   ├── use-file-manager-logic.ts ✅ (основная логика)
│   └── use-media-query.ts (хук для медиа-запросов)
├── utils/
│   └── file-utils.ts ✅ (утилитарные функции)
├── FileManagerContainer.tsx (Container - логика)
├── FileManagerView.tsx (View - UI)
└── FileManager.tsx (главный экспорт)
```

## Следующие шаги

### 1. Вынести оставшиеся UI компоненты
- [ ] `FilesList.tsx` - список с виртуализацией
- [ ] `FileManagerHeader.tsx` - заголовок
- [ ] `FileManagerEmptyState.tsx` - пустое состояние
- [ ] `FileManagerSelectionBar.tsx` - панель выбора

### 2. Создать Container/View структуру
- [ ] `FileManagerContainer.tsx` - использует хук логики
- [ ] `FileManagerView.tsx` - чистый UI компонент
- [ ] Обновить `FileManager.tsx` - просто экспортирует Container

### 3. Вынести медиа-запросы
- [ ] Создать `use-media-query.ts` в shared hooks

## Метрики улучшений

**До рефакторинга:**
- `FileManager.tsx`: 1110 строк
- Смешанная логика и UI
- Сложно тестировать

**После рефакторинга:**
- `FileManagerContainer.tsx`: ~150 строк (логика)
- `FileManagerView.tsx`: ~300 строк (UI)
- Раздельные компоненты: ~100-200 строк каждый
- Улучшена тестируемость и поддерживаемость

## Рекомендации

1. Рефакторинг можно делать постепенно, не нарушая работу
2. Начать с выноса UI компонентов
3. Затем создать Container/View структуру
4. Добавить тесты для новых компонентов

## Преимущества

- ✅ Разделение ответственности (SRP)
- ✅ Легче тестировать отдельные части
- ✅ Переиспользуемые компоненты
- ✅ Улучшенная читаемость
- ✅ Проще поддерживать
