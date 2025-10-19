import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { ProductType, ProductVariant } from "@shared/schema";
import { ArrowRight } from "lucide-react";

interface ProductOption {
  id: ProductVariant;
  type: ProductType;
  name: string;
  description: string;
  visual: "frameless-glass" | "channel-glass" | "standoff-glass" | "aluminium-slats" | "aluminium-vertical" | "aluminium-blade" | "aluminium-tubular" | "pvc-pickets" | "pvc-hamptons-full" | "pvc-hamptons-combo" | "pvc-hamptons-vertical" | "pvc-hamptons-semi" | "pvc-hamptons-3rail";
}

const productOptions: ProductOption[] = [
  {
    id: "glass-pool-spigots",
    type: "glass-pool",
    name: "Frameless Pool Fence",
    description: "Glass panels with spigot mounting",
    visual: "frameless-glass"
  },
  {
    id: "glass-pool-channel",
    type: "glass-pool",
    name: "Channel Pool Fence",
    description: "Glass in aluminum channel",
    visual: "channel-glass"
  },
  {
    id: "glass-bal-spigots-12mm",
    type: "glass-balustrade",
    name: "Frameless Balustrade 12mm",
    description: "970mm high, 12mm glass with spigots",
    visual: "frameless-glass"
  },
  {
    id: "glass-bal-spigots-15mm",
    type: "glass-balustrade",
    name: "Frameless Balustrade 15mm",
    description: "1000mm high, 15mm glass with spigots",
    visual: "frameless-glass"
  },
  {
    id: "glass-bal-channel-std",
    type: "glass-balustrade",
    name: "VersaTilt Channel Standard",
    description: "12mm/15mm glass, 4200mm channel",
    visual: "channel-glass"
  },
  {
    id: "glass-bal-channel-hd",
    type: "glass-balustrade",
    name: "VersaTilt Channel Heavy Duty",
    description: "17.52mm SGP glass, 3600mm channel",
    visual: "channel-glass"
  },
  {
    id: "glass-bal-standoffs",
    type: "glass-balustrade",
    name: "Standoff Balustrade",
    description: "Glass with standoff pins",
    visual: "standoff-glass"
  },
  {
    id: "alu-pool-tubular",
    type: "aluminium-pool",
    name: "Flat Top Pool Fence",
    description: "Tubular flat top aluminium",
    visual: "aluminium-tubular"
  },
  {
    id: "alu-pool-barr",
    type: "aluminium-pool",
    name: "BARR Pool Fence",
    description: "Vertical slat aluminium panels",
    visual: "aluminium-vertical"
  },
  {
    id: "alu-pool-blade",
    type: "aluminium-pool",
    name: "Blade Pool Fence",
    description: "Modern blade aluminium design",
    visual: "aluminium-blade"
  },
  {
    id: "alu-bal-barr",
    type: "aluminium-balustrade",
    name: "Aluminium Balustrade",
    description: "Modern aluminium design",
    visual: "aluminium-slats"
  },
  {
    id: "pvc-hamptons-full-privacy",
    type: "pvc",
    name: "Hamptons Full Privacy",
    description: "1800mm solid privacy panels",
    visual: "pvc-hamptons-full"
  },
  {
    id: "pvc-hamptons-combo",
    type: "pvc",
    name: "Hamptons Combo",
    description: "1800mm with slat topper",
    visual: "pvc-hamptons-combo"
  },
  {
    id: "pvc-hamptons-vertical-paling",
    type: "pvc",
    name: "Hamptons Vertical Paling",
    description: "1800mm vertical paling style",
    visual: "pvc-hamptons-vertical"
  },
  {
    id: "pvc-hamptons-semi-privacy",
    type: "pvc",
    name: "Hamptons Semi Privacy",
    description: "1000mm with horizontal gaps",
    visual: "pvc-hamptons-semi"
  },
  {
    id: "pvc-hamptons-3rail",
    type: "pvc",
    name: "Hamptons 3 Rail",
    description: "1525mm adjustable height rails",
    visual: "pvc-hamptons-3rail"
  },
  {
    id: "custom-frameless",
    type: "custom",
    name: "Frameless Spigots",
    description: "Auto-calc panels with exact gaps",
    visual: "frameless-glass"
  }
];

