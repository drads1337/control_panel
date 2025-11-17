# Масштабируемость и устойчивость фронтенда

**Оценка: Very Good** ✅

Документ описывает ключевые паттерны и практики для обеспечения масштабируемости и устойчивости фронтенд-приложения.

## Оценка архитектуры

### Масштабируемость

Архитектура хорошо подходит для добавления новых фич. Добавление новой сущности (например, "Команды") будет следовать уже существующему паттерну: создание файлов в entities, хуков use-teams-query, страницы и компонентов.

Использование React.lazy для компонентов (ManagementPage, GameDatabase) и React Router обеспечивает хорошее разделение кода (code splitting), что важно для производительности по мере роста приложения.

### Устойчивость

✅ **query-client.ts настроен великолепно.** Использование экспоненциальной задержки (exponential backoff) для повторных запросов, особенно при 429 ошибках (Rate Limiting), — это best practice для построения отказоустойчивых систем.

✅ **Централизованная обработка ошибок через monitoring.ts** и интеграция с Sentry (с динамическим импортом, чтобы не утяжелять dev-сборку) — это production-ready подход к observability.

✅ **Оптимизация производительности рендеринга больших списков** с помощью виртуализации (@tanstack/react-virtual) в NotificationsDialog.tsx и UsersList.tsx — это продвинутая техника, которая говорит о внимании к деталям и производительности.

---

## Содержание

