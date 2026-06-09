"use client";

import { useEffect } from "react";

import { useThemeStore } from "@/lib/stores/theme";

/** Keeps the <html> `dark` class in sync with the persisted theme, which drives
 *  Tailwind / shadcn semantic tokens. */
export default function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}