function ProductVisual({ type }: { type: "frameless-glass" | "channel-glass" | "standoff-glass" | "aluminium-slats" | "aluminium-vertical" | "aluminium-blade" | "aluminium-tubular" | "pvc-pickets" | "pvc-hamptons-full" | "pvc-hamptons-combo" | "pvc-hamptons-vertical" | "pvc-hamptons-semi" | "pvc-hamptons-3rail" }) {
  if (type === "frameless-glass") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Frameless glass panel with base-mounted spigots */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-14 h-20">
          {/* Glass panel - realistic glass appearance */}
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100/80 via-sky-50/60 to-cyan-100/70 dark:from-sky-900/30 dark:via-sky-950/20 dark:to-cyan-900/25 border-2 border-sky-200/40 dark:border-sky-700/40 shadow-sm" 
               style={{ backdropFilter: 'blur(2px)' }} />
          
          {/* Base spigots - circular mounting plates */}
          <div className="absolute -bottom-1.5 left-2 w-2.5 h-3 bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 rounded-sm shadow-md" />
          <div className="absolute -bottom-1.5 right-2 w-2.5 h-3 bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 rounded-sm shadow-md" />
        </div>
      </div>
    );
  }

  if (type === "channel-glass") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Glass panel in aluminium channel system */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-14 h-20">
          {/* Glass panel - realistic glass appearance */}
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100/80 via-sky-50/60 to-cyan-100/70 dark:from-sky-900/30 dark:via-sky-950/20 dark:to-cyan-900/25 border-2 border-sky-200/40 dark:border-sky-700/40 shadow-sm"
               style={{ backdropFilter: 'blur(2px)' }} />
          
          {/* Bottom aluminium channel - U-shaped profile */}
          <div className="absolute -bottom-1.5 left-0 right-0">
            {/* Channel base */}
            <div className="h-2 bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 rounded-b-sm shadow-md" />
            {/* Channel sides */}
            <div className="absolute top-0 left-0 w-0.5 h-1.5 bg-zinc-400 dark:bg-zinc-700" />
            <div className="absolute top-0 right-0 w-0.5 h-1.5 bg-zinc-400 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
    );
  }

  if (type === "standoff-glass") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Glass panel with standoffs */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-14 h-20 bg-gradient-to-br from-sky-100/80 via-sky-50/60 to-cyan-100/70 dark:from-sky-900/30 dark:via-sky-950/20 dark:to-cyan-900/25 border-2 border-sky-200/40 dark:border-sky-700/40 shadow-sm"
             style={{ backdropFilter: 'blur(2px)' }}>
          {/* Standoff pins */}
          <div className="absolute top-2 left-1.5 w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full shadow-sm" />
          <div className="absolute top-2 right-1.5 w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full shadow-sm" />
          <div className="absolute bottom-2 left-1.5 w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full shadow-sm" />
          <div className="absolute bottom-2 right-1.5 w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full shadow-sm" />
        </div>
      </div>
    );
  }

  if (type === "aluminium-vertical") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* BARR: Aluminium vertical pickets with inset rails */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20 flex justify-center items-center">
          {/* Container for pickets with gap from edges */}
          <div className="relative w-14 h-20 flex justify-between">
            {/* Vertical pickets - FULL HEIGHT with gaps */}
            {[...Array(9)].map((_, i) => (
              <div key={i} className="w-0.5 h-20 bg-gradient-to-b from-zinc-600 to-zinc-700 dark:from-zinc-500 dark:to-zinc-600" />
            ))}
            {/* Top rail - INSET from top, thinner */}
            <div className="absolute top-2 left-0 right-0 h-0.5 bg-zinc-700 dark:bg-zinc-600" />
            {/* Bottom rail - INSET from bottom, thinner */}
            <div className="absolute bottom-2 left-0 right-0 h-0.5 bg-zinc-700 dark:bg-zinc-600" />
          </div>
        </div>
      </div>
    );
  }

  if (type === "aluminium-blade") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Blade: Thinner aluminium vertical blades (16mm) with inset rails */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20 flex justify-center items-center">
          {/* Container for blades with gap from edges */}
          <div className="relative w-14 h-20 flex justify-between">
            {/* Vertical blades - FULL HEIGHT, thinner than BARR */}
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-px h-20 bg-gradient-to-b from-zinc-600 to-zinc-700 dark:from-zinc-500 dark:to-zinc-600" />
            ))}
            {/* Top rail - INSET from top, thinner */}
            <div className="absolute top-2 left-0 right-0 h-0.5 bg-zinc-700 dark:bg-zinc-600" />
            {/* Bottom rail - INSET from bottom, thinner */}
            <div className="absolute bottom-2 left-0 right-0 h-0.5 bg-zinc-700 dark:bg-zinc-600" />
          </div>
        </div>
      </div>
    );
  }

  if (type === "aluminium-tubular") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Tubular Flat Top: 16mm round vertical tubes with 25mm top and bottom rails */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20 flex justify-center items-center">
          {/* Container for tubes with gap from edges */}
          <div className="relative w-14 h-20 flex justify-between items-end">
            {/* Vertical round tubes - 16mm diameter, FULL HEIGHT with wider spacing */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-0.5 h-20 bg-gradient-to-b from-zinc-600 to-zinc-700 dark:from-zinc-500 dark:to-zinc-600 rounded-full" />
            ))}
            {/* Top rail - 25mm at top edge */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-700 dark:bg-zinc-600 rounded-sm" />
            {/* Bottom rail - 25mm at bottom edge */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-700 dark:bg-zinc-600 rounded-sm" />
          </div>
        </div>
      </div>
    );
  }

  if (type === "aluminium-slats") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Aluminium slats */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-14 h-20 flex flex-col gap-0.5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-2 bg-gradient-to-r from-zinc-600 to-zinc-700 dark:from-zinc-500 dark:to-zinc-600 rounded-sm shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (type === "pvc-pickets") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Hampton-style PVC picket fence */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20">
          {/* Left post */}
          <div className="absolute left-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Right post */}
          <div className="absolute right-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Top rail */}
          <div className="absolute top-1 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Bottom rail */}
          <div className="absolute bottom-4 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Vertical pickets */}
          <div className="absolute top-2 left-1 right-1 bottom-5 flex justify-between">
            {[...Array(13)].map((_, i) => (
              <div key={i} className="w-px h-full bg-slate-200 dark:bg-slate-100 shadow-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "pvc-hamptons-full") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Full Privacy: solid panel */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20">
          {/* Square posts */}
          <div className="absolute left-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          <div className="absolute right-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Solid panel */}
          <div className="absolute left-1 right-1 top-0 bottom-0 bg-slate-200 dark:bg-slate-100 shadow-sm" />
        </div>
      </div>
    );
  }

  if (type === "pvc-hamptons-combo") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Combo: solid lower + slat topper */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20">
          {/* Square posts */}
          <div className="absolute left-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          <div className="absolute right-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Solid lower panel (60% height) */}
          <div className="absolute left-1 right-1 bottom-0 h-3/5 bg-slate-200 dark:bg-slate-100 shadow-sm" />
          {/* Horizontal slats (40% height at top) */}
          <div className="absolute left-1 right-1 top-0 h-2/5 flex flex-col gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-0.5 bg-slate-200 dark:bg-slate-100 shadow-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "pvc-hamptons-vertical") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Vertical Paling: vertical slats with gaps */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20">
          {/* Square posts */}
          <div className="absolute left-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          <div className="absolute right-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Vertical slats */}
          <div className="absolute left-1 right-1 top-0 bottom-0 flex justify-between">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="w-0.5 h-full bg-slate-200 dark:bg-slate-100 shadow-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "pvc-hamptons-semi") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* Semi Privacy: horizontal slats with gaps */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20">
          {/* Square posts */}
          <div className="absolute left-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          <div className="absolute right-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Horizontal slats with gaps */}
          <div className="absolute left-1 right-1 top-1 bottom-1 flex flex-col justify-between">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-1 bg-slate-200 dark:bg-slate-100 shadow-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "pvc-hamptons-3rail") {
    return (
      <div className="relative w-20 h-24 mx-auto">
        {/* 3 Rail: three horizontal rails */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-20">
          {/* Square posts */}
          <div className="absolute left-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          <div className="absolute right-0 top-0 w-1 h-full bg-slate-100 dark:bg-slate-200 shadow-sm" />
          {/* Three horizontal rails */}
          <div className="absolute left-1 right-1 top-2 h-1 bg-slate-200 dark:bg-slate-100 shadow-sm" />
          <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-1 bg-slate-200 dark:bg-slate-100 shadow-sm" />
          <div className="absolute left-1 right-1 bottom-2 h-1 bg-slate-200 dark:bg-slate-100 shadow-sm" />
        </div>
      </div>
    );
  }

  return null;
}

