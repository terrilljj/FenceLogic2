import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

interface JoeAvatarProps {
  /** Pixel diameter of the avatar circle. */
  size?: number;
  /** Show the green "online" status dot (use when Joe is interactive/live). */
  online?: boolean;
  className?: string;
}

/**
 * PLACEHOLDER avatar for Joe — Barrier Hub's AI fencing expert.
 *
 * Joe has no brand art yet (to be commissioned). This is a clean, swappable
 * stand-in: a hard-hat glyph in a primary-tinted circle. When real artwork
 * lands, replace the inner glyph with an <img>/SVG and keep this component's
 * API so every call site is unaffected.
 *
 * Joe's voice + knowledge are real (see vault joe-product-corpus-v1); only his
 * face is a placeholder.
 */
export function JoeAvatar({ size = 36, online = false, className }: JoeAvatarProps) {
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      data-testid="joe-avatar"
      aria-label="Joe — Barrier Hub fencing expert"
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
        <HardHat className="text-primary" style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 block rounded-full border-2 border-background bg-green-500"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
