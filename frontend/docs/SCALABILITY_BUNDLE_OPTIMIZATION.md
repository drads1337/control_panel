# Масштабируемость и Оптимизация Bundle

## Обзор

Этот документ описывает стратегии оптимизации размера bundle и улучшения производительности приложения.

## Проблемы и Решения

### 1. Barrel Files (index.ts) и Tree-Shaking

#### Проблема
Чрезмерное использование barrel файлов (`index.ts`) негативно влияет на tree-shaking:
- Все импорты из barrel файла становятся частью одного модуля
- Сборщику сложнее определить, что можно безопасно удалить
- Увеличивается размер первоначального bundle

#### Решение
Использовать прямые импорты в критических путях рендеринга (от `main.tsx` до первой видимой страницы):

**До (плохо):**
```typescript
// ❌ Импорт через barrel файл
const Dashboard = React.lazy(() => 
  import('@/app/dashboard').then(module => ({ default: module.ProtectedUserDashboard }))
)
```

**После (хорошо):**
```typescript
// ✅ Прямой импорт конкретного модуля
const Dashboard = React.lazy(() => 
  import('@/app/dashboard/protected-dashboard-components').then(
    module => ({ default: module.ProtectedUserDashboard })
  )
)
```

#### Рекомендации по рефакторингу

1. **Критические пути рендеринга** - использовать прямые импорты:
   - `main.tsx` → `App.tsx` → `UserLayout` → первая страница
   - Ленивая загрузка страниц (`React.lazy`)

2. **Некритические импорты** - можно оставить barrel файлы:
   - Утилиты
   - Хуки (не на критическом пути)
   - Типы и интерфейсы

3. **Приоритет рефакторинга:**
   - Высокий: Lazy loading импорты в `user-layout.tsx`
   - Средний: Импорты в `App.tsx` и провайдерах
   - Низкий: Внутренние импорты компонентов

### 2. Web Workers для Тяжелых Вычислений

#### Проблема
Тяжелые клиентские вычисления (парсинг больших файлов, сложные расчеты) могут заблокировать основной поток и заморозить UI.

#### Решение
Использовать Web Workers для фоновых вычислений:

**Примеры задач для Web Workers:**
- Парсинг больших JSON/CSV файлов (>10MB)
- Обработка изображений (resize, фильтры)
- Сложные математические расчеты для аналитики
- Сортировка/фильтрация больших массивов данных (>10k элементов)
- Генерация отчетов

**Использование:**
```typescript
import { parseLargeFile } from '@/lib/workers/file-parser-worker'

// В основном потоке
const result = await parseLargeFile(file)
```

### 3. Анализ Bundle

#### Инструменты
1. **Vite Bundle Analyzer** - уже настроен:
   ```bash
   npm run build:analyze
   ```
   Генерирует `dist/stats.html` с визуализацией размера bundle

2. **Webpack Bundle Analyzer** (если мигрируете):
   ```bash
   npm install --save-dev webpack-bundle-analyzer
   ```

#### Метрики для отслеживания
- **Initial Bundle Size** - размер первоначальной загрузки
- **Total Bundle Size** - общий размер всех chunks
- **Largest Chunks** - самые большие модули
- **Duplicate Dependencies** - дублирующиеся зависимости

#### Целевые значения
- Initial bundle: < 300KB (gzipped)
- Total bundle: < 1MB (gzipped)
- Largest chunk: < 200KB (gzipped)

## План Действий

### Фаза 1: Анализ (Неделя 1)
- [x] Настроить bundle analyzer
- [ ] Запустить анализ текущего bundle
- [ ] Определить топ-10 самых больших модулей
- [ ] Найти дублирующиеся зависимости

### Фаза 2: Оптимизация Lazy Loading (Неделя 2)
- [ ] Рефакторинг импортов в `user-layout.tsx`
- [ ] Рефакторинг импортов в `guest-layout.tsx`
- [ ] Замена barrel файлов на прямые импорты
- [ ] Измерение улучшений

### Фаза 3: Web Workers (Неделя 3)
- [ ] Создать утилиты для Web Workers
- [ ] Мигрировать тяжелые вычисления
- [ ] Добавить обработку ошибок
- [ ] Тестирование производительности

### Фаза 4: Мониторинг (Неделя 4)
- [ ] Настроить CI/CD проверки размера bundle
- [ ] Создать дашборд с метриками
- [ ] Настроить алерты при увеличении размера

## Чеклист перед коммитом

- [ ] Проверить размер bundle: `npm run build:analyze`
- [ ] Убедиться, что нет дублирующихся зависимостей
- [ ] Использовать прямые импорты в lazy loading
- [ ] Тяжелые вычисления вынесены в Web Workers
- [ ] Протестировано на медленном соединении (3G throttle)

## Полезные Ресурсы

- [Vite Bundle Optimization Guide](https://vitejs.dev/guide/performance.html)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Tree-Shaking Best Practices](https://webpack.js.org/guides/tree-shaking/)
- [React Code Splitting](https://react.dev/reference/react/lazy)

## Контакты

При возникновении вопросов по оптимизации bundle обращайтесь к команде Frontend.

