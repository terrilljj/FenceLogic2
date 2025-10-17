import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const googleConfigSchema = z.object({
  oauthClientId: z.string().min(1, "OAuth Client ID is required"),
  oauthClientSecret: z.string().min(1, "OAuth Client Secret is required"),
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
});

type GoogleConfigForm = z.infer<typeof googleConfigSchema>;

export default function AdminSettings() {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState(false);

  // Query for config status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/admin/config/google/status'],
  });

  // Form
  const form = useForm<GoogleConfigForm>({
    resolver: zodResolver(googleConfigSchema),
    defaultValues: {
      oauthClientId: "",
      oauthClientSecret: "",
      spreadsheetId: "",
    },
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: GoogleConfigForm) => {
      return apiRequest('POST', '/api/admin/config/google', data);
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Google Sheets configuration has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/config/google/status'] });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save configuration",
      });
    },
  });

  const handleSubmit = (data: GoogleConfigForm) => {
    saveConfigMutation.mutate(data);
  };

  const handleConnectOAuth = () => {
    window.location.href = '/api/admin/google/oauth/start';
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">
          Configure Google Sheets integration for syncing product data and UI configurations.
        </p>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Google Sheets Integration Status</CardTitle>
          <CardDescription>
            Current configuration source and connection status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading status...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Configuration Source:</span>
                <span className="text-sm px-2 py-1 rounded bg-secondary">
                  {status?.source === 'env' ? 'Environment Variables' : 
                   status?.source === 'file' ? 'Encrypted File' : 'Not Configured'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">OAuth Connection:</span>
                {status?.connected ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">Not Connected</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config Form */}
      <Card>
        <CardHeader>
          <CardTitle>Google Sheets Configuration</CardTitle>
          <CardDescription>
            Configure OAuth credentials and spreadsheet ID. These will be securely encrypted and stored on disk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="oauthClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OAuth Client ID</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="xxxxx.apps.googleusercontent.com" 
                        data-testid="input-oauth-client-id"
                      />
                    </FormControl>
                    <FormDescription>
                      From Google Cloud Console OAuth 2.0 credentials
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="oauthClientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OAuth Client Secret</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type={showSecrets ? "text" : "password"}
                        placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxx" 
                        data-testid="input-oauth-client-secret"
                      />
                    </FormControl>
                    <FormDescription>
                      Your OAuth client secret from Google Cloud Console
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="spreadsheetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spreadsheet ID</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                        data-testid="input-spreadsheet-id"
                      />
                    </FormControl>
                    <FormDescription>
                      Found in the Google Sheets URL between /d/ and /edit
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowSecrets(!showSecrets)}
                  data-testid="button-toggle-secrets"
                >
                  {showSecrets ? "Hide" : "Show"} Secrets
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  type="submit" 
                  disabled={saveConfigMutation.isPending}
                  data-testid="button-save-config"
                >
                  {saveConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Configuration
                </Button>

                {status?.source !== 'missing' && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleConnectOAuth}
                    data-testid="button-connect-oauth"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {status?.connected ? "Reconnect" : "Connect"} Google Sheets
                  </Button>
                )}
              </div>
            </form>
          </Form>

          {status?.source !== 'missing' && !status?.connected && (
            <Alert className="mt-6">
              <AlertDescription>
                After saving your configuration, click "Connect Google Sheets" to authorize access to your spreadsheet.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
