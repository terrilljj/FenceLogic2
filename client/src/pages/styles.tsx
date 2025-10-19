import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { FenceStyle } from "@shared/schema";

export default function StylesList() {
  const { data: styles, isLoading } = useQuery<FenceStyle[]>({
    queryKey: ["/api/admin/styles"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Fence Styles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure calculator settings and product mappings for each fence style
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {styles?.map((style) => (
            <Link key={style.id} href={`/config/${style.code}`}>
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-style-${style.code}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{style.label}</CardTitle>
                      <CardDescription className="mt-1">
                        Code: {style.code}
                      </CardDescription>
                    </div>
                    <Badge variant={style.isActive ? "default" : "secondary"}>
                      {style.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {style.templateId && (
                      <p className="text-sm text-muted-foreground">
                        Template: {style.templateId}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {style.enableGates === 1 && (
                        <Badge variant="outline" className="text-xs">Gates</Badge>
                      )}
                      {style.enableTopRail === 1 && (
                        <Badge variant="outline" className="text-xs">Top Rail</Badge>
                      )}
                      {style.enableHingePanel === 1 && (
                        <Badge variant="outline" className="text-xs">Hinge Panel</Badge>
                      )}
                      {style.enableCustomWidth === 1 && (
                        <Badge variant="outline" className="text-xs">Custom Width</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button variant="ghost" size="sm" data-testid={`button-config-${style.code}`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {(!styles || styles.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No fence styles configured yet.</p>
              <p className="text-sm text-muted-foreground">
                Fence styles are created automatically when you set up the system.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
