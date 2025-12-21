import React from 'react';
import { 
  Rocket, 
  Puzzle, 
  Code, 
  Plus, 
  Search, 
  Folder, 
  FileText, 
  Lock, 
  Info, 
  RefreshCw, 
  Upload, 
  LayoutGrid 
} from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', filled = false }) => {
  const iconProps = { className };
  
  switch (name) {
    case 'rocket_launch':
      return <Rocket {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    case 'extension':
      return <Puzzle {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    case 'code':
      return <Code {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    case 'add':
      return <Plus {...iconProps} />;
    case 'search':
      return <Search {...iconProps} />;
    case 'folder':
      return <Folder {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    case 'description':
      return <FileText {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    case 'lock':
      return <Lock {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    case 'info':
      return <Info {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    case 'refresh':
      return <RefreshCw {...iconProps} />;
    case 'upload':
      return <Upload {...iconProps} />;
    case 'grid_view':
      return <LayoutGrid {...iconProps} fill={filled ? 'currentColor' : 'none'} />;
    default:
      return null;
  }
};

