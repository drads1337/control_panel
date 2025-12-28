# DataTable Component

Универсальный компонент таблицы данных с поддержкой виртуализации, адаптивного дизайна и кастомизации.

## Особенности

- ✅ **Виртуализация** - автоматическая виртуализация для больших списков (>30 элементов по умолчанию)
- ✅ **Адаптивный дизайн** - поддержка мобильного и десктопного представления
- ✅ **Типизация** - полная поддержка TypeScript с generics
- ✅ **Кастомизация** - гибкая настройка колонок, стилей и поведения
- ✅ **Состояния** - встроенная поддержка загрузки, ошибок и пустого состояния

## Базовое использование

```tsx
import { DataTable, type Column } from '@/components/ui/data-table'

interface User {
  id: number
  name: string
  email: string
  role: string
}

const columns: Column<User>[] = [
  {
    id: 'name',
    header: 'Name',
    accessor: 'name',
  },
  {
    id: 'email',
    header: 'Email',
    accessor: 'email',
  },
  {
    id: 'role',
    header: 'Role',
    cell: (row) => <Badge>{row.role}</Badge>,
  },
]

function UsersTable({ users }: { users: User[] }) {
  return (
    <DataTable
      data={users}
      columns={columns}
      loading={isLoading}
      onRowClick={(user) => console.log('Clicked:', user)}
    />
  )
}
```

## Продвинутое использование

### С виртуализацией

```tsx
<DataTable
  data={largeDataset}
  columns={columns}
  virtualized={true}
  virtualizationThreshold={50}
  estimatedRowHeight={80}
  containerHeight="700px"
/>
```

### Мобильное представление

```tsx
<DataTable
  data={users}
  columns={columns}
  mobileView={isMobile}
  renderMobileCard={(user, index) => (
    <Card>
      <CardContent>
        <h3>{user.name}</h3>
        <p>{user.email}</p>
      </CardContent>
    </Card>
  )}
/>
```

### Кастомные колонки

```tsx
const columns: Column<User>[] = [
  {
    id: 'avatar',
    header: '',
    cell: (user) => (
      <Avatar>
        <AvatarImage src={user.avatar} />
        <AvatarFallback>{user.name[0]}</AvatarFallback>
      </Avatar>
    ),
    width: 50,
  },
  {
    id: 'name',
    header: 'Name',
    accessor: (user) => (
      <div>
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
      </div>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: (user) => (
      <DropdownMenu>
        <DropdownMenuTrigger>...</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleEdit(user)}>
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    className: 'w-12',
  },
]
```

### Состояния

```tsx
<DataTable
  data={users}
  columns={columns}
  loading={isLoading}
  error={error}
  emptyMessage="No users found"
  emptyIcon={Users}
/>
```

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | **required** | Массив данных для отображения |
| `columns` | `Column<T>[]` | **required** | Конфигурация колонок |
| `loading` | `boolean` | `false` | Показывать состояние загрузки |
| `error` | `string \| null` | `null` | Сообщение об ошибке |
| `emptyMessage` | `string` | `'No data available'` | Сообщение при пустом списке |
| `emptyIcon` | `React.ComponentType` | - | Иконка для пустого состояния |
| `getRowId` | `(row: T, index: number) => string \| number` | `(row, index) => row.id ?? index` | Функция получения ID строки |
| `onRowClick` | `(row: T) => void` | - | Обработчик клика по строке |
| `virtualized` | `boolean` | `auto` | Принудительно включить/выключить виртуализацию |
| `virtualizationThreshold` | `number` | `30` | Порог для автоматической виртуализации |
| `estimatedRowHeight` | `number` | `65` | Оценочная высота строки для виртуализации |
| `containerHeight` | `string \| number` | `'600px'` | Высота контейнера при виртуализации |
| `mobileView` | `boolean` | `false` | Включить мобильное представление |
| `renderMobileCard` | `(row: T, index: number) => ReactNode` | - | Функция рендера карточки для мобильного |
| `className` | `string` | `''` | Дополнительные классы для таблицы |
| `headerClassName` | `string` | `''` | Дополнительные классы для заголовка |
| `rowClassName` | `string \| ((row: T) => string)` | `''` | Классы для строк (может быть функцией) |
| `showHeader` | `boolean` | `true` | Показывать заголовок таблицы |

### Column

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Уникальный идентификатор колонки |
| `header` | `string \| ReactNode` | Заголовок колонки |
| `accessor` | `keyof T \| ((row: T) => ReactNode)` | Ключ объекта или функция для получения значения |
| `cell` | `(row: T) => ReactNode` | Кастомная функция рендера ячейки |
| `className` | `string` | Классы для ячеек колонки |
| `headerClassName` | `string` | Классы для заголовка колонки |
| `width` | `string \| number` | Ширина колонки |
| `minWidth` | `string \| number` | Минимальная ширина колонки |

## Миграция существующих таблиц

### До:
```tsx
// users-list.tsx - 400+ строк с дублированием логики
const UsersList = ({ users, loading, ... }) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = users.length > 30
  const rowVirtualizer = useVirtualizer({ ... })
  // ... много кода
}
```

### После:
```tsx
// users-table.tsx - ~50 строк
const UsersTable = ({ users, loading, ... }) => {
  const columns: Column<User>[] = [
    { id: 'name', header: 'Name', accessor: 'name' },
    { id: 'email', header: 'Email', accessor: 'email' },
    // ...
  ]
  
  return (
    <DataTable
      data={users}
      columns={columns}
      loading={loading}
    />
  )
}
```

## Производительность

- Виртуализация автоматически включается при >30 элементах
- Использует `@tanstack/react-virtual` для эффективного рендеринга
- Мемоизация колонок и данных рекомендуется для больших списков

## Примеры использования в проекте

- `UsersList` → можно заменить на `DataTable<User>`
- `WebhookTable` → можно заменить на `DataTable<WebhookData>`
- `LicenseKeysList` → можно заменить на `DataTable<LicenseKey>`
