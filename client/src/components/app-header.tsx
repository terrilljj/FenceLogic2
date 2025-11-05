import { Sun, Moon, Save, FolderOpen, RotateCcw, Loader2, Home, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import type { ProductVariant } from "@shared/schema";

// Helper function to get display name for product variant
function getProductDisplayName(variant: ProductVariant): string {
  const productMap: Record<ProductVariant, string> = {
    "glass-pool-spigots": "Glass Pool - Spigots",
    "glass-pool-channel": "Glass Pool - Channel",
    "glass-bal-spigots": "Glass Balustrade - Spigots",
    "glass-bal-channel": "Glass Balustrade - Channel",
    "glass-bal-standoffs": "Glass Balustrade - Standoffs",
    "alu-pool-barr": "Aluminium Pool - BARR",
    "alu-pool-blade": "Aluminium Pool - Blade",
    "alu-pool-tubular": "Aluminium Pool - Tubular Flat Top",
    "alu-pool-pik": "Aluminium Pool - PIK",
    "alu-bal-barr": "Aluminium Balustrade - BARR",
    "alu-bal-blade": "Aluminium Balustrade - Blade",
    "alu-bal-visor": "Aluminium Balustrade - Visor",
    "pvc-hamptons-full-privacy": "Hamptons PVC - Full Privacy",
    "pvc-hamptons-combo": "Hamptons PVC - Combo",
    "pvc-hamptons-vertical-paling": "Hamptons PVC - Vertical Paling",
    "pvc-hamptons-semi-privacy": "Hamptons PVC - Semi Privacy",
    "pvc-hamptons-3rail": "Hamptons PVC - 3 Rail",
    "general-zeus": "General Fencing - Zeus",
    "general-blade": "General Fencing - Blade",
    "general-barr": "General Fencing - BARR",
    "custom-panel-designer": "Custom Panel Designer (BETA)",
    "custom-glass": "Custom Glass",
    "custom-frameless": "Custom Frameless Spigots",
  };
  
  return productMap[variant] || "Glass Pool Fence Calculator";
}

interface AppHeaderProps {
  progress: number;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
  onDownloadPDF?: () => void;
  isSaving?: boolean;
  productVariant?: ProductVariant;
}

export function AppHeader({ progress, onSave, onLoad, onReset, onDownloadPDF, isSaving = false, productVariant }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between p-4 gap-6">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-md bg-primary flex items-center justify-center cursor-pointer hover-elevate active-elevate-2 transition-all"
              onClick={() => setLocation("/")}
              data-testid="button-logo-home"
            >
              <span className="text-primary-foreground font-bold text-lg">FL</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Fence Logic</h1>
              <p className="text-xs text-muted-foreground">
                {productVariant ? getProductDisplayName(productVariant) : "Glass Pool Fence Calculator"}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 flex-1 max-w-md">
            <Progress value={progress} className="flex-1" data-testid="progress-indicator" />
            <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">
              {progress}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation("/")}
            data-testid="button-home"
          >
            <Home className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Home</span>
          </Button>
          {onDownloadPDF && (
            <Button
              size="sm"
              variant="default"
              onClick={onDownloadPDF}
              data-testid="button-download-pdf"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            data-testid="button-reset"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onLoad}
            data-testid="button-load"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Load</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSave}
            disabled={isSaving}
            data-testid="button-save"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
