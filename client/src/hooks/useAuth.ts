import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Function to force refresh user data (for role updates)
  const refreshAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
  }, [queryClient]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    refreshAuth,
  };
}

// Enhanced version with no caching for role updates
export function useAuthWithRefresh() {
  const queryClient = useQueryClient();
  
  const refreshAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
  }, [queryClient]);
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache (updated TanStack Query v5 syntax)
  });
  
  return { user, isLoading, isAuthenticated: !!user, refreshAuth };
}
