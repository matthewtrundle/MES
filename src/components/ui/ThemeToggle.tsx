'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Toggle theme"
      >
        <div className="h-5 w-5" />
      </button>
    );
  }

  function cycleTheme() {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  }

  const icon =
    theme === 'dark' ? (
      <Moon className="h-5 w-5" />
    ) : theme === 'light' ? (
      <Sun className="h-5 w-5" />
    ) : (
      <Monitor className="h-5 w-5" />
    );

  const label =
    theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System';

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
    >
      {icon}
      <span className="hidden sm:inline text-xs font-medium">{label}</span>
    </button>
  );
}
