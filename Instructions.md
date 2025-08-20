# Role Update Issue Analysis & Solution Plan

## Executive Summary

**Issue**: User role updated in database (growth_strategist → super_admin) but frontend continues displaying old role despite session clearing and re-authentication.

**Root Cause**: Multi-layer caching system with incomplete cache invalidation chain. The authentication flow has session storage, OIDC token claims, database queries, and frontend query cache - all requiring coordinated invalidation.

**Impact**: Critical - prevents users from accessing features corresponding to their actual role, breaking role-based access control.

## Deep Technical Analysis

### 1. Authentication Architecture Assessment

#### Current Flow:
```
User Login → Replit OIDC → Passport Session → Database Lookup → Frontend Cache
     ↓            ↓               ↓              ↓              ↓
   Claims      Tokens        Session Store   User Data    TanStack Query
```

#### Problem Points Identified:

**A. Session Layer Issues**
- Session cleared correctly in PostgreSQL `sessions` table
- However, Passport.js may cache user data in memory beyond session storage
- OIDC claims from Replit don't include custom roles - roles come from our database

**B. Authentication Middleware Gap**
- `req.currentUser` in `server/routes.ts:25` is populated by `storage.getUserByEmail()`
- This correctly fetches updated role from database
- But `/api/auth/user` endpoint may return stale data from session

**C. Frontend Cache Persistence**
- TanStack Query caches `/api/auth/user` response with queryKey `["/api/auth/user"]`
- No automatic invalidation when role changes server-side
- Browser may also cache authentication headers/tokens

### 2. Code Analysis Findings

#### Authentication Flow Investigation:

**File: `server/replitAuth.ts`**
- Lines 58-73: `upsertUser()` only handles profile data from OIDC claims
- Does NOT include role information from claims
- Role comes from separate database lookup
- This creates a disconnect between OIDC data and role data

**File: `server/routes.ts`**
- Lines 21-32: Middleware correctly injects `req.currentUser` from database
- Lines 35-50: `/api/auth/user` endpoint returns database user data
- This should reflect updated role, but may be cached

**File: `client/src/hooks/useAuth.ts`**
- Lines 4-7: Simple TanStack Query hook with no invalidation logic
- `retry: false` prevents automatic refetch on auth failures
- No mechanism to force refresh when role changes

### 3. Session & Cache Investigation

#### Database Verification:
✅ User role correctly updated to `super_admin` in database
✅ Session cleared from PostgreSQL `sessions` table
❌ Frontend still shows `growth_strategist`

#### Potential Cache Layers:
1. **Express Session** - Cleared ✅
2. **Passport.js Memory Cache** - Unknown ❓
3. **TanStack Query Cache** - Persistent ❌
4. **Browser Cache** - Persistent ❌
5. **Service Worker Cache** - Unknown ❓

## Solution Plan

### Phase 1: Immediate Role Update Fix (15 minutes)

**Objective**: Force complete cache invalidation to reflect current role

#### Step 1: Force Query Cache Invalidation
```typescript
// Add to client/src/hooks/useAuth.ts
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
    cacheTime: 0, // Don't cache
  });
  
  return { user, isLoading, isAuthenticated: !!user, refreshAuth };
}
```

#### Step 2: Add Role Refresh Endpoint
```typescript
// Add to server/routes.ts
app.post('/api/auth/refresh-role', isAuthenticated, async (req: any, res) => {
  try {
    // Force fresh database lookup
    const user = await storage.getUserByEmail(req.user?.claims?.email);
    if (user) {
      // Update current request
      req.currentUser = user;
      res.json({
        ...user,
        roleDisplayName: getUserRoleDisplayName(user.role)
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    logger.error("Error refreshing user role", 'auth-route', error as Error);
    res.status(500).json({ message: "Failed to refresh user role" });
  }
});
```

#### Step 3: Add Manual Refresh Button
```typescript
// Add to client/src/components/Sidebar.tsx
const refreshRoleMutation = useMutation({
  mutationFn: () => apiRequest('POST', '/api/auth/refresh-role'),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    toast({ title: "Role refreshed successfully" });
  }
});
```

### Phase 2: Robust Role Management System (30 minutes)

**Objective**: Prevent future role caching issues with systematic approach

#### Step 1: Enhanced Role Update Mechanism
```typescript
// Add to server/storage.ts
async updateUserRole(userId: string, newRole: UserRole): Promise<User> {
  try {
    const [user] = await db
      .update(users)
      .set({ 
        role: newRole,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    // Log role change for audit
    logAuth(`Role updated: ${user.email} → ${newRole}`, userId);
    return user;
  } catch (error) {
    logError(`Failed to update role for user ${userId}`, 'database', error);
    throw error;
  }
}
```

#### Step 2: Role Change Notification System
```typescript
// Add to server/routes.ts
app.put('/api/users/:id/role', 
  requirePermissionMiddleware(Permission.MANAGE_USER_ROLES), 
  async (req: any, res) => {
    try {
      const { role } = req.body;
      const updatedUser = await storage.updateUserRole(req.params.id, role);
      
      // Trigger cache invalidation for affected user
      // (Implementation depends on real-time system - WebSocket, Server-Sent Events, etc.)
      
      res.json({
        ...updatedUser,
        roleDisplayName: getUserRoleDisplayName(updatedUser.role)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user role" });
    }
  }
);
```

