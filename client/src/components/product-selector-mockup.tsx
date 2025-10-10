import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface ProductCategory {
  id: string;
  name: string;
  description: string;
  variants: ProductVariant[];
}

interface ProductVariant {
  id: string;
  name: string;
  badge?: string;
}

const productCategories: ProductCategory[] = [
  {
    id: "glass-pool",
    name: "Glass Pool Fencing",
    description: "Premium glass pool fencing with spigot or channel mounting",
    variants: [
      { id: "glass-pool-spigots", name: "Frameless with Spigots", badge: "Current" },
      { id: "glass-pool-channel", name: "Channel" }
    ]
  },
  {
    id: "glass-balustrade",
    name: "Glass Balustrade",
    description: "Glass balustrade systems for decks, balconies, and stairs",
    variants: [
      { id: "glass-bal-spigots", name: "Frameless with Spigots" },
      { id: "glass-bal-channel", name: "Channel" },
      { id: "glass-bal-standoffs", name: "Standoffs" }
    ]
  },
  {
    id: "aluminium-pool",
    name: "Aluminium Pool Fencing",
    description: "Durable powder-coated aluminium pool fencing solutions",
    variants: [
      { id: "alu-pool-tubular", name: "Tubular Flat Top" },
      { id: "alu-pool-barr", name: "BARR" },
      { id: "alu-pool-blade", name: "Blade" },
      { id: "alu-pool-pik", name: "PIK" }
    ]
  },
  {
    id: "aluminium-balustrade",
    name: "Aluminium Balustrade",
    description: "Aluminium balustrade systems for decks and balconies",
    variants: [
      { id: "alu-bal-barr", name: "Barr" },
      { id: "alu-bal-blade", name: "Blade" },
      { id: "alu-bal-visor", name: "Visor" }
    ]
  },
  {
    id: "general",
    name: "General Fencing",
    description: "Premium fencing options for residential and commercial",
    variants: [
      { id: "general-zeus", name: "Zeus" },
      { id: "general-blade", name: "Blade" },
      { id: "general-barr", name: "Barr" }
    ]
  }
];

export function ProductSelectorMockup() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold" data-testid="text-product-selector-title">
          Select Product Type
        </h2>
        <p className="text-muted-foreground">
          Choose the type of fencing or balustrade you want to configure
        </p>
      </div>

      {/* Product Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {productCategories.map((category) => (
          <Card 
            key={category.id} 
            className="p-6 space-y-4 hover-elevate cursor-pointer transition-all"
            data-testid={`card-product-${category.id}`}
          >
            {/* Category Header */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center justify-between">
                {category.name}
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </h3>
              <p className="text-sm text-muted-foreground">
                {category.description}
              </p>
            </div>

            {/* Variants */}
            <div className="flex flex-wrap gap-2">
              {category.variants.map((variant) => (
                <Badge 
                  key={variant.id}
                  variant={variant.badge === "Current" ? "default" : "outline"}
                  className="cursor-pointer"
                  data-testid={`badge-variant-${variant.id}`}
                >
                  {variant.name}
                  {variant.badge && (
                    <span className="ml-1 text-xs opacity-75">({variant.badge})</span>
                  )}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Info Banner */}
      <Card className="p-4 bg-muted/50 border-dashed">
        <p className="text-sm text-center text-muted-foreground">
          💡 <strong>Mockup Preview:</strong> Click a category to load the appropriate configurator. 
          Glass Balustrade will share similar controls to Pool Fencing, while Aluminium and General Fencing will have unique configuration options.
        </p>
      </Card>
    </div>
  );
}
