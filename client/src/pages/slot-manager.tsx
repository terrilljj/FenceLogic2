import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Download, Upload } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";

interface FenceStyle {
  id: string;
  code: string;
  label: string;
  productVariant: string | null;
}

interface ProductSlot {
  id: string;
  internalId: string;
  productVariant: string;
  fieldName: string;
  sequence: number;
  productId: string | null;
  label: string | null;
  isActive: number;
  discriminatorAttributes: Record<string, string> | null;
}

interface Product {
  id: string;
  code: string;
  description: string;
  price: string;
  category: string;
  subcategory: string;
}

// Key-value pair for discriminator attribute editor
interface DiscriminatorPair {
  key: string;
  value: string;
}

export default function SlotManager() {
  const { toast } = useToast();
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [selectedField, setSelectedField] = useState<string>("");
  const [newFieldName, setNewFieldName] = useState<string>("");
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");

  // New slot form state
  const [newInternalId, setNewInternalId] = useState("");
  const [newDiscriminators, setNewDiscriminators] = useState<DiscriminatorPair[]>([{ key: "", value: "" }]);
  const [newProductId, setNewProductId] = useState<string>("");
  const [newLabel, setNewLabel] = useState("");

  // Fetch active styles from DB (replaces hardcoded FIELD_DEFINITIONS)
  const { data: styles = [] } = useQuery<FenceStyle[]>({
    queryKey: ["/api/styles"],
  });

  // Fetch all products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  // Fetch slots for selected variant + field
  const { data: slots = [], isLoading: slotsLoading } = useQuery<ProductSlot[]>({
    queryKey: ["/api/admin/product-slots", selectedVariant, selectedField],
    queryFn: async () => {
      if (!selectedVariant || !selectedField) return [];
      const res = await fetch(`/api/admin/product-slots/${encodeURIComponent(selectedVariant)}/${encodeURIComponent(selectedField)}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      return res.json();
    },
    enabled: !!selectedVariant && !!selectedField,
  });

  // Derive unique fieldNames in use for selected variant
  const { data: allVariantSlots = [] } = useQuery<ProductSlot[]>({
    queryKey: ["/api/admin/product-slots", selectedVariant],
    queryFn: async () => {
      if (!selectedVariant) return [];
      const res = await fetch(`/api/admin/product-slots/${encodeURIComponent(selectedVariant)}`);
      if (!res.ok) throw new Error("Failed to fetch variant slots");
      return res.json();
    },
    enabled: !!selectedVariant,
  });

  const existingFields = Array.from(new Set(allVariantSlots.map(s => s.fieldName))).sort();

  // Auto-generate slots (panel sizes only)
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/product-slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productVariant: selectedVariant, fieldName: selectedField }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate slots");
      }
      return res.json();
    },
    onSuccess: (data: { count: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slots"] });
      toast({ title: "Slots Generated", description: `${data.count} slots created from panel size config` });
    },
    onError: (e: Error) => toast({ title: "Generation Failed", description: e.message, variant: "destructive" }),
  });

  // Update slot (map product)
  const updateMutation = useMutation({
    mutationFn: async ({ id, productId, label }: { id: string; productId: string | null; label: string | null }) => {
      const res = await fetch(`/api/admin/product-slots/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, label, isActive: 1 }),
      });
      if (!res.ok) throw new Error("Failed to update slot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slots"] });
      toast({ title: "Slot Updated", description: "Product mapping saved" });
    },
    onError: (e: Error) => toast({ title: "Update Failed", description: e.message, variant: "destructive" }),
  });

  // Delete slot
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/product-slots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete slot");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slots"] });
      toast({ title: "Slot Deleted" });
    },
    onError: (e: Error) => toast({ title: "Delete Failed", description: e.message, variant: "destructive" }),
  });

  // Manual slot creation
  const createSlotMutation = useMutation({
    mutationFn: async () => {
      const discriminatorAttributes: Record<string, string> = {};
      for (const { key, value } of newDiscriminators) {
        if (key.trim()) discriminatorAttributes[key.trim()] = value.trim();
      }
      const res = await fetch("/api/admin/product-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productVariant: selectedVariant,
          fieldName: selectedField,
          internalId: newInternalId,
          discriminatorAttributes: Object.keys(discriminatorAttributes).length > 0 ? discriminatorAttributes : null,
          productId: newProductId || null,
          label: newLabel || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create slot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slots"] });
      setAddSlotOpen(false);
      setNewInternalId("");
      setNewDiscriminators([{ key: "", value: "" }]);
      setNewProductId("");
      setNewLabel("");
      toast({ title: "Slot Created" });
    },
    onError: (e: Error) => toast({ title: "Create Failed", description: e.message, variant: "destructive" }),
  });

  // CSV import
  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/product-slots/${encodeURIComponent(selectedVariant)}/${encodeURIComponent(selectedField)}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: importCsv }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to import");
      }
      return res.json();
    },
    onSuccess: (data: { upserted: number; skipped: number; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-slots"] });
      setImportOpen(false);
      setImportCsv("");
      const msg = `${data.upserted} upserted, ${data.skipped} skipped${data.errors.length ? `, ${data.errors.length} errors` : ""}`;
      toast({ title: "Import Complete", description: msg });
    },
    onError: (e: Error) => toast({ title: "Import Failed", description: e.message, variant: "destructive" }),
  });

  const handleExport = () => {
    window.open(
      `/api/admin/product-slots/${encodeURIComponent(selectedVariant)}/${encodeURIComponent(selectedField)}/export`,
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2">Slot Manager</h1>
            <p className="text-muted-foreground">
              Map products to discriminator-keyed slots. No code changes needed for new fields or variants.
            </p>
          </div>
          <AdminNav currentPage="slot-manager" />
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl space-y-6">

        {/* Step 1: Select Style */}
        <Card>
          <CardHeader>
            <CardTitle>1. Select Fence Style</CardTitle>
            <CardDescription>Styles are loaded from the database — no code change needed to add a style.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Style</Label>
                <Select value={selectedVariant} onValueChange={(v) => { setSelectedVariant(v); setSelectedField(""); }}>
                  <SelectTrigger data-testid="select-variant">
                    <SelectValue placeholder="Select style..." />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map(s => (
                      <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Select or create field */}
        {selectedVariant && (
          <Card>
            <CardHeader>
              <CardTitle>2. Select Field</CardTitle>
              <CardDescription>
                Choose an existing field, or add a new fieldName for this style.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <Label>Field Name</Label>
                  <Select value={selectedField} onValueChange={setSelectedField}>
                    <SelectTrigger data-testid="select-field">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingFields.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Add new field dialog */}
                <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Field
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Field to {selectedVariant}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        Enter a fieldName (e.g. "spigot-hardware", "gate-hardware"). Slots will be empty until you add them manually.
                      </p>
                      <div>
                        <Label>Field Name</Label>
                        <Input
                          value={newFieldName}
                          onChange={e => setNewFieldName(e.target.value)}
                          placeholder="e.g. spigot-hardware"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          if (!newFieldName.trim()) return;
                          setSelectedField(newFieldName.trim());
                          setNewFieldName("");
                          setAddFieldOpen(false);
                        }}
                        disabled={!newFieldName.trim()}
                      >
                        Create Field
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Slots for selected field */}
        {selectedVariant && selectedField && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle>{selectedField} — Slots</CardTitle>
                  <CardDescription>
                    {slots.length > 0 && (
                      <span className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="outline">{slots.length} total</Badge>
                        <Badge variant="outline">{slots.filter(s => s.productId).length} mapped</Badge>
                        <Badge variant="outline">{slots.filter(s => !s.productId).length} unmapped</Badge>
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={generateMutation.mutate as any}
                    disabled={generateMutation.isPending} data-testid="button-generate-slots">
                    {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Auto-Generate (panel sizes)
                  </Button>

                  {/* Manual slot creation dialog */}
                  <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-slot">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Slot Manually
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Slot to {selectedField}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Internal ID</Label>
                          <Input
                            value={newInternalId}
                            onChange={e => setNewInternalId(e.target.value)}
                            placeholder="e.g. SP-MAD-CD-P"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Unique ID within this field. Used as the import key.</p>
                        </div>

                        <div>
                          <Label>Discriminator Attributes</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Key-value pairs that uniquely identify this slot within the field.
                            e.g. family=madrid, mounting=core-drilled, finish=polished
                          </p>
                          {newDiscriminators.map((pair, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                              <Input
                                placeholder="key (e.g. family)"
                                value={pair.key}
                                onChange={e => {
                                  const next = [...newDiscriminators];
                                  next[i] = { ...next[i], key: e.target.value };
                                  setNewDiscriminators(next);
                                }}
                                className="text-xs"
                              />
                              <Input
                                placeholder="value (e.g. madrid)"
                                value={pair.value}
                                onChange={e => {
                                  const next = [...newDiscriminators];
                                  next[i] = { ...next[i], value: e.target.value };
                                  setNewDiscriminators(next);
                                }}
                                className="text-xs"
                              />
                              {newDiscriminators.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setNewDiscriminators(newDiscriminators.filter((_, j) => j !== i))}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNewDiscriminators([...newDiscriminators, { key: "", value: "" }])}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Add Attribute
                          </Button>
                        </div>

                        <div>
                          <Label>Product (optional — can map later)</Label>
                          <Select value={newProductId} onValueChange={setNewProductId}>
                            <SelectTrigger className="text-xs">
                              <SelectValue placeholder="Select product..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">— unmapped —</SelectItem>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.code} — {p.description}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Label / Notes (optional)</Label>
                          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Madrid Core-Drilled Polished" />
                        </div>

                        <Button
                          onClick={() => createSlotMutation.mutate()}
                          disabled={!newInternalId.trim() || createSlotMutation.isPending}
                        >
                          {createSlotMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Create Slot
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {slots.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>

                      <Dialog open={importOpen} onOpenChange={setImportOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Import Slots CSV</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <p className="text-sm text-muted-foreground">
                              Paste CSV with columns: internal_id, sequence, discriminator_attributes_json, sku, description, cost, retail, status, notes.
                              <br />Import UPSERTs by internal_id. Never deletes rows. Empty sku = unmap slot.
                            </p>
                            <textarea
                              className="w-full h-48 text-xs font-mono border rounded p-2 bg-background"
                              value={importCsv}
                              onChange={e => setImportCsv(e.target.value)}
                              placeholder="Paste CSV here..."
                            />
                            <Button
                              onClick={() => importMutation.mutate()}
                              disabled={!importCsv.trim() || importMutation.isPending}
                            >
                              {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Import
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No slots yet. Use Auto-Generate for panel-size fields or Add Slot Manually for arbitrary discriminators.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Internal ID</TableHead>
                        <TableHead>Discriminator Attributes</TableHead>
                        <TableHead className="w-32">SKU</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">Price</TableHead>
                        <TableHead className="w-64">Map Product</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slots.map(slot => {
                        const mapped = products.find(p => p.id === slot.productId);
                        const discriminatorsDisplay = slot.discriminatorAttributes
                          ? Object.entries(slot.discriminatorAttributes).map(([k, v]) => `${k}=${v}`).join(", ")
                          : "—";
                        return (
                          <TableRow key={slot.id}>
                            <TableCell className="font-mono text-xs font-bold">{slot.internalId}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{discriminatorsDisplay}</TableCell>
                            <TableCell className="font-mono text-xs">{mapped?.code || "—"}</TableCell>
                            <TableCell className="text-xs">{mapped?.description || "—"}</TableCell>
                            <TableCell className="text-xs">{mapped?.price || "—"}</TableCell>
                            <TableCell>
                              <Select
                                value={slot.productId || ""}
                                onValueChange={v => updateMutation.mutate({ id: slot.id, productId: v || null, label: products.find(p => p.id === v)?.description || null })}
                              >
                                <SelectTrigger data-testid={`select-product-${slot.internalId}`} className="h-8 text-xs">
                                  <SelectValue placeholder={mapped ? "Change..." : "Select..."} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">— unmap —</SelectItem>
                                  {products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.description}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(slot.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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
