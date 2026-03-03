import * as Dialog from "@radix-ui/react-dialog";
import { Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface InfoContent {
  title: string;
  description: string;
  standard?: string;
  parameters?: Array<{ name: string; description: string }>;
  interpretation?: string;
}

interface InfoButtonProps {
  info: InfoContent;
  className?: string;
}

export function InfoButton({ info, className }: InfoButtonProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full",
            "text-text-muted hover:text-text-secondary hover:bg-bg-hover",
            "transition-colors duration-150",
            className,
          )}
          aria-label={`Info: ${info.title}`}
        >
          <Info size={14} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-border-secondary bg-bg-secondary shadow-2xl shadow-black/40",
            "p-6 focus:outline-none",
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-text-primary">
              {info.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            {info.description}
          </p>

          {info.standard && (
            <div className="mb-4 rounded-md bg-bg-tertiary border border-border-primary px-3 py-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Standard
              </span>
              <p className="text-sm text-status-info mt-1 font-mono">
                {info.standard}
              </p>
            </div>
          )}

          {info.parameters && info.parameters.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Key Parameters
              </h4>
              <div className="space-y-1.5">
                {info.parameters.map((param) => (
                  <div
                    key={param.name}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="font-mono text-accent shrink-0">
                      {param.name}
                    </span>
                    <span className="text-text-muted">—</span>
                    <span className="text-text-secondary">
                      {param.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {info.interpretation && (
            <div className="rounded-md bg-status-info/10 border border-status-info/20 px-3 py-2">
              <span className="text-xs font-medium text-status-info uppercase tracking-wider">
                How to Read
              </span>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                {info.interpretation}
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
