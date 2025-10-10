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
    description: "Premium frameless glass pool fencing with spigot mounting",
    variants: [
      { id: "glass-pool-standard", name: "Standard Pool Fencing", badge: "Current" }
    ]
  },
  {
    id: "glass-balustrade",
    name: "Glass Balustrade",
    description: "Glass balustrade systems for decks, balconies, and stairs",
    variants: [
      { id: "frameless", name: "Frameless" },
      { id: "semi-frameless", name: "Semi-Frameless" },
      { id: "juliet", name: "Juliet Balcony" },
      { id: "channel", name: "Channel System" }
    ]
  },
  {
    id: "aluminium",
    name: "Aluminium Pool Fencing",
    description: "Durable powder-coated aluminium fencing solutions",
    variants: [
      { id: "slat", name: "Slat Style" },
      { id: "tube", name: "Tube Style" },
      { id: "privacy", name: "Privacy Screen" }
    ]
  },
  {
    id: "general",
    name: "General Fencing",
    description: "Traditional fencing options for residential and commercial",
    variants: [
      { id: "colorbond", name: "Colorbond" },
      { id: "timber", name: "Timber" },
      { id: "composite", name: "Composite" }
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
