# Руководство по скачиванию файлов через API

После загрузки файла в FileManager, клиент может скачать его через следующие API эндпоинты.

## Общие требования

Все эндпоинты требуют JWT токен в заголовке:
```
Authorization: Bearer <your_jwt_token>
```

## Типы файлов и соответствующие эндпоинты

### 1. Config файлы (конфигурации)

**Эндпоинт:**
```
GET /api/files/products/configs/{config_id}/download
```

**Пример использования (JavaScript/TypeScript):**
```typescript
async function downloadConfig(configId: number, token: string): Promise<void> {
  const response = await fetch(
    `/api/files/products/configs/${configId}/download`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download config: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `config_${configId}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

**Пример с axios:**
```typescript
import axios from 'axios';

async function downloadConfig(configId: number, token: string): Promise<Blob> {
  const response = await axios.get(
    `/api/files/products/configs/${configId}/download`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      responseType: 'blob',
    }
  );
  return response.data;
}
```

### 2. Extra файлы (ресурсы)

**Эндпоинт:**
```
GET /api/files/products/extra-files/{file_id}/download
```

**Пример использования:**
```typescript
async function downloadExtraFile(fileId: number, token: string): Promise<void> {
  const response = await fetch(
    `/api/files/products/extra-files/${fileId}/download`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  // Получаем имя файла из заголовка Content-Disposition
  const contentDisposition = response.headers.get('content-disposition');
  let filename = `extra_file_${fileId}`;
  
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

### 3. Product файлы (logo, banner, agent)

**Эндпоинт:**
```
GET /api/files/product-files/{product_id}/download/{file_type}
```

Где `file_type` может быть: `logo`, `banner`, или `agent`

**Пример использования:**
```typescript
async function downloadProductFile(
  productId: number,
  fileType: 'logo' | 'banner' | 'agent',
  token: string
): Promise<void> {
  const response = await fetch(
    `/api/files/product-files/${productId}/download/${fileType}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Определяем расширение файла
  const extension = fileType === 'agent' ? 'exe' : 'png';
  link.download = `${fileType}_${productId}.${extension}`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

## Полный пример: получение списка файлов и скачивание

```typescript
// 1. Получить список файлов продукта
async function getFiles(productId: number, token: string) {
  const response = await fetch(
    `/api/files/product-files?product_id=${productId}&category=all&status=all`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  const data = await response.json();
  return data.files; // Массив FileItem
}

// 2. Скачать файл на основе его типа
async function downloadFile(file: FileItem, token: string): Promise<void> {
  let downloadUrl: string;
  
  if (file.category === 'config') {
    // Извлекаем ID из file.id (формат: "config_123")
    const configId = parseInt(file.id.replace('config_', ''));
    downloadUrl = `/api/files/products/configs/${configId}/download`;
  } else if (file.category === 'resource') {
    // Извлекаем ID из file.id (формат: "extra_123")
    const fileId = parseInt(file.id.replace('extra_', ''));
    downloadUrl = `/api/files/products/extra-files/${fileId}/download`;
  } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'agent') {
    const productId = file.productId;
    if (!productId) {
      throw new Error('Product ID not found');
    }
    downloadUrl = `/api/files/product-files/${productId}/download/${file.category}`;
  } else {
    throw new Error(`Unsupported file type: ${file.category}`);
  }

  const response = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// Использование:
async function example() {
  const token = 'your_jwt_token';
  const productId = 123;
  
  // Получаем список файлов
  const files = await getFiles(productId, token);
  
  // Скачиваем первый файл
  if (files.length > 0) {
    await downloadFile(files[0], token);
  }
}
```

## Использование существующих функций из кодовой базы

В проекте уже есть готовые функции для скачивания в `frontend/src/entities/file/api/download.ts`:

```typescript
import {
  downloadProductConfig,
  downloadProductExtraFile,
  downloadProductFile,
} from '@/entities/file/api/download';

// Скачать config
const blob = await downloadProductConfig(configId);

// Скачать extra файл
const { blob, filename } = await downloadProductExtraFile(fileId);

// Скачать product файл
const blob = await downloadProductFile(productId, 'logo');
```

Эти функции автоматически используют настроенный API клиент с JWT токеном.

## Обработка ошибок

Все эндпоинты могут возвращать следующие ошибки:

- `401 Unauthorized` - неверный или отсутствующий токен
- `403 Forbidden` - нет доступа к файлу
- `404 Not Found` - файл не найден
- `500 Internal Server Error` - ошибка сервера

Пример обработки:

```typescript
try {
  await downloadFile(file, token);
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Требуется авторизация');
  } else if (error.response?.status === 403) {
    console.error('Нет доступа к файлу');
  } else if (error.response?.status === 404) {
    console.error('Файл не найден');
  } else {
    console.error('Ошибка при скачивании:', error);
  }
}
```

