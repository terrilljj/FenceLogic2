import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";

// Field definitions for Glass Pool Spigots (Frameless)
type FieldDefinition = {
  fieldName: string;
  label: string;
  defaultSlotCount: number;
};

const FIELD_DEFINITIONS: Record<string, FieldDefinition[]> = {
  "glass-pool-spigots": [
    { fieldName: "glass-panels", label: "Glass Panels", defaultSlotCount: 36 },
    { fieldName: "spigots", label: "Spigots", defaultSlotCount: 20 },
    { fieldName: "master-hinge-panels", label: "Master Hinge Panels", defaultSlotCount: 20 },
    { fieldName: "master-gate-panels", label: "Master Gate Panels", defaultSlotCount: 2 },
    { fieldName: "soft-close-hinge-panels", label: "Soft Close Hinge Panels", defaultSlotCount: 20 },
    { fieldName: "soft-close-gates", label: "Soft Close Gates", defaultSlotCount: 4 },
    { fieldName: "raked-panels", label: "Raked Panels", defaultSlotCount: 5 },
    { fieldName: "gate-hinges-master", label: "Gate Hinges Master", defaultSlotCount: 10 },
    { fieldName: "gate-hinges-soft-close", label: "Gate Hinges Soft Close", defaultSlotCount: 30 },
    { fieldName: "glass-gate-latches", label: "Glass Gate Latches", defaultSlotCount: 30 },
  ],
};

interface ProductSlot {
  id: string;
  internalId: string;
  productVariant: string;
  fieldName: string;
  sequence: number;
  productId: string | null;
  label: string | null;
  isActive: number;
}

interface Product {
  id: string;
  code: string;
  description: string;
  price: string;
  category: string;
  subcategory: string;
}

export default function SlotManager() {
  const { toast } = useToast();
  const [selectedVariant, setSelectedVariant] = useState<string>("glass-pool-spigots");
  const [selectedField, setSelectedField] = useState<string>("");
  const [slotCount, setSlotCount] = useState<number>(0);

  // Fetch all products for mapping
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  // Fetch slots for selected variant and field
  const { data: slots = [], isLoading: slotsLoading } = useQuery<ProductSlot[]>({
    queryKey: ["/api/admin/product-slots", selectedVariant, selectedField],
    enabled: !!selectedVariant && !!selectedField,
  });

  // Generate slots mutation
  const generateSlotsMutation = useMutation({
    mutationFn: async (params: { productVariant: string; fieldName: string; slotCount: number }) => {
      const response = await fetch("/api/admin/product-slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error("Failed to generate slots");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slots"] });
      toast({
        title: "Slots Generated",
        description: `Successfully generated ${slotCount} slots for ${selectedField}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update slot mutation
  const updateSlotMutation = useMutation({
    mutationFn: async ({ id, productId, label }: { id: string; productId: string | null; label: string | null }) => {
      const response = await fetch(`/api/admin/product-slots/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, label, isActive: 1 }),
      });
      if (!response.ok) throw new Error("Failed to update slot");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slots"] });
      toast({
        title: "Slot Updated",
        description: "Product mapping updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFieldSelect = (fieldName: string) => {
    setSelectedField(fieldName);
    const fieldDef = FIELD_DEFINITIONS[selectedVariant]?.find(f => f.fieldName === fieldName);
    if (fieldDef) {
      setSlotCount(fieldDef.defaultSlotCount);
    }
  };

  const handleGenerateSlots = () => {
    if (!selectedField || slotCount < 1) {
      toast({
        title: "Invalid Input",
        description: "Please select a field and enter a valid slot count",
        variant: "destructive",
      });
      return;
    }

    generateSlotsMutation.mutate({
      productVariant: selectedVariant,
      fieldName: selectedField,
      slotCount,
    });
  };

  const handleProductChange = (slotId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    updateSlotMutation.mutate({
      id: slotId,
      productId,
      label: product?.description || null,
    });
  };

  const availableFields = FIELD_DEFINITIONS[selectedVariant] || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Slot Manager</h1>
          <p className="text-muted-foreground">
            Manage product slots with internal IDs for self-service catalog updates
          </p>
        </div>

        {/* Variant Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Product Variant</CardTitle>
            <CardDescription>Select the fence style to manage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <Label>Fence Style</Label>
                <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                  <SelectTrigger data-testid="select-variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="glass-pool-spigots">Glass Pool Fence - Frameless Spigots</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Field Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Field Configuration</CardTitle>
            <CardDescription>Configure slot count for each field type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Field Type</Label>
                  <Select value={selectedField} onValueChange={handleFieldSelect}>
                    <SelectTrigger data-testid="select-field">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((field: FieldDefinition) => (
                        <SelectItem key={field.fieldName} value={field.fieldName}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Number of Slots</Label>
                  <Input
                    type="number"
                    value={slotCount || ""}
                    onChange={(e) => setSlotCount(parseInt(e.target.value) || 0)}
                    min={1}
                    placeholder="36"
                    data-testid="input-slot-count"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleGenerateSlots}
                    disabled={!selectedField || slotCount < 1 || generateSlotsMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-slots"
                  >
                    {generateSlotsMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Generate Slots
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {selectedField && slots.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <Badge variant="outline">{slots.length} slots configured</Badge>
                  {" · "}
                  <Badge variant="outline">
                    {slots.filter(s => s.productId).length} mapped
                  </Badge>
                  {" · "}
                  <Badge variant="outline">
                    {slots.filter(s => !s.productId).length} unmapped
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Slot List */}
        {selectedField && (
          <Card>
            <CardHeader>
              <CardTitle>
                {availableFields.find(f => f.fieldName === selectedField)?.label || selectedField} Slots
              </CardTitle>
              <CardDescription>
                Map internal IDs to products. Add products via CSV upload or select manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No slots configured yet. Click "Generate Slots" to create them.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Internal ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slots.map((slot) => {
                        const mappedProduct = products.find(p => p.id === slot.productId);
                        return (
                          <TableRow key={slot.id}>
                            <TableCell className="font-mono font-bold">
                              {slot.internalId}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={slot.productId || ""}
                                onValueChange={(value) => handleProductChange(slot.id, value)}
                              >
                                <SelectTrigger data-testid={`select-product-${slot.internalId}`}>
                                  <SelectValue placeholder="Select product..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((product: Product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {mappedProduct?.code || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {mappedProduct?.price || "—"}
                            </TableCell>
                            <TableCell>
                              {slot.productId ? (
                                <Badge variant="default">Mapped</Badge>
                              ) : (
                                <Badge variant="outline">Unmapped</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
