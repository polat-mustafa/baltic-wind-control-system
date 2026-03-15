/**
 * TrainingGuide — Page-level training / user guide button.
 *
 * Renders a graduation-cap icon button that opens a full-page user guide
 * modal explaining the purpose, usage, panels, standards, and learning
 * objectives for the current page.
 *
 * Placement: upper-right corner of each page header.
 * Design: consistent with InfoButton (Radix Dialog, ISA-101 dark theme).
 */

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { GraduationCap, X, BookOpen, Target, ListChecks, Scale } from "lucide-react";
import { cn } from "../../lib/utils";
import type { TrainingGuideData } from "../../constants/trainingGuideContent";

interface TrainingGuideProps {
  guide: TrainingGuideData;
  className?: string;
}

export function TrainingGuide({ guide, className }: TrainingGuideProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "panels" | "standards" | "objectives">("overview");

  const tabs = [
    { id: "overview" as const, label: "How to Use", icon: BookOpen },
    { id: "panels" as const, label: "Dashboard Panels", icon: ListChecks },
    { id: "standards" as const, label: "Standards", icon: Scale },
    { id: "objectives" as const, label: "Learning Goals", icon: Target },
  ];

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
            "border border-amber-600/30 bg-amber-500/10",
            "text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50",
            "transition-all duration-150 group",
            className,
          )}
          aria-label={`Training Guide: ${guide.title}`}
          title="Training Guide"
        >
          <GraduationCap size={14} className="text-amber-400 group-hover:text-amber-300" />
          <span className="text-[10px] font-medium">Guide</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-border-secondary bg-bg-secondary shadow-2xl shadow-black/50",
            "flex flex-col focus:outline-none",
          )}
        >
          {/* Header */}
          <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border-primary">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <GraduationCap size={16} className="text-amber-400" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-text-primary">
                    {guide.title}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-text-muted mt-0.5">
                    {guide.subtitle}
                  </Dialog.Description>
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

            {/* Purpose */}
            <p className="text-sm text-text-secondary leading-relaxed mt-3">
              {guide.purpose}
            </p>

            {/* Tab bar */}
            <div className="flex gap-1 mt-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent",
                    )}
                  >
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {/* How to Use tab */}
            {activeTab === "overview" && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Step-by-Step Guide
                </h4>
                <ol className="space-y-2">
                  {guide.howToUse.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-text-secondary leading-relaxed">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Panels tab */}
            {activeTab === "panels" && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Dashboard Panels & Components
                </h4>
                <div className="space-y-2">
                  {guide.sections.map((section) => (
                    <div
                      key={section.name}
                      className="rounded-md border border-border-primary bg-bg-tertiary p-3"
                    >
                      <h5 className="text-sm font-medium text-text-primary mb-1">
                        {section.name}
                      </h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {section.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Standards tab */}
            {activeTab === "standards" && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Referenced Standards & Specifications
                </h4>
                <div className="space-y-1.5">
                  {guide.standards.map((standard) => (
                    <div
                      key={standard}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-status-info" />
                      <span className="text-text-secondary font-mono text-xs leading-relaxed">
                        {standard}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Learning objectives tab */}
            {activeTab === "objectives" && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  After Completing This Section, You Will Be Able To
                </h4>
                <div className="space-y-2">
                  {guide.learningObjectives.map((objective, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-md border border-border-primary bg-bg-tertiary p-3"
                    >
                      <Target size={12} className="shrink-0 mt-0.5 text-accent" />
                      <span className="text-sm text-text-secondary leading-relaxed">
                        {objective}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-3 border-t border-border-primary">
            <p className="text-[10px] text-text-muted text-center">
              Baltic Wind HV Control Platform — Training Module
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
