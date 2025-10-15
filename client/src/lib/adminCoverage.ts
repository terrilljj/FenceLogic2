export interface CoverageResponse {
  variant: string;
  selectedPaths: string[];
  selectedSubcategories: string[];
  pathCounts: Array<{ path: string; count: number }>;
  subcategoryCounts: Array<{ subcategory: string; count: number }>;
  deadPaths: string[];
  deadSubcategories: string[];
}

export async function fetchCoverage(variant: string): Promise<CoverageResponse> {
  const response = await fetch(`/api/debug/ui-config/${encodeURIComponent(variant)}/coverage`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch coverage: ${response.statusText}`);
  }
  
  return response.json();
}
