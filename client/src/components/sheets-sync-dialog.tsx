import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SyncSummary = {
  products: {
    added: number;
    updated: number;
    deactivated: number;
  };
  uiConfigs: {
    variantsUpdated: number;
  };
};

type SyncResult = {
  summary: SyncSummary;
  errors: Array<{ row: number; message: string }>;
  samples?: {
    addedProducts?: any[];
    updatedProducts?: any[];
    deactivatedProducts?: string[];
  };
};

export function SheetsSyncDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [diffResult, setDiffResult] = useState<SyncResult | null>(null);

  // Dry run mutation
  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/sheets/pull?dryRun=1');
      return res.json();
    },
    onSuccess: (data) => {
      setDiffResult(data);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Sync Preview Failed",
        description: error.message || "Could not fetch sync preview",
      });
    },
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/sheets/pull?dryRun=0');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync Complete",
        description: "Successfully synced data from Google Sheets",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ui-configs'] });
      setOpen(false);
      setDiffResult(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message || "Failed to apply sync",
      });
    },
  });

  const handleOpen = () => {
    setOpen(true);
    setDiffResult(null);
    dryRunMutation.mutate();
  };

  const handleApply = () => {
    applyMutation.mutate();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        data-testid="button-sync-sheets"
      >
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        Sync from Google Sheets
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Google Sheets Sync Preview</DialogTitle>
            <DialogDescription>
              Review changes before applying them to the database
            </DialogDescription>
          </DialogHeader>

          {dryRunMutation.isPending && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading sync preview...</span>
            </div>
          )}

          {diffResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Products</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Added:</span>
                      <Badge variant="default">{diffResult.summary.products.added}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Updated:</span>
                      <Badge variant="secondary">{diffResult.summary.products.updated}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Deactivated:</span>
                      <Badge variant="destructive">{diffResult.summary.products.deactivated}</Badge>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">UI Configs</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Variants Updated:</span>
                      <Badge variant="default">{diffResult.summary.uiConfigs.variantsUpdated}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {diffResult.errors && diffResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Validation Errors ({diffResult.errors.length})</div>
                    <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                      {diffResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>Row {err.row}: {err.message}</li>
                      ))}
                      {diffResult.errors.length > 5 && (
                        <li className="text-muted-foreground">... and {diffResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Samples */}
              {diffResult.samples && (
                <div className="space-y-3">
                  {diffResult.samples.addedProducts && diffResult.samples.addedProducts.length > 0 && (
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm mb-2">Sample New Products (first 5)</h4>
                      <ul className="text-sm space-y-1">
                        {diffResult.samples.addedProducts.map((p: any, i: number) => (
                          <li key={i} className="text-muted-foreground">
                            {p.code} - {p.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diffResult.samples.deactivatedProducts && diffResult.samples.deactivatedProducts.length > 0 && (
                    <div className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm mb-2">Products to Deactivate (first 5)</h4>
                      <ul className="text-sm space-y-1">
                        {diffResult.samples.deactivatedProducts.map((code: string, i: number) => (
                          <li key={i} className="text-destructive">
                            {code}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={applyMutation.isPending}
              data-testid="button-cancel-sync"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={
                !diffResult ||
                applyMutation.isPending ||
                (diffResult.errors && diffResult.errors.length > 0) ||
                (diffResult.summary.products.added === 0 && 
                 diffResult.summary.products.updated === 0 && 
                 diffResult.summary.products.deactivated === 0 &&
                 diffResult.summary.uiConfigs.variantsUpdated === 0)
              }
              data-testid="button-apply-sync"
            >
              {applyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
