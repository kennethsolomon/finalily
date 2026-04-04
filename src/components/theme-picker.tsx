"use client";

import { useTheme } from "@/lib/theme-context";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as ThemeId)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all",
              active
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/50"
            )}
          >
            {/* Color preview */}
            <div className="flex w-full gap-1.5">
              <div
                className="h-8 flex-1 rounded"
                style={{ backgroundColor: t.preview.bg }}
              />
              <div
                className="h-8 flex-1 rounded"
                style={{ backgroundColor: t.preview.card }}
              />
              <div
                className="h-8 flex-1 rounded"
                style={{ backgroundColor: t.preview.primary }}
              />
              <div
                className="h-8 flex-1 rounded"
                style={{ backgroundColor: t.preview.accent }}
              />
            </div>
            <div>
              <p className="text-xs font-medium">{t.name}</p>
              <p className="text-[10px] text-muted-foreground">{t.description}</p>
            </div>
            {active && (
              <div className="absolute right-2 top-2 rounded-full bg-primary p-0.5">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
