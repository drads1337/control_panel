import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface KeyVisibilityToggleProps {
  keyId: number;
  isVisible: boolean;
  onToggle: (keyId: number) => void;
}

export const KeyVisibilityToggle: React.FC<KeyVisibilityToggleProps> = React.memo(({
  keyId,
  isVisible,
  onToggle,
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(keyId)}
      title={isVisible ? 'Hide key' : 'Show key'}
    >
      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
});

KeyVisibilityToggle.displayName = 'KeyVisibilityToggle';

