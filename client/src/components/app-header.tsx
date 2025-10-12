import { Sun, Moon, Save, FolderOpen, RotateCcw, Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";

interface AppHeaderProps {
  progress: number;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
  isSaving?: boolean;
}

export function AppHeader({ progress, onSave, onLoad, onReset, isSaving = false }: AppHeaderProps) {
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
              <p className="text-xs text-muted-foreground">Glass Pool Fence Calculator</p>
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
