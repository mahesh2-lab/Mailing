"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="icon-button text-muted-foreground hover:text-foreground"
        aria-label="Toggle theme"
      >
        <Sun className="size-4.5" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="icon-button text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
          />
        }
      >
        {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
      </TooltipTrigger>
      <TooltipContent>
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </TooltipContent>
    </Tooltip>
  );
}

