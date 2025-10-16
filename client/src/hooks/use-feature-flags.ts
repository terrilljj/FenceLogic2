import { useQuery } from "@tanstack/react-query";

interface FeatureFlags {
  HINGE_AUTO_ENABLED: boolean;
}

export function useFeatureFlags() {
  return useQuery<FeatureFlags>({
    queryKey: ["/api/feature-flags"],
  });
}