1. [Масштабируемость](#масштабируемость)
   - [FSD архитектура](#fsd-архитектура)
   - [Code splitting с React.lazy](#code-splitting-с-reactlazy)
   - [Динамическая навигация](#динамическая-навигация)
2. [Устойчивость](#устойчивость)
   - [Централизованная обработка ошибок](#централизованная-обработка-ошибок)
   - [Retry механизм с экспоненциальной задержкой](#retry-механизм-с-экспоненциальной-задержкой)
   - [Глобальная система уведомлений](#глобальная-система-уведомлений)
   - [Устойчивость API-взаимодействий](#устойчивость-api-взаимодействий)
3. [Масштабируемость состояния](#масштабируемость-состояния)
   - [Текущая архитектура состояния](#текущая-архитектура-состояния)
   - [Рекомендации на будущее](#рекомендации-на-будущее)
4. [Виртуализация списков](#виртуализация-списков)

---

## Масштабируемость

### FSD архитектура

**Описание:** Feature-Sliced Design отлично подходит для роста проекта и команды. Архитектура обеспечивает четкое разделение ответственности и легкость масштабирования.

**Структура:**
```
frontend/src/
├── app/           # Инициализация приложения, роутинг, провайдеры
├── pages/         # Композиция фич для пользователя
├── widgets/       # Крупные независимые блоки интерфейса
├── features/      # Бизнес-сущности и действия пользователя
├── entities/      # Бизнес-сущности
├── shared/        # Переиспользуемые модули (UI, utils, api)
└── ...
```

**Преимущества:**
- Легко добавлять новые фичи без конфликтов
- Четкое разделение ответственности между слоями
- Переиспользование компонентов и логики
- Масштабируемость для больших команд

---

### Code splitting с React.lazy

**Описание:** Использование `React.lazy` для динамического импорта компонентов позволяет оптимизировать начальную загрузку приложения и разделить код на чанки.

**Реализация:**

**Файл:** `frontend/src/app/shared/user-layout.tsx`

```typescript
// Lazy load all page components for code splitting
const Dashboard = React.lazy(() => 
  import('@/app/dashboard').then(module => ({ 
    default: module.ProtectedUserDashboard 
  }))
)
const OwnerDashboard = React.lazy(() => 
  import('@/app/dashboard').then(module => ({ 
    default: module.ProtectedOwnerDashboard 
  }))
)
const SmartDashboardRouter = React.lazy(() => 
  import('@/app/dashboard').then(module => ({ 
    default: module.SmartDashboardRouter 
  }))
)
const Projects = React.lazy(() => 
  import('@/app/projects').then(module => ({ 
    default: module.ProjectsPage 
  }))
)
// ... остальные страницы
```

**Использование с Suspense:**

```typescript
<Suspense fallback={<Spinner fullscreen size="lg" message="Loading page..." />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/projects" element={<Projects />} />
    {/* ... */}
  </Routes>
</Suspense>
```

**Преимущества:**
- ✅ Уменьшение начального размера бандла
- ✅ Загрузка страниц по требованию (on-demand)
- ✅ Улучшение времени первой загрузки (First Contentful Paint)
- ✅ Оптимизация для мобильных устройств с медленным интернетом

**Практика:**
Все страницы приложения используют `React.lazy` для динамического импорта. Это хорошая практика, которую стоит расширить на тяжелые компоненты внутри страниц.

**Пример ленивой загрузки тяжелых компонентов:**

**Файл:** `frontend/src/app/dashboard/dashboard-page.tsx`

```typescript
// Lazy load heavy components for better code splitting
const ChartAreaInteractive = React.lazy(() => 
  import('@/app/dashboard/chart-area-interactive').then(module => ({ 
    default: module.ChartAreaInteractive 
  }))
)
const DataTable = React.lazy(() => 
  import('@/app/shared/data-table').then(module => ({ 
    default: module.DataTable 
  }))
)

// Использование
<Suspense fallback={<Spinner />}>
  <ChartAreaInteractive data={data} />
</Suspense>
```

---

### Динамическая навигация

**Описание:** Статическая навигация в `app-sidebar.tsx` является узким местом, но разработчик об этом знает (судя по комментарию).

**Текущая реализация:**

**Файл:** `frontend/src/app/shared/app-sidebar.tsx`

```typescript
/**
 * Function to get navigation items based on user role and permissions
 * 
 * NOTE: This function currently returns static navigation items.
 * 
 * FUTURE REFACTORING: If navigation becomes dynamic (e.g., depends on project settings
 * fetched from the server), consider refactoring to use react-query (@tanstack/react-query)
 * for loading the navigation structure. This would allow:
 * - Caching navigation configuration
 * - Automatic refetching when project settings change
 * - Better error handling and loading states
 * - Centralized navigation management
 * 
 * Example future implementation:
 * ```typescript
 * const { data: navigationConfig } = useQuery({
 *   queryKey: ['navigation', projectId],
 *   queryFn: () => fetchNavigationConfig(projectId),
 *   staleTime: 5 * 60 * 1000, // 5 minutes
 * })
 * ```
 */
const getNavigationItems = (userRole?: string): SidebarItem[] => {
  // Static navigation items...
}
```

**Планируемая динамическая навигация:**

Для будущего рефакторинга рекомендуется использовать `react-query`:

```typescript
import { useQuery } from '@tanstack/react-query'

const useNavigationConfig = (projectId: number) => {
  return useQuery({
    queryKey: ['navigation', projectId],
    queryFn: () => fetchNavigationConfig(projectId),
    staleTime: 5 * 60 * 1000, // 5 минут
    enabled: !!projectId,
  })
}

// Использование в компоненте
const { data: navigationConfig, isLoading } = useNavigationConfig(user.project_id)
```

**Преимущества динамической навигации:**
- Кеширование конфигурации навигации
- Автоматическое обновление при изменении настроек проекта
- Лучшая обработка ошибок и состояний загрузки
- Централизованное управление навигацией
- Возможность A/B тестирования и постепенного раскрытия фич

---

## Устойчивость

### Централизованная обработка ошибок

**Описание:** Централизованная обработка ошибок в axios interceptor обеспечивает единообразное поведение при ошибках во всем приложении.

**Реализация:**

**Файл:** `frontend/src/shared/api/base.ts`

```typescript
// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API Error:', error.response?.status, error.response?.data)
    
    // Handle authentication errors (401, 403)
    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError({
        status: error.response?.status || 401,
        message: error.response?.data?.message || 'Unauthorized access',
        response: error.response?.data
      })
    }
    
    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      const retryAfter = error.response?.headers?.['retry-after']
      // Показываем уведомление через глобальную систему
      import('@/lib/global-notifications').then(({ showGlobalWarning }) => {
        showGlobalWarning(
          'Rate Limit Exceeded',
          'Too many requests. Please wait a moment...',
          8000
        )
      })
    }
    
    // Handle project expiration (402, 410)
    if (error.response?.status === 402 || error.response?.status === 410) {
      import('@/lib/global-notifications').then(({ triggerProjectExpiration }) => {
        triggerProjectExpiration(error.response.status, error.response.data)
      })
    }
    
    // Handle other errors
    if (!isWebhooksEndpoint) {
      // Показываем ошибки через глобальную систему уведомлений
      import('@/lib/global-notifications').then(({ showGlobalError }) => {
        if (status >= 500) {
          showGlobalError('Server Error', `Server error (${status}): ${message}`, 5000)
        } else if (status >= 400) {
          showGlobalError('Request Error', `Request failed (${status}): ${message}`, 5000)
        } else if (!error.response) {
          showGlobalError('Network Error', 'Unable to connect to the server.', 5000)
        }
      })
    }
    
    return Promise.reject(error)
  }
)
```

**Преимущества:**
- ✅ Единая точка обработки ошибок
- ✅ Не нужно дублировать логику в каждом компоненте
- ✅ Автоматическая обработка типичных ошибок
- ✅ Интеграция с глобальной системой уведомлений
- ✅ Логирование для отладки

---

### Retry механизм с экспоненциальной задержкой

**Описание:** `fetchWithRetry` с экспоненциальной задержкой для 429-х ошибок (Rate Limiting) — признак senior-подхода.

**Реализация:**

**Файл:** `frontend/src/shared/api/base.ts`

```typescript
/**
 * Helper function to handle rate limiting with retry using axios
 * Implements exponential backoff with jitter for 429 errors
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries: number = 5
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await api.request({
        url,
        method: (options.method as any) || 'GET',
        data: options.body,
        headers: options.headers as any,
        withCredentials: true,
      })
      
      return new Response(JSON.stringify(response.data), {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers as any),
      })
    } catch (error: any) {
      if (error.response?.status === 429 && attempt < maxRetries - 1) {
        // Rate limited - wait with exponential backoff + jitter
        const baseDelay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s, 8s, 16s
        const jitter = Math.random() * 1000 // Add up to 1s random delay
        const delay = baseDelay + jitter
        
        console.warn(`Rate limited, retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      throw error
    }
  }
  
  throw new Error('Max retries exceeded')
}
```

**Интеграция с React Query:**

**Файл:** `frontend/src/lib/query-client.ts`

```typescript
/**
 * Calculate exponential backoff delay for retries
 * Formula: baseDelay * 2^attempt + jitter
 */
function calculateRetryDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 10000): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 1000 // Add up to 1s random delay to prevent thundering herd
  return Math.min(exponentialDelay + jitter, maxDelay)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Не повторяем для 401/403 ошибок
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false
        }
        // Для 429 ошибок (Rate Limiting) - больше попыток с экспоненциальной задержкой
        if (error?.response?.status === 429) {
          return failureCount < 5 // До 5 попыток для rate limiting
        }
        // Повторяем до 3 раз для других ошибок
        return failureCount < 3
      },
      retryDelay: calculateRetryDelay,
    }
  }
})
```

**Преимущества:**
- ✅ Экспоненциальная задержка предотвращает перегрузку сервера
- ✅ Jitter предотвращает thundering herd problem
- ✅ Автоматический retry для временных ошибок
- ✅ Настраиваемое количество попыток
- ✅ Специальная обработка для rate limiting (429)

**Параметры:**
- **baseDelay:** Базовая задержка (1 секунда)
- **exponentialDelay:** `baseDelay * 2^attempt` (1s, 2s, 4s, 8s, 16s...)
- **jitter:** Случайная задержка до 1 секунды
- **maxDelay:** Максимальная задержка (10 секунд)

---

### Глобальная система уведомлений

**Описание:** Глобальная система уведомлений (global-notifications.ts), которая может быть вызвана из любого места (включая interceptors), — элегантное решение.

**Реализация:**

**Файл:** `frontend/src/lib/global-notifications.ts`

```typescript
/**
 * Global notification system that can be used outside React components
 * This module provides a way to show notifications from non-React code
 * (like axios interceptors) without using window.dispatchEvent
 */

export type NotificationType = 'error' | 'warning' | 'info' | 'success'

export interface NotificationOptions {
  title: string
  message?: string
  type: NotificationType
  duration?: number
}

export interface GlobalNotificationHandler {
  showNotification: (options: NotificationOptions) => void
  showError: (title: string, message?: string, duration?: number) => void
  showWarning: (title: string, message?: string, duration?: number) => void
  showInfo: (title: string, message?: string, duration?: number) => void
  showSuccess: (title: string, message?: string, duration?: number) => void
  triggerProjectExpiration: (status: number, data: any) => void
}

// Global handler reference - will be set by NotificationProvider
let globalNotificationHandler: GlobalNotificationHandler | null = null

/**
 * Set the global notification handler
 * This should be called from NotificationProvider on mount
 */
export function setGlobalNotificationHandler(handler: GlobalNotificationHandler) {
  globalNotificationHandler = handler
}

/**
 * Show a notification using the global handler
 * Falls back to console.error if handler is not set (for development)
 */
export function showGlobalNotification(options: NotificationOptions) {
  if (globalNotificationHandler) {
    globalNotificationHandler.showNotification(options)
  } else {
    console.warn('Global notification handler not set:', options)
  }
}

/**
 * Show an error notification
 */
export function showGlobalError(title: string, message?: string, duration?: number) {
  showGlobalNotification({ title, message, type: 'error', duration })
}

/**
 * Show a warning notification
 */
export function showGlobalWarning(title: string, message?: string, duration?: number) {
  showGlobalNotification({ title, message, type: 'warning', duration })
}
```

**Использование из axios interceptor:**

```typescript
// Динамический импорт для избежания циклических зависимостей
import('@/lib/global-notifications').then(({ showGlobalWarning }) => {
  showGlobalWarning(
    'Rate Limit Exceeded',
    'Too many requests. Please wait a moment...',
    8000
  )
}).catch((err) => {
  console.warn('Failed to import global notifications:', err)
})
```

**Преимущества:**
- ✅ Можно вызывать из любого места (включая interceptors)
- ✅ Нет циклических зависимостей благодаря динамическому импорту
- ✅ Единая точка управления уведомлениями
- ✅ Типобезопасность через TypeScript
- ✅ Fallback для разработки (console.warn)

**Интеграция с NotificationProvider:**

```typescript
// В NotificationProvider при монтировании
useEffect(() => {
  setGlobalNotificationHandler({
    showNotification: (options) => addNotification(options),
    showError: (title, message, duration) => addNotification({ type: 'error', title, message, duration }),
    showWarning: (title, message, duration) => addNotification({ type: 'warning', title, message, duration }),
    showInfo: (title, message, duration) => addNotification({ type: 'info', title, message, duration }),
    showSuccess: (title, message, duration) => addNotification({ type: 'success', title, message, duration }),
    triggerProjectExpiration: (status, data) => handleProjectExpiration(status, data),
  })
  
  return () => {
    clearGlobalNotificationHandler()
  }
}, [])
```

---

### Устойчивость API-взаимодействий

**Описание:** Использование React Query с настроенными `retryDelay` и экспоненциальной задержкой обеспечивает устойчивость к кратковременным сбоям сети или API.

**Реализация:**

**Файл:** `frontend/src/lib/query-client.ts`

```typescript
/**
 * Calculate exponential backoff delay for retries
 * Formula: baseDelay * 2^attempt + jitter
 */
function calculateRetryDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 10000): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 1000 // Add up to 1s random delay to prevent thundering herd
  return Math.min(exponentialDelay + jitter, maxDelay)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Не повторяем для 401/403 ошибок
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false
        }
        // Для 429 ошибок (Rate Limiting) - больше попыток с экспоненциальной задержкой
        if (error?.response?.status === 429) {
          return failureCount < 5 // До 5 попыток для rate limiting
        }
        // Повторяем до 3 раз для других ошибок
        return failureCount < 3
      },
      // Экспоненциальная задержка для retry (особенно для 429 ошибок)
      retryDelay: (attemptIndex, error: any) => {
        // Для 429 ошибок используем экспоненциальную задержку
        if (error?.response?.status === 429) {
          return calculateRetryDelay(attemptIndex, 1000, 10000)
        }
        // Для других ошибок - стандартная задержка
        return Math.min(1000 * Math.pow(2, attemptIndex), 30000)
      },
      // Рефетч при фокусе окна
      refetchOnWindowFocus: false,
      // Рефетч при переподключении
      refetchOnReconnect: true,
    },
    mutations: {
      // Повторные попытки для мутаций с экспоненциальной задержкой для 429
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false
        }
        // Для 429 ошибок - больше попыток
        if (error?.response?.status === 429) {
          return failureCount < 3
        }
        return failureCount < 2
      },
      // Экспоненциальная задержка для мутаций
      retryDelay: (attemptIndex, error: any) => {
        if (error?.response?.status === 429) {
          return calculateRetryDelay(attemptIndex, 1000, 10000)
        }
        return Math.min(1000 * Math.pow(2, attemptIndex), 10000)
      },
    },
  },
})
```

**Преимущества:**
- ✅ Система способна пережить кратковременные сбои сети или API
- ✅ Автоматические повторные попытки с умной задержкой
- ✅ Специальная обработка для rate limiting (429)
- ✅ Jitter предотвращает thundering herd problem
- ✅ Рефетч при восстановлении соединения

**Параметры:**
- **baseDelay:** Базовая задержка 1000ms
- **exponentialDelay:** `baseDelay * 2^attempt` (1s, 2s, 4s, 8s, 16s...)
- **jitter:** Случайная задержка до 1 секунды
- **maxDelay:** Максимальная задержка 10000ms для queries, 10000ms для mutations

---

## Масштабируемость состояния

### Текущая архитектура состояния

**Описание:** Глобальное состояние ограничивается `AuthContext` и `SidebarContext`. Этого достаточно на текущем этапе.

**Реализация:**

**Файл:** `frontend/src/contexts/auth-context.tsx`

```typescript
interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, referralCode?: string) => Promise<void>
  logout: () => void
  clearError: () => void
  updateUser: (userData: any) => void
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  // Мемоизируем значение контекста для предотвращения лишних перерисовок
  const contextValue = useMemo(() => ({
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    // ... остальные свойства
  }), [
    auth.user,
    auth.token,
    auth.isAuthenticated,
    // ... остальные зависимости
  ])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}
