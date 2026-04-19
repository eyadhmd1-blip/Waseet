// ============================================================
// ThemeContext — App-wide theme state
//
// Provides: colors, theme, isDark, setTheme
// Persists choice to AsyncStorage under key 'waseet_theme'.
// 'system' follows the device Appearance setting live.
//
// Usage:
//   const { colors, theme, isDark, setTheme } = useTheme();
// ============================================================

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type AppColors } from '../constants/colors';

export type ThemeName = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'waseet_theme';

type ThemeCtx = {
  colors:   AppColors;
  theme:    ThemeName;
  isDark:   boolean;
  setTheme: (t: ThemeName) => Promise<void>;
};

const ThemeContext = createContext<ThemeCtx>({
  colors:   darkColors,
  theme:    'dark',
  isDark:   true,
  setTheme: async () => {},
});

function resolveColors(theme: ThemeName, system: ColorSchemeName): AppColors {
  const effective = theme === 'system' ? (system ?? 'dark') : theme;
  return effective === 'light' ? lightColors : darkColors;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,   setThemeState] = useState<ThemeName>('dark');
  const [system,  setSystem]     = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeState(saved);
      }
    });
  }, []);

  // Follow device changes when set to 'system'
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setTheme = useCallback(async (t: ThemeName) => {
    setThemeState(t);
    await AsyncStorage.setItem(STORAGE_KEY, t);
  }, []);

  const colors = resolveColors(theme, system);
  const isDark = colors === darkColors;

  return (
    <ThemeContext.Provider value={{ colors, theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext);
}
