import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw } from 'lucide-react';
import { useCustomColor } from '@/hooks/use-custom-color';

const PRESET_COLORS = [
  { name: 'Green', value: '#134e4a' },
  { name: 'Blue', value: '#1e40af' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Indigo', value: '#4338ca' },
];

export const ColorPicker = () => {
  const { customColor, setPrimaryColor, resetToDefault } = useCustomColor();
  const [customColorInput, setCustomColorInput] = useState(customColor.primary);

  // Обновляем input при изменении цвета из настроек
  useEffect(() => {
    setCustomColorInput(customColor.primary);
  }, [customColor.primary]);

  const handlePresetColorClick = async (color: string) => {
    setCustomColorInput(color);
    await setPrimaryColor(color);
  };

  const handleCustomColorChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColorInput(color);
    if (color.match(/^#[0-9A-F]{6}$/i)) {
      await setPrimaryColor(color);
    }
  };

  const handleReset = async () => {
    setCustomColorInput('#134e4a');
    await resetToDefault();
  };

  return (
    <div className="space-y-2.5">
      {/* Preset Colors */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => handlePresetColorClick(color.value)}
            className={`
              relative w-7 h-7 rounded border transition-all
              ${customColor.primary === color.value 
                ? 'border-foreground ring-1 ring-foreground/20' 
                : 'border-border/50 hover:border-foreground/50'
              }
            `}
            style={{ backgroundColor: color.value }}
            title={color.name}
          >
            {customColor.primary === color.value && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Custom Color Input */}
      <div className="flex items-center gap-2">
        <Input
          id="custom-color"
          type="color"
          value={customColorInput}
          onChange={handleCustomColorChange}
          className="w-9 h-8 p-0.5 border border-border/50 rounded-md cursor-pointer"
        />
        <Input
          type="text"
          value={customColorInput}
          onChange={handleCustomColorChange}
          placeholder="#134e4a"
          className="flex-1 h-8 text-xs"
        />
        <Button
          variant="ghost"
          onClick={handleReset}
          size="sm"
          className="h-8 px-2"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};