```

**Файл:** `frontend/src/contexts/sidebar-context.tsx`

```typescript
interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  // ...
}
```

**Преимущества текущего подхода:**
- ✅ Минимальное глобальное состояние
- ✅ Четкое разделение ответственности
- ✅ Мемоизация контекста предотвращает лишние перерисовки
- ✅ Достаточно для текущего размера проекта

### Рекомендации на будущее

**Проблема prop drilling:**

При росте проекта может возникнуть потребность в обмене состоянием между несвязанными компонентами. Например:
- Фильтры в одном месте влияют на данные в другом
- Состояние формы нужно использовать в нескольких несвязанных компонентах
- Настройки пользователя должны быть доступны в разных частях приложения

**Рекомендация:** На данном этапе ничего менять не нужно. Но стоит держать в уме возможность внедрения легковесного state manager'а, если prop drilling станет проблемой.

**Варианты решения:**

1. **Zustand** - легковесный state manager (~1KB)
   ```typescript
   import create from 'zustand'
   
   interface FilterStore {
     filters: Record<string, any>
     setFilter: (key: string, value: any) => void
     clearFilters: () => void
   }
   
   export const useFilterStore = create<FilterStore>((set) => ({
     filters: {},
     setFilter: (key, value) => set((state) => ({
       filters: { ...state.filters, [key]: value }
     })),
     clearFilters: () => set({ filters: {} }),
   }))
   ```

2. **Jotai** - атомарный state manager
   ```typescript
   import { atom, useAtom } from 'jotai'
   
   const filtersAtom = atom<Record<string, any>>({})
   
   export const useFilters = () => useAtom(filtersAtom)
   ```

**Признаки необходимости в state manager:**
- Prop drilling через 3+ уровня компонентов
- Множественные контексты для одного типа данных
- Сложность отслеживания источника изменений состояния
- Частые проблемы с лишними перерисовками из-за контекста

**Когда НЕ нужен state manager:**
- Текущая архитектура с AuthContext и SidebarContext работает хорошо
- Состояние используется локально в компонентах или передается через props
- React Query покрывает большую часть состояния (серверные данные)

---

## Виртуализация списков

### Описание

В `NotificationsDialog.tsx` и `users-list.tsx` используется `@tanstack/react-virtual` для виртуализации списков. Это обеспечивает высокую производительность даже при отображении тысяч элементов.

### Реализация

**Файл:** `frontend/src/app/management/notifications/NotificationsDialog.tsx`

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const NotificationsDialog: React.FC<NotificationsDialogProps> = ({ ... }) => {
  // Virtualization setup - only enable if we have many notifications
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = notifications.length > 30; // Only virtualize if more than 30 items
  
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? notifications.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128, // Estimated notification card height in pixels (including gap)
    overscan: 3, // Render 3 extra items outside visible area
    enabled: shouldVirtualize,
  });

  return (
    <div 
      ref={parentRef}
      className="max-h-80 overflow-y-auto pr-2"
      style={shouldVirtualize ? { contain: 'strict' } : {}}
    >
      {shouldVirtualize ? (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const notification = notifications[virtualRow.index];
            return (
              <div
                key={notification.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors mb-2"
              >
                {/* Notification content */}
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback to regular rendering for small lists
        <div className="space-y-2">
          {notifications.map((notification) => (
            // Regular rendering
          ))}
        </div>
      )}
    </div>
  );
};
```

