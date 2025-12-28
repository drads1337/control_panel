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
    // АДАПТАЦИЯ: space-y-3 для мобильных, space-y-2.5 для ПК
    <div className="space-y-3 sm:space-y-2.5">
      {/* Preset Colors */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => handlePresetColorClick(color.value)}
            // АДАПТАЦИЯ: w-8 h-8 для мобильных (удобнее нажимать), w-7 h-7 для ПК (как было)
            className={`
              relative w-8 h-8 sm:w-7 sm:h-7 rounded border transition-all
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
          // АДАПТАЦИЯ: w-10 h-9 для мобильных, w-9 h-8 для ПК
          className="w-10 h-9 sm:w-9 sm:h-8 p-0.5 border border-border/50 rounded-md cursor-pointer shrink-0"
        />
        <Input
          type="text"
          value={customColorInput}
          onChange={handleCustomColorChange}
          placeholder="#134e4a"
          // АДАПТАЦИЯ: h-9 text-sm для мобильных (читаемость), h-8 text-xs для ПК
          className="flex-1 h-9 sm:h-8 text-sm sm:text-xs"
        />
        <Button
          variant="ghost"
          onClick={handleReset}
          size="sm"
          // АДАПТАЦИЯ: h-9 для мобильных, h-8 для ПК
          className="h-9 sm:h-8 px-2 shrink-0"
        >
          <RotateCcw className="h-4 w-4 sm:h-3 sm:w-3" />
        </Button>
      </div>
    </div>
  );
};