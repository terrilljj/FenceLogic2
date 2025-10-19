import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { insertProductSchema, type Product, type InsertProduct, PRODUCT_CATEGORIES, PRODUCT_SUBCATEGORIES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Package, Download, Upload, FileSpreadsheet, LogOut, Settings, Layers, Search, Filter, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SheetsSyncDialog } from "@/components/sheets-sync-dialog";
import { AdminNav } from "@/components/admin-nav";

export default function Products() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{productId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/admin/logout");
      localStorage.removeItem("isAdminAuthenticated");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      setLocation("/admin-login");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout",
      });
    }
  };

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      code: "",
      description: "",
      category: "",
      subcategory: "",
      price: "",
      weight: "",
      dimensions: "",
      units: "",
      tags: [],
      notes: "",
      imageUrl: "",
      active: 1,
    },
  });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  
  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter (code or description)
      const matchesSearch = searchQuery === "" || 
        product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Category filter
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      
      // Subcategory filter
      const matchesSubcategory = subcategoryFilter === "all" || product.subcategory === subcategoryFilter;
      
      // Status filter
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && product.active === 1) ||
        (statusFilter === "inactive" && product.active === 0);
      
      return matchesSearch && matchesCategory && matchesSubcategory && matchesStatus;
    });
  }, [products, searchQuery, categoryFilter, subcategoryFilter, statusFilter]);
  
  // Get unique categories and subcategories from products for filter dropdowns
  const uniqueCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);
  
  const uniqueSubcategories = useMemo(() => {
    const subcats = new Set(products.map(p => p.subcategory).filter(Boolean));
    return Array.from(subcats).sort();
  }, [products]);

  const createMutation = useMutation({
    mutationFn: (data: InsertProduct) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create product",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertProduct }) =>
      apiRequest("PATCH", `/api/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update product",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      setDeleteProduct(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete product",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (csvData: string) =>
      apiRequest("POST", "/api/products/csv/import", { csvData }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.success} products. ${data.failed > 0 ? `${data.failed} failed.` : ""}`,
      });
      if (data.errors && data.errors.length > 0) {
        console.error("Import errors:", data.errors);
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import products",
      });
    },
  });

  const handleDownloadTemplate = () => {
    window.open("/api/products/csv/template", "_blank");
  };

  const handleExport = () => {
    window.open("/api/products/csv/export", "_blank");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      importMutation.mutate(csvData);
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      // Only set category if it's in the predefined list, otherwise empty string
      const category = product.category && PRODUCT_CATEGORIES.includes(product.category as any) 
        ? product.category 
        : "";
      form.reset({
        code: product.code,
        description: product.description,
        category: category as any,
        subcategory: product.subcategory ?? "",
        price: product.price ?? "",
        weight: product.weight ?? "",
        dimensions: product.dimensions ?? "",
        units: product.units ?? "",
        tags: product.tags ?? [],
        notes: product.notes ?? "",
        imageUrl: product.imageUrl ?? "",
        active: product.active,
      });
    } else {
      setEditingProduct(null);
      form.reset({
        code: "",
        description: "",
        category: "" as any,
        subcategory: "",
        price: "",
        weight: "",
        dimensions: "",
        units: "",
        tags: [],
        notes: "",
        imageUrl: "",
        active: 1,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: InsertProduct) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deleteProduct) {
      deleteMutation.mutate(deleteProduct.id);
    }
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setStatusFilter("all");
  };
  
  // Inline editing handlers
  const startEditing = (productId: string, field: string, currentValue: any) => {
    setEditingCell({ productId, field });
    setEditValue(currentValue?.toString() || "");
  };
  
  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue("");
  };
  
  const saveInlineEdit = async (product: Product) => {
    if (!editingCell) return;
    
    const field = editingCell.field;
    let value: any = editValue;
    
    // Convert to appropriate type
    if (field === "active") {
      value = editValue === "Active" ? 1 : 0;
    }
    
    try {
      // Build full InsertProduct payload from existing product
      // Only include valid category if it's in the allowed list, otherwise empty string
      const validCategory = product.category && PRODUCT_CATEGORIES.includes(product.category as any) 
        ? product.category 
        : "";
      
      const fullPayload: InsertProduct = {
        code: product.code,
        description: product.description,
        category: validCategory as any,
        subcategory: product.subcategory || "",
        price: product.price || "",
        weight: product.weight || "",
        dimensions: product.dimensions || "",
        units: product.units || "",
        tags: product.tags || [],
        notes: product.notes || "",
        imageUrl: product.imageUrl || "",
        active: product.active,
        // Override with the edited field
        [field]: value,
      };
      
      await updateMutation.mutateAsync({
        id: product.id,
        data: fullPayload,
      });
      
      toast({
        title: "Updated",
        description: `${field} updated successfully`,
      });
      
      cancelEditing();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update product",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" data-testid="text-products-title">
                <Package className="w-8 h-8" />
                Product Catalog
              </h1>
              <p className="text-muted-foreground">
                Manage your product codes, descriptions, and pricing
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                data-testid="button-download-template"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                CSV Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={products.length === 0}
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                data-testid="button-import-csv"
              >
                <Upload className="w-4 h-4 mr-2" />
                {importMutation.isPending ? "Importing..." : "Import CSV"}
              </Button>
              <SheetsSyncDialog />
              <Button
                size="sm"
                onClick={() => handleOpenDialog()}
                data-testid="button-add-product"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
          <AdminNav currentPage="products" />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
        data-testid="input-file-upload"
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>
              Showing {filteredProducts.length} of {products.length} product{products.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            {products.length > 0 && (
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by code or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-products"
                    />
                  </div>
                  
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-filter-subcategory">
                      <SelectValue placeholder="All Subcategories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subcategories</SelectItem>
                      {uniqueSubcategories.map((subcat) => (
                        <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {(searchQuery || categoryFilter !== "all" || subcategoryFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      data-testid="button-clear-filters"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No products yet</p>
                <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-product">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Product
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subcategory</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No products match your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                      <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                        <TableCell className="font-medium" data-testid={`text-code-${product.id}`}>
                          {product.code}
                        </TableCell>
                        <TableCell 
                          data-testid={`text-description-${product.id}`}
                          onDoubleClick={() => startEditing(product.id, "description", product.description)}
                          className="cursor-pointer hover:bg-muted/50 max-w-md"
                        >
                          {editingCell?.productId === product.id && editingCell?.field === "description" ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveInlineEdit(product);
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                autoFocus
                                className="h-7"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={() => saveInlineEdit(product)}
                              >
                                ✓
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={cancelEditing}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <span className="block truncate">{product.description}</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-category-${product.id}`}>
                          {product.category || "-"}
                        </TableCell>
                        <TableCell data-testid={`text-subcategory-${product.id}`}>
                          {product.subcategory || "-"}
                        </TableCell>
                        <TableCell 
                          data-testid={`text-price-${product.id}`}
                          onDoubleClick={() => startEditing(product.id, "price", product.price)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          {editingCell?.productId === product.id && editingCell?.field === "price" ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveInlineEdit(product);
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                autoFocus
                                className="h-7 w-24"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={() => saveInlineEdit(product)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={cancelEditing}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <span className="block">{product.price || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-weight-${product.id}`}>
                          {product.weight || "-"}
                        </TableCell>
                        <TableCell data-testid={`text-units-${product.id}`}>
                          {product.units || "-"}
                        </TableCell>
                        <TableCell data-testid={`text-status-${product.id}`}>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                              product.active
                                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
                            }`}
                          >
                            {product.active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(product)}
                              data-testid={`button-edit-${product.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteProduct(product)}
                              data-testid={`button-delete-${product.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-product-form">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update the product information below"
                : "Enter the product details below"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., GP-1200-1000-12"
                        {...field}
                        data-testid="input-product-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Glass Panel 1200mm x 1000mm (12mm thick)"
                        {...field}
                        data-testid="input-product-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-product-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subcategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategory (Optional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-product-subcategory">
                            <SelectValue placeholder="Select subcategory" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_SUBCATEGORIES.map((subcategory) => (
                            <SelectItem key={subcategory} value={subcategory}>
                              {subcategory}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., $450.00"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-product-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-product-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Active</SelectItem>
                          <SelectItem value="0">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 5kg, 12.5 lbs"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-product-weight"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dimensions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dimensions (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 1200mm x 100mm x 50mm"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-product-dimensions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Units (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., each, meter, set"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-product-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-product-imageurl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., pool, glass, spigots (comma-separated)"
                        value={field.value?.join(", ") ?? ""}
                        onChange={(e) => {
                          const tags = e.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter((tag) => tag !== "");
                          field.onChange(tags);
                        }}
                        data-testid="input-product-tags"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes or comments..."
                        {...field}
                        value={field.value ?? ""}
                        rows={3}
                        data-testid="input-product-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-product"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-product"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingProduct
                    ? "Update Product"
                    : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProduct?.code}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