**Файл:** `frontend/src/app/users/users-list.tsx`

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const UsersList: React.FC<UsersListProps> = ({ users, ... }) => {
  // Virtualization setup - only enable if we have many users
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = users.length > 50; // Only virtualize if more than 50 items
  
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? users.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items outside visible area
    enabled: shouldVirtualize,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: '600px', contain: 'strict' }}
    >
      {shouldVirtualize ? (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <Table>
            <TableBody>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const user = users[virtualRow.index];
                return (
                  <TableRow
                    key={user.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* User row content */}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        // Fallback to regular rendering for small lists
        <Table>
          <TableBody>
            {users.map((user) => (
              // Regular rendering
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
```

**Преимущества:**
- ✅ Высокая производительность даже при тысячах элементов
- ✅ Рендерится только видимая часть списка + overscan
- ✅ Автоматическое определение необходимости виртуализации
- ✅ Graceful fallback для небольших списков
- ✅ Оптимизация памяти и CPU

**Параметры:**
- **estimateSize:** Предполагаемая высота элемента (128px для уведомлений, 73px для пользователей)
- **overscan:** Количество элементов, рендерящихся вне видимой области (3-5)
- **shouldVirtualize:** Условная виртуализация только для больших списков (>30 для уведомлений, >50 для пользователей)

**Когда использовать виртуализацию:**
- ✅ Списки с >30-50 элементами
- ✅ Элементы имеют фиксированную или предсказуемую высоту
- ✅ Частая прокрутка списка
- ✅ Важна производительность

**Когда НЕ использовать виртуализацию:**
- ❌ Списки с <30 элементами
- ❌ Элементы с динамической высотой, которую сложно оценить
- ❌ Списки, которые всегда помещаются на экране
- ❌ Когда простота кода важнее производительности

---

## Рекомендации

### 1. Расширение использования React.lazy

Все страницы уже используют `React.lazy`. Рекомендуется также использовать для:
- Тяжелых компонентов (графики, таблицы, редакторы)
- Компонентов, которые загружаются условно
- Модальных окон и диалогов
- Внешних библиотек (если они большие)

### 2. Мониторинг производительности

- Используйте React DevTools Profiler для анализа производительности
- Мониторьте размер бандла с помощью `vite-bundle-visualizer`
- Отслеживайте время загрузки страниц

### 3. Оптимизация изображений

- Используйте lazy loading для изображений
- Оптимизируйте изображения (WebP, сжатие)
- Используйте CDN для статических ресурсов

### 4. Кеширование данных

- Используйте React Query для кеширования API запросов
- Настройте `staleTime` в зависимости от типа данных
- Используйте `cacheTime` для управления временем жизни кеша

---

## Заключение

Фронтенд-приложение использует современные практики для обеспечения масштабируемости и устойчивости:

### Устойчивость

✅ **React Query с экспоненциальной задержкой** - устойчивость к кратковременным сбоям сети или API  
✅ **Retry механизм с retryDelay** - автоматические повторные попытки с умной задержкой  
✅ **Централизованная обработка ошибок** - единообразное поведение при ошибках  
✅ **Глобальная система уведомлений** - элегантное решение для cross-cutting concerns  
✅ **Рефетч при восстановлении соединения** - автоматическое обновление данных

### Масштабируемость

✅ **FSD архитектура** - четкое разделение ответственности  
✅ **React.lazy** - code splitting для всех страниц  
✅ **Виртуализация списков** - высокая производительность даже при тысячах элементов  
✅ **Минимальное глобальное состояние** - AuthContext и SidebarContext достаточно на текущем этапе  
✅ **Готовность к расширению** - рекомендации по внедрению Zustand/Jotai при необходимости

### Производительность

✅ **Виртуализация с @tanstack/react-virtual** - отличная работа в NotificationsDialog.tsx и users-list.tsx  
✅ **Условная виртуализация** - автоматическое определение необходимости  
✅ **Graceful fallback** - обычный рендеринг для небольших списков  
✅ **Оптимизация памяти и CPU** - рендерится только видимая часть + overscan

Эти практики обеспечивают хорошую основу для масштабирования проекта и команды. Особенно стоит отметить:

- **Устойчивость API-взаимодействий:** Система способна пережить кратковременные сбои сети или API благодаря React Query с настроенными retryDelay и экспоненциальной задержкой.

- **Масштабируемость состояния:** Текущее ограничение глобального состояния AuthContext и SidebarContext достаточно. При росте проекта можно рассмотреть легковесный state manager (Zustand или Jotai), если prop drilling станет проблемой.

- **Виртуализация списков:** Использование @tanstack/react-virtual в NotificationsDialog.tsx и users-list.tsx — очень дальновидное решение, которое обеспечит высокую производительность даже при отображении тысяч уведомлений или пользователей.

