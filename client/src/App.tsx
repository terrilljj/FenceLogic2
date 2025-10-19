import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Home from "@/pages/home";
import FenceLogic from "@/pages/fence-builder";
import Products from "@/pages/products";
import AdminLogin from "@/pages/admin-login";
import AdminSettings from "@/pages/admin-settings";
import UIConfig from "@/pages/ui-config";
import UIConfigMockup from "@/pages/ui-config-mockup";
import FenceStyles from "@/pages/fence-styles";
import CategoryManager from "@/pages/category-manager";
import SlotManager from "@/pages/slot-manager";
import NotFound from "@/pages/not-found";

// Protected route wrapper for admin pages
function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { data: isAuthenticated, isLoading } = useQuery<{ authenticated: boolean }>({
    queryKey: ["/api/admin/verify"],
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Verifying authentication...</div>
      </div>
    );
  }
  
  if (!isAuthenticated?.authenticated) {
    localStorage.removeItem("isAdminAuthenticated");
    return <Redirect to="/admin-login" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/calculator" component={FenceLogic} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admin-settings">
        {() => <ProtectedRoute component={AdminSettings} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={Products} />}
      </Route>
      <Route path="/ui-config">
        {() => <ProtectedRoute component={UIConfig} />}
      </Route>
      <Route path="/ui-config-mockup">
        {() => <ProtectedRoute component={UIConfigMockup} />}
      </Route>
      <Route path="/fence-styles">
        {() => <ProtectedRoute component={FenceStyles} />}
      </Route>
      <Route path="/categories">
        {() => <ProtectedRoute component={CategoryManager} />}
      </Route>
      <Route path="/slot-manager">
        {() => <ProtectedRoute component={SlotManager} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
