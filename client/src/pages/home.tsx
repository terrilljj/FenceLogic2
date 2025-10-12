import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { ProductType, ProductVariant } from "@shared/schema";
import { ArrowRight } from "lucide-react";

interface ProductOption {
  id: ProductVariant;
  type: ProductType;
  name: string;
  description: string;
  visual: "frameless-glass" | "channel-glass" | "standoff-glass" | "aluminium-slats" | "aluminium-vertical";
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
    id: "glass-bal-spigots",
    type: "glass-balustrade",
    name: "Frameless Balustrade",
    description: "Glass balustrade with spigots",
    visual: "frameless-glass"
  },
  {
    id: "glass-bal-channel",
    type: "glass-balustrade",
    name: "Channel Balustrade",
    description: "Glass in aluminum channel",
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
    name: "Aluminium Pool Fence",
    description: "Powder-coated aluminium",
    visual: "aluminium-vertical"
  },
  {
    id: "alu-bal-barr",
    type: "aluminium-balustrade",
    name: "Aluminium Balustrade",
    description: "Modern aluminium design",
    visual: "aluminium-slats"
  },
  {
    id: "pvc-privacy",
    type: "pvc",
    name: "PVC Fencing",
    description: "Low-maintenance PVC fencing",
    visual: "aluminium-slats"
  }
];

function ProductVisual({ type }: { type: "frameless-glass" | "channel-glass" | "standoff-glass" | "aluminium-slats" | "aluminium-vertical" }) {
  if (type === "frameless-glass") {
    return (
      <div className="relative w-32 h-40 mx-auto">
        {/* Glass panel with spigots */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-20 h-32 bg-gradient-to-br from-blue-100/60 to-blue-200/40 dark:from-blue-900/20 dark:to-blue-800/30 border border-blue-200/50 dark:border-blue-700/50 rounded-sm transform perspective-500 rotate-y-[-8deg]" style={{ transform: 'perspective(500px) rotateY(-8deg)' }}>
          {/* Top spigot */}
          <div className="absolute -bottom-2 left-2 w-3 h-3 bg-zinc-400 dark:bg-zinc-600 rounded-full shadow-sm" />
          <div className="absolute -bottom-2 right-2 w-3 h-3 bg-zinc-400 dark:bg-zinc-600 rounded-full shadow-sm" />
        </div>
      </div>
    );
  }

  if (type === "channel-glass") {
    return (
      <div className="relative w-32 h-40 mx-auto">
        {/* Glass panel in channel */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-20 h-32 bg-gradient-to-br from-blue-100/60 to-blue-200/40 dark:from-blue-900/20 dark:to-blue-800/30 border border-blue-200/50 dark:border-blue-700/50 rounded-sm transform perspective-500" style={{ transform: 'perspective(500px) rotateY(-8deg)' }}>
          {/* Bottom channel */}
          <div className="absolute -bottom-1 left-0 right-0 h-2 bg-zinc-400 dark:bg-zinc-600 rounded-sm shadow-sm" />
        </div>
      </div>
    );
  }

  if (type === "standoff-glass") {
    return (
      <div className="relative w-32 h-40 mx-auto">
        {/* Glass panel with standoffs */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-20 h-32 bg-gradient-to-br from-blue-100/60 to-blue-200/40 dark:from-blue-900/20 dark:to-blue-800/30 border border-blue-200/50 dark:border-blue-700/50 rounded-sm transform perspective-500" style={{ transform: 'perspective(500px) rotateY(-8deg)' }}>
          {/* Standoff pins */}
          <div className="absolute top-3 left-2 w-2 h-2 bg-zinc-400 dark:bg-zinc-600 rounded-full shadow-sm" />
          <div className="absolute top-3 right-2 w-2 h-2 bg-zinc-400 dark:bg-zinc-600 rounded-full shadow-sm" />
          <div className="absolute bottom-3 left-2 w-2 h-2 bg-zinc-400 dark:bg-zinc-600 rounded-full shadow-sm" />
          <div className="absolute bottom-3 right-2 w-2 h-2 bg-zinc-400 dark:bg-zinc-600 rounded-full shadow-sm" />
        </div>
      </div>
    );
  }

  if (type === "aluminium-vertical") {
    return (
      <div className="relative w-32 h-40 mx-auto">
        {/* Aluminium vertical pickets/bars */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-24 h-32 flex justify-between items-end transform perspective-500" style={{ transform: 'perspective(500px) rotateY(-8deg)' }}>
          {/* Top rail */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-zinc-700 dark:bg-zinc-600 rounded-sm shadow-sm" />
          {/* Bottom rail */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-zinc-700 dark:bg-zinc-600 rounded-sm shadow-sm" />
          {/* Vertical pickets */}
          {[...Array(11)].map((_, i) => (
            <div key={i} className="w-1 h-28 bg-gradient-to-b from-zinc-600 to-zinc-700 dark:from-zinc-500 dark:to-zinc-600 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (type === "aluminium-slats") {
    return (
      <div className="relative w-32 h-40 mx-auto">
        {/* Aluminium slats */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-20 h-32 flex flex-col gap-1 transform perspective-500" style={{ transform: 'perspective(500px) rotateY(-8deg)' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-3 bg-gradient-to-r from-zinc-600 to-zinc-700 dark:from-zinc-500 dark:to-zinc-600 rounded-sm shadow-sm" />
          ))}
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
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold mb-3" data-testid="text-choose-style">
            Choose Your Fencing Style
          </h2>
          <p className="text-muted-foreground">
            Select the type of fencing or balustrade you want to configure
          </p>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {productOptions.map((product) => (
            <Card
              key={product.id}
              className="p-6 cursor-pointer hover-elevate active-elevate-2 transition-all group"
              onClick={() => handleSelectProduct(product.type, product.id)}
              data-testid={`card-home-product-${product.id}`}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Visual */}
                <ProductVisual type={product.visual} />
                
                {/* Label */}
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">
                    {product.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {product.description}
                  </p>
                </div>

                {/* Arrow indicator on hover */}
                <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>
          ))}
        </div>

        {/* Info Footer */}
        <div className="mt-16 text-center">
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
