// Direct role refresh utility that bypasses component caching
export const forceRoleRefresh = async () => {
  try {
    // Clear all auth-related localStorage
    localStorage.removeItem('auth-cache');
    localStorage.removeItem('user-data');
    
    // Force refresh the page to clear all caches
    const response = await fetch('/api/auth/refresh-role', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      // Force a complete page reload to bypass all caching
      window.location.reload();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Role refresh failed:', error);
    return false;
  }
};

// Add this function to the global window object for easy access
(window as any).refreshRole = forceRoleRefresh;