import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Download } from "lucide-react";
import { Component } from "@shared/schema";

interface ComponentListProps {
  components: Component[];
  onEmail: () => void;
  onDownload: () => void;
}

export function ComponentList({ components, onEmail, onDownload }: ComponentListProps) {
  const totalQuantity = components.reduce((sum, comp) => sum + comp.qty, 0);

  return (
    <Card className="overflow-hidden" data-testid="component-list">
      <div className="p-6 border-b border-card-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Component List</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {totalQuantity} total components
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onDownload}
              data-testid="button-download-list"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              size="sm"
              onClick={onEmail}
              data-testid="button-email-quote"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Quote
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                QTY
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                SKU
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {components.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                  Configure your fence to see components
                </td>
              </tr>
            ) : (
              components.map((component, index) => (
                <tr
                  key={index}
                  className="hover-elevate"
                  data-testid={`component-${index}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono font-semibold text-lg">
                      {component.qty}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{component.description}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-muted-foreground">
                      {component.sku || "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {components.length > 0 && (
        <div className="px-6 py-4 bg-muted/30 border-t border-card-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Components:</span>
            <span className="text-lg font-mono font-semibold">{totalQuantity}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
