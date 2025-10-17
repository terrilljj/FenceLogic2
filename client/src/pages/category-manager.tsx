import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { insertCategorySchema, insertSubcategorySchema, type Category, type Subcategory, type InsertCategory, type InsertSubcategory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, LogOut, ArrowLeft, Package, Settings } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CategoryManager() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [deleteSubcategory, setDeleteSubcategory] = useState<Subcategory | null>(null);

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

  const categoryForm = useForm<InsertCategory>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: "",
      displayOrder: 0,
    },
  });

  const subcategoryForm = useForm<InsertSubcategory>({
    resolver: zodResolver(insertSubcategorySchema),
    defaultValues: {
      categoryId: "",
      name: "",
      displayOrder: 0,
    },
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
  });

  const { data: subcategories = [], isLoading: subcategoriesLoading } = useQuery<Subcategory[]>({
    queryKey: ["/api/admin/subcategories"],
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: InsertCategory) => apiRequest("POST", "/api/admin/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create category",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertCategory }) =>
      apiRequest("PUT", `/api/admin/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update category",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-configs"] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      setDeleteCategory(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete category",
      });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: (data: InsertSubcategory) => apiRequest("POST", "/api/admin/subcategories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcategories"] });
      toast({
        title: "Success",
        description: "Subcategory created successfully",
      });
      setIsSubcategoryDialogOpen(false);
      subcategoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create subcategory",
      });
    },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertSubcategory }) =>
      apiRequest("PUT", `/api/admin/subcategories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcategories"] });
      toast({
        title: "Success",
        description: "Subcategory updated successfully",
      });
      setIsSubcategoryDialogOpen(false);
      setEditingSubcategory(null);
      subcategoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update subcategory",
      });
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/subcategories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-configs"] });
      toast({
        title: "Success",
        description: "Subcategory deleted successfully",
      });
      setDeleteSubcategory(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete subcategory",
      });
    },
  });

  const openCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      categoryForm.reset({
        name: category.name,
        displayOrder: category.displayOrder,
      });
    } else {
      setEditingCategory(null);
      categoryForm.reset({
        name: "",
        displayOrder: categories.length,
      });
    }
    setIsCategoryDialogOpen(true);
  };

  const openSubcategoryDialog = (subcategory?: Subcategory) => {
    if (subcategory) {
      setEditingSubcategory(subcategory);
      subcategoryForm.reset({
        categoryId: subcategory.categoryId || "",
        name: subcategory.name,
        displayOrder: subcategory.displayOrder,
      });
    } else {
      setEditingSubcategory(null);
      subcategoryForm.reset({
        categoryId: categories.length > 0 ? categories[0].id : "",
        name: "",
        displayOrder: subcategories.length,
      });
    }
    setIsSubcategoryDialogOpen(true);
  };

  const onCategorySubmit = (data: InsertCategory) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const onSubcategorySubmit = (data: InsertSubcategory) => {
    if (editingSubcategory) {
      updateSubcategoryMutation.mutate({ id: editingSubcategory.id, data });
    } else {
      createSubcategoryMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/products")}
              data-testid="button-back-products"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Category Manager</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ui-config">
              <Button variant="outline" size="sm" data-testid="button-ui-config">
                <Settings className="h-4 w-4 mr-2" />
                UI Config
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
            <TabsTrigger value="subcategories" data-testid="tab-subcategories">Subcategories</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>
                      Manage product categories used in the fence calculator
                    </CardDescription>
                  </div>
                  <Button onClick={() => openCategoryDialog()} data-testid="button-add-category">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No categories found. Add your first category.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-32">Display Order</TableHead>
                        <TableHead className="w-32 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                          <TableCell data-testid={`text-category-name-${category.id}`}>
                            {category.name}
                          </TableCell>
                          <TableCell data-testid={`text-category-order-${category.id}`}>
                            {category.displayOrder}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCategoryDialog(category)}
                                data-testid={`button-edit-category-${category.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteCategory(category)}
                                data-testid={`button-delete-category-${category.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subcategories" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subcategories</CardTitle>
                    <CardDescription>
                      Manage product subcategories used in the fence calculator
                    </CardDescription>
                  </div>
                  <Button onClick={() => openSubcategoryDialog()} data-testid="button-add-subcategory">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subcategory
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {subcategoriesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading subcategories...</div>
                ) : subcategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No subcategories found. Add your first subcategory.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category (Fence Style)</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-32">Display Order</TableHead>
                        <TableHead className="w-32 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subcategories.map((subcategory) => {
                        const category = categories.find(c => c.id === subcategory.categoryId);
                        return (
                        <TableRow key={subcategory.id} data-testid={`row-subcategory-${subcategory.id}`}>
                          <TableCell data-testid={`text-subcategory-category-${subcategory.id}`}>
                            {category?.name || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-subcategory-name-${subcategory.id}`}>
                            {subcategory.name}
                          </TableCell>
                          <TableCell data-testid={`text-subcategory-order-${subcategory.id}`}>
                            {subcategory.displayOrder}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openSubcategoryDialog(subcategory)}
                                data-testid={`button-edit-subcategory-${subcategory.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteSubcategory(subcategory)}
                                data-testid={`button-delete-subcategory-${subcategory.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent data-testid="dialog-category">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the category details" : "Create a new category"}
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Frameless Pool Fence" data-testid="input-category-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-category-order"
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
                  onClick={() => setIsCategoryDialogOpen(false)}
                  data-testid="button-cancel-category"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  data-testid="button-save-category"
                >
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
        <DialogContent data-testid="dialog-subcategory">
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? "Edit Subcategory" : "Add Subcategory"}</DialogTitle>
            <DialogDescription>
              {editingSubcategory ? "Update the subcategory details" : "Create a new subcategory"}
            </DialogDescription>
          </DialogHeader>
          <Form {...subcategoryForm}>
            <form onSubmit={subcategoryForm.handleSubmit(onSubcategorySubmit)} className="space-y-4">
              <FormField
                control={subcategoryForm.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Fence Style)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-subcategory-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={subcategoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Raked Panels" data-testid="input-subcategory-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={subcategoryForm.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-subcategory-order"
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
                  onClick={() => setIsSubcategoryDialogOpen(false)}
                  data-testid="button-cancel-subcategory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createSubcategoryMutation.isPending || updateSubcategoryMutation.isPending}
                  data-testid="button-save-subcategory"
                >
                  {editingSubcategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCategory?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategory && deleteCategoryMutation.mutate(deleteCategory.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-category"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Subcategory Confirmation */}
      <AlertDialog open={!!deleteSubcategory} onOpenChange={() => setDeleteSubcategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subcategory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSubcategory?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-subcategory">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSubcategory && deleteSubcategoryMutation.mutate(deleteSubcategory.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-subcategory"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
