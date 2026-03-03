import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function Tooltip({ children, content, side = "top", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              "z-50 max-w-xs rounded-md border border-border-secondary bg-bg-elevated px-3 py-2",
              "text-xs text-text-secondary shadow-xl shadow-black/30",
              "animate-in fade-in-0 zoom-in-95",
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-bg-elevated" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