#### Step 3: Automatic Cache Invalidation
```typescript
// Add to client/src/lib/queryClient.ts
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error: any) => {
          // If 401/403, invalidate auth cache
          if (error?.status === 401 || error?.status === 403) {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            return false;
          }
          return failureCount < 3;
        }
      }
    }
  });
};
```

### Phase 3: Session Management Improvements (20 minutes)

**Objective**: Ensure session data stays synchronized with database

#### Step 1: Enhanced Session Synchronization
```typescript
// Modify server/routes.ts middleware
app.use('/api', isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userEmail = req.user?.claims?.email;
    if (userEmail) {
      // Always fetch fresh user data for role-sensitive operations
      const freshUser = await storage.getUserByEmail(userEmail);
      req.currentUser = freshUser;
      
      // Update session if role changed
      if (req.user.cachedRole && req.user.cachedRole !== freshUser?.role) {
        req.user.cachedRole = freshUser?.role;
        logAuth(`Session role updated: ${userEmail} → ${freshUser?.role}`);
      }
    }
    next();
  } catch (error) {
    logger.error('Failed to inject/sync current user', 'middleware', error as Error);
    next();
  }
});
```

#### Step 2: Role-Aware Authentication Check
```typescript
// Add to server/permissions.ts
export function requireFreshUserData() {
  return async (req: any, res: any, next: any) => {
    try {
      // Force fresh database lookup for sensitive operations
      const userEmail = req.user?.claims?.email;
      if (userEmail) {
        const freshUser = await storage.getUserByEmail(userEmail);
        req.currentUser = freshUser;
      }
      next();
    } catch (error) {
      res.status(500).json({ message: 'Failed to verify user permissions' });
    }
  };
}
```

### Phase 4: Comprehensive Testing & Monitoring (15 minutes)

**Objective**: Ensure role changes work reliably and catch future issues

#### Step 1: Role Change Test Suite
```typescript
// Add to client/src/utils/roleTestUtils.ts
export const testRoleUpdate = async (
  originalRole: string, 
  targetRole: string, 
  userId: string
) => {
  console.log(`🧪 Testing role update: ${originalRole} → ${targetRole}`);
  
  // 1. Verify database update
  const dbUser = await fetch(`/api/users/${userId}`).then(r => r.json());
  console.log(`📊 Database role: ${dbUser.role}`);
  
  // 2. Verify API response
  const apiUser = await fetch('/api/auth/user').then(r => r.json());
  console.log(`🔌 API role: ${apiUser.role}`);
  
  // 3. Verify UI reflection
  const uiRole = document.querySelector('[data-testid="user-role"]')?.textContent;
  console.log(`🎨 UI role: ${uiRole}`);
  
  const success = dbUser.role === targetRole && 
                 apiUser.role === targetRole && 
                 uiRole?.includes(targetRole);
  
  console.log(`✅ Role update test: ${success ? 'PASSED' : 'FAILED'}`);
  return success;
};
```

#### Step 2: Role Change Monitoring
```typescript
// Add to server/logger.ts
export const logRoleChange = (
  userId: string, 
  oldRole: string, 
  newRole: string, 
  changedBy: string
) => {
  logger.info(`Role change: ${userId} (${oldRole} → ${newRole}) by ${changedBy}`, 'role-audit');
  
  // Optional: Send to external monitoring system
  // await sendToMonitoring({
  //   event: 'role_change',
  //   userId, oldRole, newRole, changedBy,
  //   timestamp: new Date().toISOString()
  // });
};
```

## Implementation Strategy

### Priority Order:
1. **Phase 1** (Immediate fix) - Solves current issue
2. **Phase 3** (Session sync) - Prevents recurrence  
3. **Phase 2** (Robust system) - Long-term solution
4. **Phase 4** (Testing) - Quality assurance

### Risk Assessment:

**Low Risk Changes:**
- Frontend cache invalidation
- Additional API endpoints
- Enhanced logging

**Medium Risk Changes:**
- Session middleware modifications
- Authentication flow changes

**High Risk Changes:**
- Core permission system alterations
- Database schema changes

### Rollback Plan:

If issues arise:
1. Revert middleware changes
2. Fall back to manual session clearing
3. Use direct database role updates
4. Implement temporary role override flags

## Success Criteria

### Immediate (Phase 1):
- ✅ Role changes reflect in UI within 30 seconds
- ✅ Manual refresh button works consistently
- ✅ No authentication errors during role transition

### Short-term (Phases 2-3):
- ✅ Automatic role synchronization between database and sessions
- ✅ Robust cache invalidation across all layers
- ✅ Role changes propagate without manual intervention

### Long-term (Phase 4):
- ✅ Comprehensive role audit logging
- ✅ Automated testing for role transitions
- ✅ Monitoring alerts for role-related issues

## Maintenance Guidelines

### Regular Checks:
1. **Weekly**: Review role audit logs for anomalies
2. **Monthly**: Test role update flow with all user types
3. **Quarterly**: Review and update cache policies

### Code Standards:
- Always invalidate relevant caches when modifying user roles
- Log all role changes with full context
- Include role verification in sensitive operation tests
- Document any new authentication-related middleware

### Monitoring:
- Track role update success/failure rates
- Monitor session synchronization delays
- Alert on authentication cache misses
- Log performance impact of fresh user lookups

---

*Generated: January 20, 2025*
*Status: Ready for Implementation*
*Estimated Total Time: 1.5 hours*