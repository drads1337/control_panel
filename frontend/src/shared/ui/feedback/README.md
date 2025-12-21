# Универсальные компоненты состояний

Эта папка содержит универсальные компоненты для отображения различных состояний приложения с единым стилем.

## Компоненты

### StatusCard
Базовый компонент для отображения состояний (ошибки, загрузки, доступ запрещен и т.д.).

### AccessDenied
Компонент для отображения страницы "Доступ запрещен".

**Пример использования:**
```tsx
import { AccessDenied } from "@/shared/ui/feedback"

<AccessDenied 
  message="You don't have permission to access this resource."
  showBackButton={true}
  showHomeButton={true}
/>
```

### ErrorState
Компонент для отображения состояния ошибки.

**Пример использования:**
```tsx
import { ErrorState } from "@/shared/ui/feedback"

<ErrorState
  title="Something went wrong"
  message="An error occurred while loading data."
  onRetry={() => refetch()}
  showRetryButton={true}
  showReloadButton={true}
/>
```

### LoadingState
Компонент для отображения состояния загрузки.

**Пример использования:**
```tsx
import { LoadingState } from "@/shared/ui/feedback"

<LoadingState
  message="Loading data..."
  description="Please wait"
  fullscreen={false}
/>
```

### NotFound
Компонент для отображения страницы 404.

**Пример использования:**
```tsx
import { NotFound } from "@/shared/ui/feedback"

<NotFound
  title="Page Not Found"
  description="The page you're looking for doesn't exist."
/>
```

### RouteGuard
Универсальный компонент для защиты маршрутов с проверкой прав доступа.

**Пример использования:**
```tsx
import { RouteGuard, AdminRouteGuard } from "@/shared/ui/feedback"

// С проверкой разрешения
<RouteGuard permission="users.view">
  <UsersPage />
</RouteGuard>

// С проверкой ролей
<RouteGuard roles={["admin", "owner"]} requireAnyRole={true}>
  <AdminPanel />
</RouteGuard>

// С показом Access Denied вместо редиректа
<RouteGuard 
  permission="logs.view"
  showAccessDenied={true}
  accessDeniedMessage="You need logs.view permission"
>
  <LogsPage />
</RouteGuard>

// Упрощенный guard для админов
<AdminRouteGuard>
  <AdminPage />
</AdminRouteGuard>
```

## Обновление ErrorBoundary

ErrorBoundary теперь использует единый стиль через ErrorState:

```tsx
import { PageErrorBoundary } from "@/widgets/page-error-boundary"

<PageErrorBoundary pageName="Dashboard">
  <DashboardPage />
</PageErrorBoundary>
```

## Преимущества

1. **Единый стиль** - все страницы состояний выглядят одинаково
2. **Переиспользуемость** - один компонент для всех случаев
3. **Гибкость** - множество опций для кастомизации
4. **Типобезопасность** - полная поддержка TypeScript
5. **Адаптивность** - работает на всех размерах экранов
