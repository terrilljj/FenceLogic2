import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: number;
  title: string;
  subtitle?: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number;
  /** Jump to a step (only completed/current steps are clickable). */
  onStepClick?: (id: number) => void;
  className?: string;
}

/**
 * Oxworks-style numbered step bar. Desktop = full 4-segment bar with numbered
 * circles + titles; mobile = compact "Step N of M — Title" with progress dots.
 * Structural primitive — knows nothing about fences.
 */
export function WizardStepper({ steps, currentStep, onStepClick, className }: WizardStepperProps) {
  const active = steps.find((s) => s.id === currentStep);

  return (
    <div className={cn("w-full", className)} data-testid="wizard-stepper">
      {/* Mobile (compact) */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {currentStep}
          </span>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold truncate">{active?.title}</div>
            <div className="text-[11px] text-muted-foreground">Step {currentStep} of {steps.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {steps.map((s) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                s.id === currentStep ? "w-5 bg-primary" : s.id < currentStep ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {/* Desktop (full bar) */}
      <ol className="hidden md:flex items-stretch overflow-hidden rounded-md border border-card-border">
        {steps.map((s, i) => {
          const isActive = s.id === currentStep;
          const isDone = s.id < currentStep;
          const clickable = !!onStepClick;
          return (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(s.id)}
                className={cn(
                  "flex h-full w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  i > 0 && "border-l border-card-border",
                  isActive ? "bg-primary/10" : "bg-card",
                  clickable && !isActive && "hover-elevate active-elevate-2",
                  !clickable && "cursor-default",
                )}
                data-testid={`wizard-step-${s.id}`}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : s.id}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
                    {s.title}
                  </span>
                  {s.subtitle && <span className="block truncate text-[11px] text-muted-foreground">{s.subtitle}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
