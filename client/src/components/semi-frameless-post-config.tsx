import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SemiFramelessConfig {
  postWidth?: number;
  lhsPostType?: "wall" | "end" | "corner-in" | "corner-out";
  rhsPostType?: "wall" | "end" | "corner-in" | "corner-out";
  intermediatePostMountType?: "base-plate" | "core";
  postColor?: "satin-black" | "custom";
  customPostColor?: string;
}

interface SemiFramelessPostConfigProps {
  config: SemiFramelessConfig | undefined;
  onUpdate: (config: SemiFramelessConfig) => void;
}

export function SemiFramelessPostConfig({ config, onUpdate }: SemiFramelessPostConfigProps) {
  const currentConfig: Required<SemiFramelessConfig> = {
    postWidth: config?.postWidth ?? 50,
    lhsPostType: config?.lhsPostType ?? "end",
    rhsPostType: config?.rhsPostType ?? "end",
    intermediatePostMountType: config?.intermediatePostMountType ?? "base-plate",
    postColor: config?.postColor ?? "satin-black",
    customPostColor: config?.customPostColor,
  };

  const updateField = <K extends keyof SemiFramelessConfig>(
    field: K,
    value: SemiFramelessConfig[K]
  ) => {
    onUpdate({ ...currentConfig, [field]: value });
  };

  const postTypeOptions = [
    { value: "wall", label: "Wall" },
    { value: "end", label: "End" },
    { value: "corner-in", label: "Corner In" },
    { value: "corner-out", label: "Corner Out" },
  ];

  const intermediatePostMountOptions = [
    { value: "base-plate", label: "Base Plate" },
    { value: "core", label: "Core" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post Hardware Configuration</CardTitle>
        <CardDescription>
          Configure post mounting types and color for semi-frameless system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Post Width */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Post Width (mm)</Label>
          <Input
            type="number"
            min={40}
            max={60}
            step={5}
            value={currentConfig.postWidth}
            onChange={(e) => updateField("postWidth", parseInt(e.target.value) || 50)}
            className="h-9"
            data-testid="input-post-width"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Standard 50mm RHS posts (glass shuffles 10mm)
          </p>
        </div>

        {/* Post Types */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* LHS Post Type */}
          <div>
            <Label className="text-sm font-medium mb-2 block">LHS Post Type</Label>
            <Select
              value={currentConfig.lhsPostType}
              onValueChange={(value) => updateField("lhsPostType", value as any)}
            >
              <SelectTrigger className="h-9" data-testid="select-lhs-post-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {postTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Intermediate Post Mount Type */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Intermediate Post Mount</Label>
            <Select
              value={currentConfig.intermediatePostMountType}
              onValueChange={(value) => updateField("intermediatePostMountType", value as any)}
            >
              <SelectTrigger className="h-9" data-testid="select-intermediate-mount">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intermediatePostMountOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* RHS Post Type */}
          <div>
            <Label className="text-sm font-medium mb-2 block">RHS Post Type</Label>
            <Select
              value={currentConfig.rhsPostType}
              onValueChange={(value) => updateField("rhsPostType", value as any)}
            >
              <SelectTrigger className="h-9" data-testid="select-rhs-post-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {postTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Post Color - Universal to Section */}
        <div className="border-t pt-4">
          <Label className="text-sm font-medium mb-2 block">Post Color (Universal to Section)</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                value={currentConfig.postColor}
                onValueChange={(value) => {
                  // Merge updates to avoid overwriting
                  onUpdate({
                    ...currentConfig,
                    postColor: value as any,
                    customPostColor: value !== "custom" ? undefined : currentConfig.customPostColor,
                  });
                }}
              >
                <SelectTrigger className="h-9" data-testid="select-post-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="satin-black">Satin Black</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Color Input - shown when Custom is selected */}
            {currentConfig.postColor === "custom" && (
              <div>
                <Input
                  type="text"
                  placeholder="Enter custom color (e.g., Pearl White, Monument)"
                  value={currentConfig.customPostColor || ""}
                  onChange={(e) => updateField("customPostColor", e.target.value)}
                  className="h-9"
                  data-testid="input-custom-color"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Specify custom powder coat color
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
