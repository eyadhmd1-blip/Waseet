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
  // Synchronous initialiser: avoids a flash of wrong theme before AsyncStorage loads.
  // The value here is only a temporary default; the useEffect below overwrites it
  // immediately with whatever is persisted (or saves it if this is first launch).
  const [theme,  setThemeState] = useState<ThemeName>(() => {
    const sys = Appearance.getColorScheme();
    return sys === 'light' ? 'light' : 'dark';
  });
  const [system, setSystem]     = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Load persisted preference on mount.
  // First launch: no saved value → persist the system-detected default from above.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeState(saved);
      } else {
        // First launch — save the system-detected value so manual overrides are
        // never silently reset by a future system-theme change.
        const sys = Appearance.getColorScheme();
        const initial: ThemeName = sys === 'light' ? 'light' : 'dark';
        setThemeState(initial);
        AsyncStorage.setItem(STORAGE_KEY, initial);
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
