/**
 * ControlDrawer — Reusable right-side slide-out panel for page controls.
 *
 * Wraps @radix-ui/react-dialog with a fixed right-edge panel.
 * Used by P1, P2, P4, TurbinePhysics, and DigitalTwin pages to move
 * parameter controls out of the main grid so charts can be full-width.
 *
 * Design: ISA-101 dark theme, consistent with TrainingGuide button styling.
 */

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ControlDrawerProps {
  /** Drawer panel title */
  title: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  /** Controls content rendered inside the scrollable body */
  children: ReactNode;
  /** Optional footer content (e.g. reference info) */
  footer?: ReactNode;
  /** Additional className for the trigger button */
  triggerClassName?: string;
}

export function ControlDrawer({
  title,
  subtitle,
  children,
  footer,
  triggerClassName,
}: ControlDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
            "border border-accent/30 bg-accent/10",
            "text-accent/80 hover:text-accent hover:bg-accent/20 hover:border-accent/50",
            "transition-all duration-150 group",
            triggerClassName,
          )}
          aria-label={`Open ${title}`}
          title="Controls"
        >
          <SlidersHorizontal
            size={14}
            className="text-accent group-hover:text-accent"
          />
          <span className="text-[10px] font-medium">Controls</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-80 sm:w-96",
            "border-l border-border-secondary bg-bg-secondary shadow-2xl shadow-black/50",
            "flex flex-col focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-300",
          )}
        >
          {/* Header */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border-primary">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
                  <SlidersHorizontal size={16} className="text-accent" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-text-primary">
                    {title}
                  </Dialog.Title>
                  {subtitle && (
                    <Dialog.Description className="text-xs text-text-muted mt-0.5">
                      {subtitle}
                    </Dialog.Description>
                  )}
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-4">
            {children}
          </div>

          {/* Optional footer */}
          {footer && (
            <div className="shrink-0 px-5 py-3 border-t border-border-primary">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
