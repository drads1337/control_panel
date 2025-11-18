import { useState, useEffect, useCallback } from 'react';
import { useSettingsQuery } from './use-settings-query';

export interface CustomColor {
  primary: string;
  primaryHover: string;
  primaryLight: string;
}

const DEFAULT_COLOR: CustomColor = {
  primary: '#134e4a',
  primaryHover: '#0f3d3a',
  primaryLight: '#1a6b65'
};

export const useCustomColor = () => {
  const { settings, saveSettings } = useSettingsQuery();

  const generateColorVariants = useCallback((primaryColor: string) => {

    const darkenColor = (color: string, amount: number) => {
      const hex = color.replace('#', '');
      const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
      const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
      const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    const lightenColor = (color: string, amount: number) => {
      const hex = color.replace('#', '');
      const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
      const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
      const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    return {
      primary: primaryColor,
      primaryHover: darkenColor(primaryColor, 30),
      primaryLight: lightenColor(primaryColor, 30)
    };
  }, []);

  const getColorFromSettings = useCallback((): CustomColor => {
    if (settings?.appearance?.primaryColor) {
      return generateColorVariants(settings.appearance.primaryColor);
    }
    return DEFAULT_COLOR;
  }, [settings, generateColorVariants]);

  const [customColor, setCustomColor] = useState<CustomColor>(DEFAULT_COLOR);

  useEffect(() => {
    const colorFromSettings = getColorFromSettings();
    setCustomColor(colorFromSettings);
  }, [getColorFromSettings]);

  const setPrimaryColor = useCallback(async (color: string) => {
    const variants = generateColorVariants(color);
    setCustomColor(variants);

    try {
      await saveSettings({
        appearance: {
          primaryColor: color
        }
      });
    } catch (error) {

    }
  }, [generateColorVariants, saveSettings]);

  const resetToDefault = useCallback(async () => {
    setCustomColor(DEFAULT_COLOR);

    try {
      await saveSettings({
        appearance: {
          primaryColor: DEFAULT_COLOR.primary
        }
      });
    } catch (error) {

    }

    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--sidebar-primary');
    root.style.removeProperty('--sidebar-ring');
    root.style.removeProperty('--chart-1');
    root.style.removeProperty('--chart-2');
    root.style.removeProperty('--chart-3');
    root.style.removeProperty('--chart-4');
    root.style.removeProperty('--chart-5');
  }, [saveSettings]);

  const applyCustomColors = useCallback(() => {
    const root = document.documentElement;

    root.style.setProperty('--primary', customColor.primary);
    root.style.setProperty('--ring', customColor.primary);
    root.style.setProperty('--sidebar-primary', customColor.primary);
    root.style.setProperty('--sidebar-ring', customColor.primary);
    root.style.setProperty('--chart-1', customColor.primary);
    root.style.setProperty('--chart-2', customColor.primaryHover);
    root.style.setProperty('--chart-3', customColor.primaryLight);
    root.style.setProperty('--chart-4', customColor.primary);
    root.style.setProperty('--chart-5', customColor.primaryHover);
  }, [customColor]);

  useEffect(() => {
    applyCustomColors();
  }, [applyCustomColors]);

  return {
    customColor,
    setPrimaryColor,
    resetToDefault,
    applyCustomColors
  };
}; 