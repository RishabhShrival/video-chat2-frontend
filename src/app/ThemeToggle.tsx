"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("isDarkmode");
    let dark = false;
    if (saved === null) {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      dark = saved === "true";
    }
    document.documentElement.classList.toggle("dark", dark);
    console.log(window.matchMedia("(prefers-color-scheme: dark)").matches);
    console.log("Dark mode preference:", dark);
    setIsDark(dark);
  }, []);

  const toggleTheme = () => {
    if (isDark === null) return;
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      window.matchMedia("(prefers-color-scheme: dark)")
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("isDarkmode", newDark.toString());
  };

  if (isDark === null) return null; // avoid mismatch on initial render

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded transition-colors duration-300 text-black dark:text-white`}
    >
      {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
    </button>
  );
}
