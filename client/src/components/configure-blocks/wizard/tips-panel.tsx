import { Card } from "@/components/ui/card";
import { JoeAvatar } from "./joe-avatar";

export interface Tip {
  title: string;
  body: string;
}

interface TipsPanelProps {
  /** Panel heading. Defaults to "Joe's tips"; becomes "Ask Joe" once live chat is wired. */
  title?: string;
  tips: Tip[];
  footnote?: string;
}

/**
 * Joe's help panel — Barrier Hub's point of difference vs a generic "things to
 * consider" box. Joe (BH's AI fencing expert) speaks beside the configurator in
 * his own voice; tips are sourced from his trained corpus (joe-product-corpus-v1).
 *
 * V1 = curated contextual tips (static). When the live `/api/joe` chat endpoint
 * is wired (storefront repo), an "Ask Joe a question" input slots in here and the
 * title flips to "Ask Joe". Avatar is a placeholder until Joe's brand art lands.
 *
 * Sits beside Step 1 inputs; stacks under on mobile.
 */
export function TipsPanel({ title = "Joe's tips", tips, footnote }: TipsPanelProps) {
  return (
    <Card className="h-full border-card-border bg-muted/30 p-4" data-testid="tips-panel">
      <div className="mb-3 flex items-center gap-2.5">
        <JoeAvatar size={36} />
        <div className="min-w-0 leading-tight">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">Your Barrier Hub fencing expert</p>
        </div>
      </div>
      <ul className="space-y-3">
        {tips.map((t, i) => (
          <li key={i}>
            <p className="text-xs font-semibold text-foreground">{t.title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </li>
        ))}
      </ul>
      {footnote && (
        <p className="mt-4 border-t border-card-border pt-3 text-[11px] text-muted-foreground">{footnote}</p>
      )}
    </Card>
  );
}
