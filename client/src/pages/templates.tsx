import { useState, useRef } from "react";
import { Download, FileDown, FolderArchive, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AdminNav } from "@/components/admin-nav";
import { apiRequest } from "@/lib/queryClient";

const TEMPLATES = [
  { 
    id: "01-pool-spigots", 
    name: "Pool Fence - Spigots", 
    filename: "01-pool-spigots.csv",
    status: "complete",
    description: "Complete reference example with all fields and products"
  },
  { 
    id: "02-pool-channel", 
    name: "Pool Fence - Channel", 
    filename: "02-pool-channel.csv",
    status: "template",
    description: "Calculator fields + placeholder products"
  },
  { 
    id: "03-pool-flat-top", 
    name: "Pool Fence - Flat Top", 
    filename: "03-pool-flat-top.csv",
    status: "template",
    description: "Aluminium tubular panels"
  },
  { 
    id: "04-pool-barr", 
    name: "Pool Fence - BARR", 
    filename: "04-pool-barr.csv",
    status: "template",
    description: "Aluminium vertical slat panels"
  },
  { 
    id: "05-pool-blade", 
    name: "Pool Fence - Blade", 
    filename: "05-pool-blade.csv",
    status: "template",
    description: "Aluminium blade panels"
  },
  { 
    id: "06-bal-spigots", 
    name: "Balustrade - Spigots", 
    filename: "06-bal-spigots.csv",
    status: "template",
    description: "Glass balustrade with spigot mounting"
  },
  { 
    id: "07-bal-channel", 
    name: "Balustrade - Channel", 
    filename: "07-bal-channel.csv",
    status: "template",
    description: "Glass balustrade with channel mounting"
  },
  { 
    id: "08-bal-standoff", 
    name: "Balustrade - Standoff", 
    filename: "08-bal-standoff.csv",
    status: "template",
    description: "Glass balustrade with standoff pins (15mm glass)"
  },
  { 
    id: "09-bal-barr", 
    name: "Balustrade - BARR", 
    filename: "09-bal-barr.csv",
    status: "template",
    description: "Aluminium balustrade slats"
  },
  { 
    id: "10-bal-blade", 
    name: "Balustrade - Blade", 
    filename: "10-bal-blade.csv",
    status: "template",
    description: "Aluminium balustrade blade"
  },
  { 
    id: "11-custom-frameless", 
    name: "Custom - Frameless", 
    filename: "11-custom-frameless.csv",
    status: "complete",
    description: "Calculator only, no products"
  },
];

export default function Templates() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const { toast } = useToast();

  const handleDownloadTemplate = async (filename: string) => {
    try {
      setDownloading(filename);
      
      // Fetch with credentials to include session cookie
      const response = await fetch(`/api/templates/${filename}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Template not found');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Template Downloaded",
        description: `${filename} has been downloaded`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download template file",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    try {
      setDownloading("all");
      
      const response = await fetch('/api/templates/download-all', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download all templates');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fencelogic-templates.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "All Templates Downloaded",
        description: "ZIP file with all 11 templates has been downloaded",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download templates ZIP",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleUploadClick = (templateId: string) => {
    fileInputRefs.current[templateId]?.click();
  };

  const handleFileChange = async (templateId: string, filename: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(templateId);

      const text = await file.text();
      
      const response = await apiRequest("POST", `/api/templates/import`, {
        templateId,
        filename,
        csvData: text,
      }) as any;

      const created = response.summary?.productsCreated || 0;
      const updated = response.summary?.productsUpdated || 0;
      const errors = response.summary?.databaseErrors || 0;

      let description = `${filename} imported: `;
      const parts = [];
      if (created > 0) parts.push(`${created} products created`);
      if (updated > 0) parts.push(`${updated} products updated`);
      if (errors > 0) parts.push(`${errors} errors`);
      description += parts.join(', ');

      toast({
        title: "Template Imported",
        description,
        variant: errors > 0 ? "destructive" : "default",
      });

      // Reset file input
      if (fileInputRefs.current[templateId]) {
        fileInputRefs.current[templateId]!.value = '';
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Could not import template file",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminNav currentPage="templates" />
      
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-templates">Configuration Templates</h1>
            <p className="text-muted-foreground">
              Download CSV templates for all fence styles. Edit in Excel and import to configure your calculator.
            </p>
          </div>
          
          <Button
            onClick={handleDownloadAll}
            disabled={downloading === "all"}
            className="gap-2"
            data-testid="button-download-all"
          >
            <FolderArchive className="w-4 h-4" />
            {downloading === "all" ? "Downloading..." : "Download All (ZIP)"}
          </Button>
        </div>

        {/* Instructions Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              How to Use Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <p className="font-semibold mb-1">Download Templates</p>
                <p className="text-muted-foreground">Download individual CSV files or all templates as ZIP</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <p className="font-semibold mb-1">Edit in Excel/Google Sheets</p>
                <p className="text-muted-foreground">Open CSV files and update product SKUs, descriptions, and prices. All calculator fields are prepopulated.</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <p className="font-semibold mb-1">Combine into Excel Workbook</p>
                <p className="text-muted-foreground">Create one Excel file with each CSV as a separate tab (optional but recommended)</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                4
              </div>
              <div>
                <p className="font-semibold mb-1">Import Configuration</p>
                <p className="text-muted-foreground">Click "Upload CSV" on any template below to import your updated configuration</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((template) => (
            <Card key={template.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base mb-1">{template.name}</CardTitle>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </div>
                  {template.status === "complete" && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded">
                      Complete
                    </span>
                  )}
                  {template.status === "template" && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded">
                      Template
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleDownloadTemplate(template.filename)}
                  disabled={downloading === template.filename}
                  data-testid={`button-download-${template.id}`}
                >
                  <Download className="w-4 h-4" />
                  {downloading === template.filename ? "Downloading..." : "Download CSV"}
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleUploadClick(template.id)}
                  disabled={uploading === template.id}
                  data-testid={`button-upload-${template.id}`}
                >
                  <Upload className="w-4 h-4" />
                  {uploading === template.id ? "Uploading..." : "Upload CSV"}
                </Button>
                
                <input
                  type="file"
                  ref={(el) => (fileInputRefs.current[template.id] = el)}
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(template.id, template.filename, e)}
                  data-testid={`input-file-${template.id}`}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Legend */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Template Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded">
                Complete
              </span>
              <span className="text-muted-foreground">All fields and products fully configured (use as reference)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded">
                Template
              </span>
              <span className="text-muted-foreground">Calculator fields ready, update product SKUs and prices</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
