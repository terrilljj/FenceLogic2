import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, Package, Wrench, DoorOpen, Sparkles } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";

export default function UIConfigMockup() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    panels: true,
    spigots: true,
    gates: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">UI Configuration (Mockup)</h1>
              <p className="text-muted-foreground">
                Hierarchical, brand-based configuration preview
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              Preview Only - Not Functional
            </Badge>
          </div>
          <AdminNav currentPage="ui-config-mockup" />
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-6xl">

      {/* Product Variant Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Fence Style</CardTitle>
          <CardDescription>Choose the fence variant to configure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="default">Glass Pool Fence - Frameless Spigots</Button>
            <Button variant="outline">Glass Pool Fence - Channel</Button>
            <Button variant="outline">Glass Balustrade - Spigots</Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Configuration Sections */}
      <div className="space-y-4">
        
        {/* Panel Configuration */}
        <Card>
          <CardHeader 
            className="cursor-pointer hover-elevate" 
            onClick={() => toggleSection('panels')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSections.panels ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Panel Configuration</CardTitle>
                  <CardDescription>Define available panel types and sizes</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">3 panel types</Badge>
                <Badge variant="outline">83 total slots</Badge>
              </div>
            </div>
          </CardHeader>
          
          {expandedSections.panels && (
            <CardContent className="space-y-4">
              
              {/* Standard Glass Panels */}
              <div className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <h3 className="font-semibold">Standard Glass Panels</h3>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" data-testid="button-edit-standard-panels">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="button-delete-standard-panels">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Available Sizes:</span>
                    <p className="font-mono mt-1">250, 300, 350, 400...1950, 2000mm</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SKU Slots:</span>
                    <p className="font-semibold mt-1">36 slots (GP-0250 to GP-2000)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Increment:</span>
                    <p className="font-mono mt-1">50mm</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slot Prefix:</span>
                    <p className="font-mono mt-1">GP</p>
                  </div>
                </div>
              </div>

              {/* Gate Panels */}
              <div className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <h3 className="font-semibold">Gate Panels</h3>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" data-testid="button-edit-gate-panels">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="button-delete-gate-panels">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Available Sizes:</span>
                    <p className="font-mono mt-1">800, 900, 1000, 1100mm</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SKU Slots:</span>
                    <p className="font-semibold mt-1">4 slots (GGP-0800 to GGP-1100)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mode:</span>
                    <p className="font-mono mt-1">Custom List</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slot Prefix:</span>
                    <p className="font-mono mt-1">GGP</p>
                  </div>
                </div>
              </div>

              {/* Hinge Panels */}
              <div className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <h3 className="font-semibold">Hinge Panels (Soft Close Gates)</h3>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" data-testid="button-edit-hinge-panels">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="button-delete-hinge-panels">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Available Sizes:</span>
                    <p className="font-mono mt-1">600, 800, 1000, 1100, 1200-1800mm</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SKU Slots:</span>
                    <p className="font-semibold mt-1">11 slots (HP-0600 to HP-1800)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mode:</span>
                    <p className="font-mono mt-1">Custom List (with gaps)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slot Prefix:</span>
                    <p className="font-mono mt-1">HP</p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />
              <Button variant="outline" className="w-full" data-testid="button-add-panel-type">
                <Plus className="h-4 w-4 mr-2" />
                Add Panel Type
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Spigot Configuration */}
        <Card>
          <CardHeader 
            className="cursor-pointer hover-elevate" 
            onClick={() => toggleSection('spigots')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSections.spigots ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <Wrench className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Spigot Configuration</CardTitle>
                  <CardDescription>Brand-based spigot options and variants</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">2 brands</Badge>
                <Badge variant="outline">10 total slots</Badge>
              </div>
            </div>
          </CardHeader>
          
          {expandedSections.spigots && (
            <CardContent className="space-y-4">
              
              {/* Standard Base Plate Spigot */}
              <div className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <h3 className="font-semibold">Standard Base Plate Spigot</h3>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" data-testid="button-edit-standard-spigot">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="button-delete-standard-spigot">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Available Colors:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Polished</Badge>
                      <Badge variant="outline">Satin</Badge>
                      <Badge variant="outline">Black</Badge>
                      <Badge variant="outline">White</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mounting Types:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Base Plate</Badge>
                      <Badge variant="outline">Core Drilled</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SKU Slots:</span>
                    <p className="font-semibold mt-1">8 slots (4 colors × 2 mounts)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slot Prefix:</span>
                    <p className="font-mono mt-1">SPS</p>
                  </div>
                </div>
              </div>

              {/* Polaris Spigot System */}
              <div className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-cyan-500" />
                    <h3 className="font-semibold">Polaris Spigot System</h3>
                    <Badge variant="secondary">Active</Badge>
                    <Badge variant="outline" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" data-testid="button-edit-polaris-spigot">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="button-delete-polaris-spigot">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Available Colors:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Satin</Badge>
                      <Badge variant="outline" className="opacity-50">Polished (unavailable)</Badge>
                      <Badge variant="outline" className="opacity-50">Black (unavailable)</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mounting Types:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Base Plate</Badge>
                      <Badge variant="outline">Core Drilled</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SKU Slots:</span>
                    <p className="font-semibold mt-1">2 slots (1 color × 2 mounts)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slot Prefix:</span>
                    <p className="font-mono mt-1">SPP</p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />
              <Button variant="outline" className="w-full" data-testid="button-add-spigot-brand">
                <Plus className="h-4 w-4 mr-2" />
                Add Spigot Brand/Model
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Gate Hardware */}
        <Card>
          <CardHeader 
            className="cursor-pointer hover-elevate" 
            onClick={() => toggleSection('gates')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSections.gates ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <DoorOpen className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Gate Hardware</CardTitle>
                  <CardDescription>Self-closing and soft-close gate systems by brand</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">2 brands</Badge>
                <Badge variant="outline">8 total slots</Badge>
              </div>
            </div>
          </CardHeader>
          
          {expandedSections.gates && (
            <CardContent className="space-y-4">
              
              {/* Polaris Gate Master */}
              <div className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-pink-500" />
                    <h3 className="font-semibold">Polaris Gate Master</h3>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" data-testid="button-edit-polaris-gate">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="button-delete-polaris-gate">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Gate Types:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Self-closing</Badge>
                      <Badge variant="outline">Soft-close</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available Colors:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Satin</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Compatible Panels:</span>
                    <p className="font-mono mt-1">Hinge Panels (600-1800mm)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SKU Slots:</span>
                    <p className="font-semibold mt-1">2 slots (2 types × 1 color)</p>
                  </div>
                </div>
              </div>

              {/* Atlantic Gate System */}
              <div className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-teal-500" />
                    <h3 className="font-semibold">Atlantic Gate System</h3>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" data-testid="button-edit-atlantic-gate">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="button-delete-atlantic-gate">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Gate Types:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Standard</Badge>
                      <Badge variant="outline">Deluxe</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available Colors:</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Polished</Badge>
                      <Badge variant="outline">Satin</Badge>
                      <Badge variant="outline">Black</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Compatible Panels:</span>
                    <p className="font-mono mt-1">Hinge Panels (600-1800mm)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SKU Slots:</span>
                    <p className="font-semibold mt-1">6 slots (2 types × 3 colors)</p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />
              <Button variant="outline" className="w-full" data-testid="button-add-gate-brand">
                <Plus className="h-4 w-4 mr-2" />
                Add Gate Hardware Brand
              </Button>
            </CardContent>
          )}
        </Card>

      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4">
        <Button size="lg" data-testid="button-save-config">
          Save Configuration
        </Button>
        <Button size="lg" variant="outline" data-testid="button-preview-calculator">
          Preview in Calculator
        </Button>
        <Button size="lg" variant="outline" data-testid="button-generate-slots">
          Generate All Slots
        </Button>
      </div>
    </div>
    </div>
  );
}
