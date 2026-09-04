"use client";

import { useState } from "react";
import { Braces, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WORKFLOW_VARIABLES } from "./automation-types";

interface VariablePickerProps {
  onSelect: (variableKey: string) => void;
  label?: string;
  size?: "default" | "sm" | "icon-xs";
}

export function VariablePicker({
  onSelect,
  label = "Variables",
  size = "sm",
}: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const categories = Array.from(
    new Set(WORKFLOW_VARIABLES.map((v) => v.category)),
  );

  function handleSelect(key: string) {
    onSelect(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1200);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size === "icon-xs" ? "icon-xs" : "xs"}
            className="h-7 text-xs font-normal gap-1.5 px-2 text-muted-foreground hover:text-foreground border-border/80"
            title="Insert workflow variable"
          >
            <Braces className="size-3.5 text-brand" />
            {size !== "icon-xs" && <span>{label}</span>}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72 p-2 max-h-80 overflow-y-auto">
        <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
          Insert Workflow Variable
        </div>
        <div className="space-y-3 mt-1">
          {categories.map((cat) => (
            <div key={cat} className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground/70 px-2">
                {cat}
              </span>
              <div className="space-y-0.5">
                {WORKFLOW_VARIABLES.filter((v) => v.category === cat).map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleSelect(v.key)}
                    className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-accent hover:text-foreground transition-colors group cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-mono text-[11px] text-foreground font-medium truncate">
                        {v.key}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {v.label}
                      </span>
                    </div>
                    {copiedKey === v.key ? (
                      <Check className="size-3 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60 group-hover:text-foreground shrink-0 font-mono">
                        ↵
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VariablePills({
  onSelect,
  filterKeys,
}: {
  onSelect: (key: string) => void;
  filterKeys?: string[];
}) {
  const vars = filterKeys
    ? WORKFLOW_VARIABLES.filter((v) => filterKeys.includes(v.key))
    : WORKFLOW_VARIABLES.slice(0, 4);

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      <span className="text-[10px] text-muted-foreground">Insert:</span>
      {vars.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onSelect(v.key)}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/70 hover:bg-accent border border-border/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {v.key}
        </button>
      ))}
    </div>
  );
}
