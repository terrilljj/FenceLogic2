import { Mail } from "lucide-react";
import { ComponentList } from "@/components/component-list";

interface Component {
  qty: number;
  description: string;
  sku?: string;
}

interface StepReviewProps {
  components: Component[];
  onEmail: () => void;
  onDownload: () => void;
}

/**
 * Step 4 — Review & Checkout. On-screen is a BOM PREVIEW (descriptions only);
 * the full priced SKU plan is email-only (lead-capture policy). ComponentList
 * already renders the Email/Download actions, so this just frames the policy.
 */
export function StepReview({ components, onEmail, onDownload }: StepReviewProps) {
  return (
    <div className="space-y-3" data-testid="step-review">
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          This is a preview (descriptions only). Your <span className="font-medium text-foreground">full priced component list with SKUs</span> is emailed to the address you enter — so it reaches a real inbox.
        </p>
      </div>
      <ComponentList components={components} onEmail={onEmail} onDownload={onDownload} />
    </div>
  );
}