export default function Home() {
  const [, setLocation] = useLocation();

  const handleSelectProduct = (type: ProductType, variant: ProductVariant) => {
    // Navigate to calculator with selected product
    setLocation(`/calculator?type=${type}&variant=${variant}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold mb-2" data-testid="text-home-title">
            Fence Logic Calculator
          </h1>
          <p className="text-lg text-muted-foreground">
            Calculate your fence cost and the materials needed.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Pool Fencing Section */}
        <div className="mb-16">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold mb-3" data-testid="text-pool-fencing-title">
              Pool Fencing
            </h2>
            <p className="text-muted-foreground">
              Select the style of pool fencing for your project
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {productOptions
              .filter((p) => p.type === "glass-pool" || p.type === "aluminium-pool" || p.type === "general")
              .map((product) => (
                <Card
                  key={product.id}
                  className="p-4 cursor-pointer hover-elevate active-elevate-2 transition-all group"
                  onClick={() => handleSelectProduct(product.type, product.id)}
                  data-testid={`card-home-product-${product.id}`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <ProductVisual type={product.visual} />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              ))}
          </div>
        </div>

        {/* Hamptons Section */}
        <div className="mb-16">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold mb-3" data-testid="text-hamptons-title">
              Hamptons
            </h2>
            <p className="text-muted-foreground">
              Low-maintenance PVC fencing with classic Hamptons styling
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {productOptions
              .filter((p) => p.type === "pvc")
              .map((product) => (
                <Card
                  key={product.id}
                  className="p-4 cursor-pointer hover-elevate active-elevate-2 transition-all group"
                  onClick={() => handleSelectProduct(product.type, product.id)}
                  data-testid={`card-home-product-${product.id}`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <ProductVisual type={product.visual} />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              ))}
          </div>
        </div>

        {/* Balustrade Section */}
        <div className="mb-16">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold mb-3" data-testid="text-balustrade-title">
              Balustrade
            </h2>
            <p className="text-muted-foreground">
              Select the style of balustrade for your deck, balcony or stairs
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productOptions
              .filter((p) => p.type === "glass-balustrade" || p.type === "aluminium-balustrade")
              .map((product) => (
                <Card
                  key={product.id}
                  className="p-4 cursor-pointer hover-elevate active-elevate-2 transition-all group"
                  onClick={() => handleSelectProduct(product.type, product.id)}
                  data-testid={`card-home-product-${product.id}`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <ProductVisual type={product.visual} />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              ))}
          </div>
        </div>

        {/* Custom Section */}
        <div className="mb-16">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold mb-3" data-testid="text-custom-title">
              Custom
            </h2>
            <p className="text-muted-foreground">
              Advanced configurator with auto-calculated panel widths
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productOptions
              .filter((p) => p.type === "custom")
              .map((product) => (
                <Card
                  key={product.id}
                  className="p-4 cursor-pointer hover-elevate active-elevate-2 transition-all group"
                  onClick={() => handleSelectProduct(product.type, product.id)}
                  data-testid={`card-home-product-${product.id}`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <ProductVisual type={product.visual} />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              ))}
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-primary/10 border border-primary/20 rounded-lg p-6 max-w-2xl">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Tip:</span> Divide your fence plan into sections and enter them one at a time. 
              Each section can have custom panels, gates, and gap configurations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
