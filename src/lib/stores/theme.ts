import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

/** Persisted under localStorage key "blast-theme". The same key is read by the
 *  anti-FOUC inline script in the root layout, so keep them in sync. */
export const THEME_STORAGE_KEY = "blast-theme";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: THEME_STORAGE_KEY }
  )
);
