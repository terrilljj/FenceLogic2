import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, Settings, Layers, LogOut, Sliders, Eye, Fence, FileSpreadsheet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminNavProps {
  currentPage?: "products" | "categories" | "ui-config" | "ui-config-mockup" | "slot-manager" | "admin-settings" | "fence-styles" | "templates";
}

export function AdminNav({ currentPage }: AdminNavProps) {
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/admin/logout");
      localStorage.removeItem("isAdminAuthenticated");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      window.location.href = "/admin-login";
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "Failed to logout",
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href="/products">
        <Button
          variant={currentPage === "products" ? "default" : "outline"}
          size="sm"
          data-testid="nav-products"
        >
          <Package className="h-4 w-4 mr-2" />
          Products
        </Button>
      </Link>
      <Link href="/categories">
        <Button
          variant={currentPage === "categories" ? "default" : "outline"}
          size="sm"
          data-testid="nav-categories"
        >
          <Layers className="h-4 w-4 mr-2" />
          Categories
        </Button>
      </Link>
      <Link href="/ui-config">
        <Button
          variant={currentPage === "ui-config" ? "default" : "outline"}
          size="sm"
          data-testid="nav-ui-config"
        >
          <Settings className="h-4 w-4 mr-2" />
          UI Config
        </Button>
      </Link>
      <Link href="/styles">
        <Button
          variant={currentPage === "fence-styles" ? "default" : "outline"}
          size="sm"
          data-testid="nav-fence-styles"
        >
          <Fence className="h-4 w-4 mr-2" />
          Styles
        </Button>
      </Link>
      <Link href="/slot-manager">
        <Button
          variant={currentPage === "slot-manager" ? "default" : "outline"}
          size="sm"
          data-testid="nav-slot-manager"
        >
          <Sliders className="h-4 w-4 mr-2" />
          Slot Manager
        </Button>
      </Link>
      <Link href="/templates">
        <Button
          variant={currentPage === "templates" ? "default" : "outline"}
          size="sm"
          data-testid="nav-templates"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Templates
        </Button>
      </Link>
      <Link href="/admin-settings">
        <Button
          variant={currentPage === "admin-settings" ? "default" : "outline"}
          size="sm"
          data-testid="nav-admin-settings"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        data-testid="nav-logout"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Logout
      </Button>
    </div>
  );
}
