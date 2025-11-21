import React from 'react';
import { KeyVisibilityToggle } from './KeyVisibilityToggle';

interface KeyDisplayProps {
  keyId: number;
  keyValue: string;
  isVisible: boolean;
  onToggleVisibility: (keyId: number) => void;
}

export const KeyDisplay: React.FC<KeyDisplayProps> = React.memo(({
  keyId,
  keyValue,
  isVisible,
  onToggleVisibility,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
        {isVisible ? keyValue : '••••••••••••••••'}
      </code>
      <KeyVisibilityToggle
        keyId={keyId}
        isVisible={isVisible}
        onToggle={onToggleVisibility}
      />
    </div>
  );
});

KeyDisplay.displayName = 'KeyDisplay';

