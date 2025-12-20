# State Management Architecture

## Обзор

Проект использует многоуровневый подход к управлению состоянием, где каждый инструмент решает конкретную задачу.

## Принципы

1. **Server State** → React Query (`@tanstack/react-query`)
2. **UI State (Dialogs, Tabs)** → Zustand
3. **Global App State (Auth, Permissions)** → Context API
4. **Local Component State** → `useState` / `useReducer`

## Детальное описание

### 1. Server State Management (React Query)

**Использование:** Все данные, приходящие с сервера (API, WebSocket)

**Паттерны:**
- Фабрики ключей (`queryKeyFactory`) в `entities/*/model/queries.ts`
- Оптимистичные обновления через `onMutate`
- Автоматическая инвалидация кэша
- Retry логика с обработкой ошибок

**Пример:**
```typescript
// entities/task/model/queries.ts
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: () => [...taskKeys.lists()] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
}
```

**Расположение:**
- Query hooks: `entities/*/model/queries.ts`
- API calls: `entities/*/api/*.ts`
- Shared hooks: `shared/hooks/use-*.ts`

### 2. UI State Management (Zustand)

**Использование:** Локальное состояние UI компонентов (диалоги, табы, модальные окна)

**Текущие stores:**
- `useProductDialogStore` - управление диалогами продуктов
- `useAgentDialogStore` - управление диалогами агентов
- `useManagementStore` - управление табами в management page

**Паттерны:**
- Использование `immer` для иммутабельных обновлений
- Разделение State и Actions через TypeScript interfaces
- Минималистичный подход - только для UI состояния

**Расположение:** `shared/model/use-*-store.ts`

**Когда использовать Zustand:**
- ✅ Состояние диалогов/модальных окон
- ✅ Состояние табов/аккордеонов
- ✅ Локальное UI состояние, которое нужно в нескольких компонентах
- ❌ НЕ использовать для server state
- ❌ НЕ использовать для глобального app state (используйте Context API)

### 3. Global App State (Context API)

**Использование:** Глобальное состояние приложения, доступное через провайдеры

**Текущие провайдеры:**
- `AuthProvider` - аутентификация и пользователь
- `SidebarProvider` - состояние сайдбара
- `SecurityPermissionsProvider` - права доступа
- `WebhookPermissionsProvider` - права для webhooks
- `NotificationProvider` - уведомления

**Паттерны:**
- Провайдеры оборачивают приложение в `AppProviders.tsx`
- Хуки для доступа: `useAuth()`, `useSidebar()`, и т.д.
- Мемоизация через `useMemo` для оптимизации

**Расположение:** `app/providers/*-provider.tsx`

**Когда использовать Context API:**
- ✅ Глобальное состояние приложения (auth, permissions)
- ✅ Состояние, которое нужно в провайдерах
- ✅ Состояние, которое редко меняется
- ❌ НЕ использовать для часто меняющегося состояния (performance)

### 4. Local Component State

**Использование:** Состояние, которое живет только внутри одного компонента

**Паттерны:**
- `useState` для простого состояния
- `useReducer` для сложной логики
- Custom hooks для переиспользуемой логики

**Когда использовать:**
- ✅ Состояние формы
- ✅ Локальные UI флаги (isOpen, isLoading)
- ✅ Временное состояние компонента

## Миграция и рефакторинг

### Удалено
- ❌ **Jotai** - был установлен, но не использовался (удален из зависимостей)

### Рекомендации

1. **Не смешивать стейт-менеджеры для одной задачи**
   - Если данные приходят с сервера → React Query
   - Если это UI состояние → Zustand или useState
   - Если это глобальное app state → Context API

2. **Избегать coupling между слоями**
   - API вызовы должны быть в `entities/*/api/`
   - Хуки в `shared/hooks/` не должны напрямую импортировать API endpoints
   - Использовать абстракции через entities

3. **Минимизировать количество Zustand stores**
   - Объединять связанное UI состояние в один store
   - Избегать создания store для каждого диалога

## Примеры правильного использования

### ✅ Правильно: Server State через React Query
```typescript
// entities/task/api/task.ts
export async function getTasks(): Promise<Task[]> {
  return apiCall(() => api.get('/api/tasks'))
}

// shared/hooks/use-tasks.ts
export function useTasks() {
  const { data } = useQuery({
    queryKey: taskKeys.list(),
    queryFn: getTasks, // Импорт из entities
  })
  return { tasks: data || [] }
}
```

### ✅ Правильно: UI State через Zustand
```typescript
// shared/model/use-product-dialog-store.ts
export const useProductDialogStore = create((set) => ({
  viewProductDialogOpen: false,
  openViewProductDialog: (product) => set({ 
    viewProductDialogOpen: true, 
    selectedProduct: product 
  }),
}))
```

### ✅ Правильно: Global State через Context API
```typescript
// app/providers/auth-provider.tsx
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

## Чеклист для новых фич

- [ ] Server data? → Использовать React Query в `entities/*/model/queries.ts`
- [ ] UI state (dialogs/tabs)? → Использовать Zustand в `shared/model/`
- [ ] Global app state? → Использовать Context API в `app/providers/`
- [ ] Local component state? → Использовать `useState` в компоненте
- [ ] Проверить, что нет дублирования логики
- [ ] Убедиться, что API вызовы в правильном слое (`entities/*/api/`)