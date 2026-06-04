import { useQuery } from "@tanstack/react-query";

// Storefront base (the Vercel deploy or, later, the real domain). When unset, cards fall
// back to the SKU placeholder. Set VITE_STOREFRONT_IMAGE_BASE in .env / Railway.
const IMAGE_BASE = (import.meta as any).env?.VITE_STOREFRONT_IMAGE_BASE as string | undefined;

/**
 * The whole sku → image-path map from the storefront catalogue (e.g. "/products/X.JPG"),
 * fetched once and cached forever. Paths vary in extension/case, so this DB-sourced map is
 * the only reliable way to resolve a SKU's photo — never construct the path from the SKU.
 */
export function useProductImageMap() {
  return useQuery<Record<string, string>>({
    queryKey: ["/api/product-images"],
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Build the storefront-optimised image URL for a catalogue path. undefined → placeholder. */
export function storefrontImageUrl(path: string | undefined, w = 256): string | undefined {
  if (!path || !IMAGE_BASE) return undefined;
  return `${IMAGE_BASE}/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=75`;
}
