import React from 'react';
import { 
  Folder, File, FileText, Image, Video, Music, 
  Package, Zap
} from 'lucide-react';

/**
 * Утилитарные функции для работы с файлами
 */

/**
 * Получает иконку для файла на основе его расширения или типа
 */
export function getFileIcon(fileName: string, fileType?: string): React.ReactNode {
  if (fileType === 'folder') {
    return <Folder className="h-4 w-4 text-blue-500" />;
  }
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'txt':
    case 'md':
    case 'log':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    
    case 'exe':
    case 'dll':
    case 'so':
    case 'dylib':
      return <Zap className="h-4 w-4 text-primary" />;
    
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return <Package className="h-4 w-4 text-orange-500" />;
    
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
    case 'ico':
      return <Image className="h-4 w-4 text-green-500" />;
    
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
      return <Video className="h-4 w-4 text-purple-500" />;
    
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'aac':
      return <Music className="h-4 w-4 text-blue-500" />;
    
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-500" />;
    
    case 'doc':
    case 'docx':
      return <FileText className="h-4 w-4 text-blue-600" />;
    
    case 'xls':
    case 'xlsx':
      return <FileText className="h-4 w-4 text-green-600" />;
    
    case 'ppt':
    case 'pptx':
      return <FileText className="h-4 w-4 text-orange-600" />;
    
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Форматирует размер файла в читаемый вид
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
