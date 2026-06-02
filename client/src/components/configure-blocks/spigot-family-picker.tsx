import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpigotFamily {
  /** Discriminator value written to fieldValues['spigot-family']. */
  value: string;
  label: string;
  /** One-line "what it is" so a first-time user can tell families apart. */
  blurb: string;
  /** Base-plated black SKU — used to build the product image once a storefront URL exists. */
  imageSku: string;
}

interface SpigotFamilyPickerProps {
  families: SpigotFamily[];
  value: string;
  onSelect: (value: string) => void;
  spanId: string;
}

// Optimised storefront image, only when a production base URL is configured.
// Until then each card shows a labelled placeholder keyed to the family's SKU.
const IMAGE_BASE = (import.meta as any).env?.VITE_STOREFRONT_IMAGE_BASE as string | undefined;
function familyImageSrc(sku: string): string | undefined {
  if (!IMAGE_BASE) return undefined;
  return `${IMAGE_BASE}/_next/image?url=/products/${sku}.png&w=256&q=75`;
}

/**
 * Card grid for choosing a spigot family (image + name + blurb). The image is a
 * placeholder (showing the base-plated-black SKU) until VITE_STOREFRONT_IMAGE_BASE
 * is set, at which point real product photos load. Reused by pool + balustrade.
 */
export function SpigotFamilyPicker({ families, value, onSelect, spanId }: SpigotFamilyPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5" data-testid={`span-${spanId}-spigot-family-picker`}>
      {families.map((f) => {
        const isActive = f.value === value;
        const img = familyImageSrc(f.imageSku);
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onSelect(f.value)}
            className={cn(
              "flex flex-col gap-1.5 rounded-md border p-2 text-left transition-colors hover-elevate active-elevate-2",
              isActive ? "border-primary/50 bg-primary/5 ring-2 ring-primary" : "border-card-border bg-card",
            )}
            data-testid={`span-${spanId}-family-${f.value}`}
          >
            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-muted text-center">
              {img ? (
                <img src={img} alt={f.label} className="h-full w-full object-contain" loading="lazy" />
              ) : (
                <span className="px-1 text-[9px] leading-tight text-muted-foreground">
                  image soon
                  <br />
                  <span className="font-mono">{f.imageSku}</span>
                </span>
              )}
              {isActive && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{f.label}</p>
              <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{f.blurb}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
