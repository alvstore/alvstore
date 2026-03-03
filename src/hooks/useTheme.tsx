import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface ThemeDefinition {
  name: string;
  label: string;
  preview: string; // hex color for swatch
  isDark: boolean;
  vars: Record<string, string>;
}

const themes: ThemeDefinition[] = [
  {
    name: "obsidian",
    label: "Obsidian",
    preview: "#080808",
    isDark: true,
    vars: {
      "--background": "0 0% 3.1%",
      "--foreground": "0 0% 100%",
      "--card": "0 0% 7.1%",
      "--card-foreground": "0 0% 100%",
      "--popover": "0 0% 7.1%",
      "--popover-foreground": "0 0% 100%",
      "--primary": "258 90% 66%",
      "--primary-foreground": "0 0% 100%",
      "--primary-glow": "258 80% 75%",
      "--secondary": "0 0% 10%",
      "--secondary-foreground": "0 0% 85%",
      "--muted": "0 0% 10%",
      "--muted-foreground": "240 4% 46%",
      "--accent": "258 80% 60%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "0 86% 60%",
      "--destructive-foreground": "0 0% 100%",
      "--success": "142 71% 45%",
      "--success-foreground": "0 0% 100%",
      "--warning": "32 95% 52%",
      "--warning-foreground": "0 0% 5%",
      "--info": "217 91% 60%",
      "--info-foreground": "0 0% 100%",
      "--border": "0 0% 100% / 0.05",
      "--input": "0 0% 100% / 0.05",
      "--ring": "258 90% 66%",
      "--sidebar-background": "0 0% 3.1%",
      "--sidebar-foreground": "0 0% 85%",
      "--sidebar-primary": "258 90% 66%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "0 0% 100% / 0.05",
      "--sidebar-accent-foreground": "0 0% 95%",
      "--sidebar-border": "0 0% 100% / 0.05",
      "--sidebar-ring": "258 90% 66%",
      "--sidebar-muted": "0 0% 15%",
    },
  },
  {
    name: "forest",
    label: "Forest",
    preview: "#065F46",
    isDark: false,
    vars: {
      "--background": "210 20% 98%",
      "--foreground": "220 15% 10%",
      "--card": "0 0% 100%",
      "--card-foreground": "220 15% 10%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "220 15% 10%",
      "--primary": "160 84% 20%",
      "--primary-foreground": "0 0% 100%",
      "--primary-glow": "160 60% 35%",
      "--secondary": "210 15% 95%",
      "--secondary-foreground": "220 15% 25%",
      "--muted": "210 15% 95%",
      "--muted-foreground": "220 10% 46%",
      "--accent": "160 60% 35%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "0 72% 51%",
      "--destructive-foreground": "0 0% 100%",
      "--success": "142 71% 35%",
      "--success-foreground": "0 0% 100%",
      "--warning": "38 92% 50%",
      "--warning-foreground": "0 0% 5%",
      "--info": "217 91% 60%",
      "--info-foreground": "0 0% 100%",
      "--border": "220 13% 91%",
      "--input": "220 13% 91%",
      "--ring": "160 84% 20%",
      "--sidebar-background": "0 0% 100%",
      "--sidebar-foreground": "220 15% 25%",
      "--sidebar-primary": "160 84% 20%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "160 60% 95%",
      "--sidebar-accent-foreground": "160 84% 20%",
      "--sidebar-border": "220 13% 91%",
      "--sidebar-ring": "160 84% 20%",
      "--sidebar-muted": "210 15% 95%",
    },
  },
  {
    name: "ocean",
    label: "Ocean Deep",
    preview: "#0A1628",
    isDark: true,
    vars: {
      "--background": "218 56% 10%",
      "--foreground": "210 40% 98%",
      "--card": "218 50% 14%",
      "--card-foreground": "210 40% 98%",
      "--popover": "218 50% 14%",
      "--popover-foreground": "210 40% 98%",
      "--primary": "187 92% 43%",
      "--primary-foreground": "220 30% 5%",
      "--primary-glow": "187 80% 55%",
      "--secondary": "218 40% 18%",
      "--secondary-foreground": "210 30% 80%",
      "--muted": "218 40% 18%",
      "--muted-foreground": "215 20% 55%",
      "--accent": "187 80% 43%",
      "--accent-foreground": "220 30% 5%",
      "--destructive": "0 86% 60%",
      "--destructive-foreground": "0 0% 100%",
      "--success": "142 71% 45%",
      "--success-foreground": "0 0% 100%",
      "--warning": "32 95% 52%",
      "--warning-foreground": "0 0% 5%",
      "--info": "199 89% 48%",
      "--info-foreground": "0 0% 100%",
      "--border": "215 30% 22%",
      "--input": "215 30% 22%",
      "--ring": "187 92% 43%",
      "--sidebar-background": "218 56% 8%",
      "--sidebar-foreground": "210 30% 80%",
      "--sidebar-primary": "187 92% 43%",
      "--sidebar-primary-foreground": "220 30% 5%",
      "--sidebar-accent": "187 92% 43% / 0.1",
      "--sidebar-accent-foreground": "210 40% 98%",
      "--sidebar-border": "215 30% 22%",
      "--sidebar-ring": "187 92% 43%",
      "--sidebar-muted": "218 40% 18%",
    },
  },
  {
    name: "ember",
    label: "Sunset Ember",
    preview: "#1A0F0A",
    isDark: true,
    vars: {
      "--background": "20 38% 7%",
      "--foreground": "30 20% 95%",
      "--card": "20 30% 10%",
      "--card-foreground": "30 20% 95%",
      "--popover": "20 30% 10%",
      "--popover-foreground": "30 20% 95%",
      "--primary": "38 92% 50%",
      "--primary-foreground": "20 40% 5%",
      "--primary-glow": "32 85% 60%",
      "--secondary": "20 25% 14%",
      "--secondary-foreground": "30 15% 75%",
      "--muted": "20 25% 14%",
      "--muted-foreground": "25 15% 50%",
      "--accent": "38 92% 50%",
      "--accent-foreground": "20 40% 5%",
      "--destructive": "0 86% 60%",
      "--destructive-foreground": "0 0% 100%",
      "--success": "142 71% 45%",
      "--success-foreground": "0 0% 100%",
      "--warning": "38 92% 50%",
      "--warning-foreground": "0 0% 5%",
      "--info": "217 91% 60%",
      "--info-foreground": "0 0% 100%",
      "--border": "20 20% 16%",
      "--input": "20 20% 16%",
      "--ring": "38 92% 50%",
      "--sidebar-background": "20 38% 5%",
      "--sidebar-foreground": "30 15% 75%",
      "--sidebar-primary": "38 92% 50%",
      "--sidebar-primary-foreground": "20 40% 5%",
      "--sidebar-accent": "38 92% 50% / 0.1",
      "--sidebar-accent-foreground": "30 20% 95%",
      "--sidebar-border": "20 20% 16%",
      "--sidebar-ring": "38 92% 50%",
      "--sidebar-muted": "20 25% 14%",
    },
  },
  {
    name: "arctic",
    label: "Arctic",
    preview: "#4F46E5",
    isDark: false,
    vars: {
      "--background": "214 32% 96%",
      "--foreground": "222 47% 11%",
      "--card": "0 0% 100%",
      "--card-foreground": "222 47% 11%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "222 47% 11%",
      "--primary": "239 84% 67%",
      "--primary-foreground": "0 0% 100%",
      "--primary-glow": "239 70% 75%",
      "--secondary": "214 32% 92%",
      "--secondary-foreground": "222 47% 20%",
      "--muted": "214 32% 92%",
      "--muted-foreground": "215 16% 47%",
      "--accent": "239 70% 67%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "0 72% 51%",
      "--destructive-foreground": "0 0% 100%",
      "--success": "142 71% 35%",
      "--success-foreground": "0 0% 100%",
      "--warning": "38 92% 50%",
      "--warning-foreground": "0 0% 5%",
      "--info": "217 91% 60%",
      "--info-foreground": "0 0% 100%",
      "--border": "214 32% 85%",
      "--input": "214 32% 85%",
      "--ring": "239 84% 67%",
      "--sidebar-background": "0 0% 100%",
      "--sidebar-foreground": "222 47% 20%",
      "--sidebar-primary": "239 84% 67%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "239 84% 67% / 0.1",
      "--sidebar-accent-foreground": "239 84% 67%",
      "--sidebar-border": "214 32% 85%",
      "--sidebar-ring": "239 84% 67%",
      "--sidebar-muted": "214 32% 92%",
    },
  },
  {
    name: "rose",
    label: "Midnight Rose",
    preview: "#EC4899",
    isDark: true,
    vars: {
      "--background": "280 54% 6%",
      "--foreground": "300 10% 95%",
      "--card": "280 42% 10%",
      "--card-foreground": "300 10% 95%",
      "--popover": "280 42% 10%",
      "--popover-foreground": "300 10% 95%",
      "--primary": "330 81% 60%",
      "--primary-foreground": "0 0% 100%",
      "--primary-glow": "330 70% 70%",
      "--secondary": "280 35% 14%",
      "--secondary-foreground": "300 10% 80%",
      "--muted": "280 35% 14%",
      "--muted-foreground": "280 15% 50%",
      "--accent": "330 81% 60%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "0 86% 60%",
      "--destructive-foreground": "0 0% 100%",
      "--success": "142 71% 45%",
      "--success-foreground": "0 0% 100%",
      "--warning": "32 95% 52%",
      "--warning-foreground": "0 0% 5%",
      "--info": "217 91% 60%",
      "--info-foreground": "0 0% 100%",
      "--border": "280 25% 16%",
      "--input": "280 25% 16%",
      "--ring": "330 81% 60%",
      "--sidebar-background": "280 54% 4%",
      "--sidebar-foreground": "300 10% 75%",
      "--sidebar-primary": "330 81% 60%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "330 81% 60% / 0.1",
      "--sidebar-accent-foreground": "300 10% 95%",
      "--sidebar-border": "280 25% 16%",
      "--sidebar-ring": "330 81% 60%",
      "--sidebar-muted": "280 35% 14%",
    },
  },
];

interface ThemeContextValue {
  theme: string;
  setTheme: (name: string) => void;
  themes: ThemeDefinition[];
  currentTheme: ThemeDefinition;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(def: ThemeDefinition) {
  const root = document.documentElement;
  Object.entries(def.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  // Set a data attribute for conditional CSS
  root.setAttribute("data-theme", def.name);
  root.setAttribute("data-theme-mode", def.isDark ? "dark" : "light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState(() => {
    try {
      return localStorage.getItem("app-theme") || "obsidian";
    } catch {
      return "obsidian";
    }
  });

  const currentTheme = themes.find(t => t.name === themeName) || themes[0];

  const setTheme = useCallback((name: string) => {
    setThemeName(name);
    try { localStorage.setItem("app-theme", name); } catch {}
  }, []);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ theme: themeName, setTheme, themes, currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
