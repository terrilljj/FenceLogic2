import { Mail, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /** Push the priced BOM to the storefront cart (shown when embedded in the storefront). */
  onAddToCart?: () => void;
}

/**
 * Step 4 — Review & Checkout. On-screen is a BOM PREVIEW (descriptions only);
 * the full priced SKU plan is email-only (lead-capture policy). The primary action
 * is Add to cart (push the BOM to the storefront cart); Email/Download remain.
 */
export function StepReview({ components, onEmail, onDownload, onAddToCart }: StepReviewProps) {
  return (
    <div className="space-y-3" data-testid="step-review">
      {onAddToCart && (
        <Button onClick={onAddToCart} size="lg" className="w-full" data-testid="step-review-add-to-cart">
          <ShoppingCart className="mr-2 h-4 w-4" /> Add all to cart
        </Button>
      )}
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Add the components to your cart to buy, or get your <span className="font-medium text-foreground">full priced list with SKUs</span> emailed — it reaches a real inbox.
        </p>
      </div>
      <ComponentList components={components} onEmail={onEmail} onDownload={onDownload} />
    </div>
  );
}
