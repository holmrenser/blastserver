"use client";

import React, { createContext, useState } from "react";

export type Theme = "light" | "dark";

type ContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ContextType>({
  theme: "light",
  toggleTheme: () => {},
});

function ThemeProvider({
  children,
}: {
  children: React.JSX.Element;
}): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>("light");
  function toggleTheme(): void {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export { ThemeContext, ThemeProvider };
