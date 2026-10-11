"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";

export function ThemeToggle({ className, tone = "sidebar" }: { className?: string; tone?: "sidebar" | "page" }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light");
  }, []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("if-theme", next);
        } catch {}
        setTheme(next);
      }}
      aria-label={`Switch to ${next} mode`}
      className={clsx(
        "inline-flex size-9 items-center justify-center rounded-md transition-colors",
        tone === "sidebar"
          ? "text-sidebar-ink-2 hover:bg-sidebar-2 hover:text-sidebar-ink"
          : "border border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
