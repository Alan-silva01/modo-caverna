import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  modoCaverna: boolean;
  toggleModoCaverna: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  });

  const [modoCaverna, setModoCaverna] = useState(() => {
    return localStorage.getItem('modo-caverna') === 'true';
  });

  // Apply classes based on theme/modoCaverna
  useEffect(() => {
    const root = document.documentElement;
    // Modo Caverna forces dark mode
    const activeDark = theme === 'dark' || modoCaverna;

    if (activeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    localStorage.setItem('modo-caverna', String(modoCaverna));
  }, [theme, modoCaverna]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleModoCaverna = () => {
    setModoCaverna(prev => {
      const next = !prev;
      if (next) {
        // Automatically switch to dark mode on activation
        setTheme('dark');
      } else {
        // Automatically switch to light mode on deactivation
        setTheme('light');
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, modoCaverna, toggleModoCaverna }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
