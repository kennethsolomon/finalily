"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { type ThemeId, DEFAULT_THEME } from "@/lib/themes";
import { updateProfile } from "@/actions/profile";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeToDOM(theme: ThemeId) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeId;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeId>(
    initialTheme ?? DEFAULT_THEME
  );

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const setTheme = useCallback(
    (newTheme: ThemeId) => {
      setThemeState(newTheme);
      applyThemeToDOM(newTheme);
      updateProfile({ preferences: { theme: newTheme } }).catch(() => {
        // Revert on save failure
        setThemeState(theme);
        applyThemeToDOM(theme);
      });
    },
    [theme]
  );

  return (
    <ThemeContext value={{ theme, setTheme }}>
      {children}
    </ThemeContext>
  );
}
