# React Hooks Error Investigation and Fix Plan

## Executive Summary
The React hooks error "Rendered more hooks than during the previous render" is occurring in the `ProjectView.tsx` component. After deep analysis of the codebase, I've identified the root cause and developed a comprehensive fix plan.

## Root Cause Analysis

### Primary Issue: Early Returns After Hooks
The critical problem is located in `ProjectView.tsx` lines 239-257:

```typescript
// ALL HOOKS ARE DECLARED HERE (lines 21-318)
const { id: projectId } = useParams();
const { user } = useAuth();
const { toast } = useToast();
const queryClient = useQueryClient();
// ... multiple useState, useEffect, useQuery, and useMutation hooks

// EARLY RETURNS AFTER HOOKS (lines 239-257)
if (projectLoading || statementsLoading) {
  return ( /* loading UI */ );
}

if (!project) {
  return ( /* project not found UI */ );
}

// REST OF COMPONENT LOGIC AND JSX...
```

### Why This Causes the Error
React requires hooks to be called in the **exact same order** on every render. When the component renders:

1. **First render**: All hooks execute → early return due to loading state → component returns loading JSX
2. **Second render**: All hooks execute → no early return → component continues to full JSX
3. **Subsequent renders**: The number and order of hooks can vary based on conditional logic

This violates React's Rules of Hooks, specifically:
- **Rule 1**: Only call hooks at the top level (✓ - we're doing this correctly)
- **Rule 2**: Only call hooks from React functions (✓ - we're doing this correctly)
- **Rule 3**: Hooks must be called in the same order every time (✗ - **VIOLATION HERE**)

### Secondary Contributing Factors

1. **Complex useEffect Dependencies**: The deployment detection useEffect (lines 284-318) has complex dependency arrays that may cause re-evaluation issues
2. **Conditional Hook Execution in useEffect**: The effect checks `if (!statements || !project || deploymentReadyTest) return;` which can cause inconsistent execution
3. **Dynamic Key Generation**: Line 33 uses `key={`project-${params.id}-${Date.now()}`}` which forces remounts

## Comprehensive Fix Plan

### Phase 1: Immediate Fix - Remove Early Returns
**Priority: Critical**

1. **Move Loading States to JSX Conditional Rendering**
   ```typescript
   // INSTEAD OF:
   if (projectLoading || statementsLoading) {
     return <LoadingComponent />;
   }
   
   // USE:
   return (
     <div>
       {(projectLoading || statementsLoading) ? (
         <LoadingComponent />
       ) : (
         <MainContent />
       )}
     </div>
   );
   ```

2. **Convert Error States to Conditional JSX**
   ```typescript
   // INSTEAD OF:
   if (!project) {
     return <ProjectNotFound />;
   }
   
   // USE:
   return (
     <div>
       {!project ? (
         <ProjectNotFound />
       ) : (
         <ProjectContent />
       )}
     </div>
   );
   ```

### Phase 2: Stabilize Hook Dependencies
**Priority: High**

1. **Fix useEffect Dependencies**
   - Replace complex object dependencies with primitive values
   - Use useMemo for expensive calculations
   - Implement proper dependency arrays

2. **Optimize Deployment Detection Logic**
   ```typescript
   // Current problematic approach:
   useEffect(() => {
     if (!statements || !project || deploymentReadyTest) return;
     // Complex logic here
   }, [statements, project, deploymentReadyTest]);
   
   // Fixed approach:
   const deploymentReadyTestId = useMemo(() => {
     if (!statements || !project || deploymentReadyTest) return null;
     // Extract logic to useMemo
   }, [statements?.length, project?.id, deploymentReadyTest?.id]);
   
   useEffect(() => {
     if (deploymentReadyTestId) {
       setDeploymentReadyTest(deploymentReadyTestId);
     }
   }, [deploymentReadyTestId]);
   ```

### Phase 3: Component Architecture Improvements
**Priority: Medium**

1. **Extract Custom Hooks**
   - Create `useDeploymentDetection` hook
   - Create `useProjectNavigation` hook
   - Create `useStatementGrouping` hook

2. **Implement Proper Error Boundaries**
   - Add React Error Boundary wrapper
   - Implement fallback UI components

3. **Optimize Re-renders**
   - Use React.memo for expensive child components
   - Implement useCallback for stable function references
   - Use useMemo for expensive calculations

### Phase 4: Testing and Validation
**Priority: Medium**

1. **Add React Strict Mode Testing**
   - Wrap App in React.StrictMode during development
   - Verify hooks execute correctly in double-render mode

2. **Implement Hook Usage Validation**
   - Add ESLint rules for hooks
   - Use React DevTools Profiler to identify re-render causes

## Detailed Implementation Steps

### Step 1: Fix Early Returns (Immediate)

**File**: `client/src/pages/ProjectView.tsx`

Replace lines 239-257 with conditional JSX rendering:

```typescript
// Remove these early returns:
// if (projectLoading || statementsLoading) { return (...); }
// if (!project) { return (...); }

// Add this at the end of the component:
return (
  <div className="flex h-screen overflow-hidden">
    {(projectLoading || statementsLoading) ? (
      <>
        <div className="w-64 bg-surface animate-pulse"></div>
        <div className="flex-1 animate-pulse bg-gray-50"></div>
      </>
    ) : !project ? (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Not Found</h1>
          <p className="text-gray-600">The project you're looking for doesn't exist.</p>
        </div>
      </div>
    ) : (
      <>
        {/* Main component JSX here */}
      </>
    )}
  </div>
);
```

### Step 2: Stabilize useEffect Hook

**File**: `client/src/pages/ProjectView.tsx`

Replace the deployment detection useEffect (lines 284-318):

```typescript
// Extract to useMemo for stability
const deploymentCandidates = useMemo(() => {
  if (!statements || !project) return [];
  
  const testGroups = statements.reduce((acc, statement) => {
    const testKey = statement.testBatchId || statement.id;
    if (!acc[testKey]) {
      acc[testKey] = {
        id: testKey,
        testBatchId: statement.testBatchId,
        statements: [],
      };
    }
    acc[testKey].statements.push(statement);
    return acc;
  }, {} as Record<string, any>);

  return Object.values(testGroups).filter(test => {
    if (!test.testBatchId || test.statements.length === 0) return false;
    const allApproved = test.statements.every(s => s.status === 'approved');
    const notYetMarked = test.statements.every(s => 
      !s.deploymentStatus || s.deploymentStatus === 'pending'
    );
    return allApproved && notYetMarked;
  });
}, [statements, project?.id]);

// Simple useEffect with stable dependencies
useEffect(() => {
  if (deploymentCandidates.length > 0 && !deploymentReadyTest) {
    const candidate = deploymentCandidates[0];
    setDeploymentReadyTest({
      id: candidate.id,
      testBatchId: candidate.testBatchId,
      statements: candidate.statements,
      projectName: project.name,
    });
  }
}, [deploymentCandidates.length, deploymentReadyTest, project?.name]);
```

### Step 3: Remove Dynamic Keys

**File**: `client/src/App.tsx`

Replace line 33:
```typescript
// REMOVE:
{(params) => <ProjectView key={`project-${params.id}-${Date.now()}`} />}

// USE:
{(params) => <ProjectView key={`project-${params.id}`} />}
```

### Step 4: Add Error Boundary

**File**: `client/src/components/ErrorBoundary.tsx` (new file)

```typescript
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Expected Results After Implementation

1. **Immediate**: React hooks error will be resolved
2. **Short-term**: Improved component stability and performance
3. **Long-term**: Better maintainability and debugging experience

## Risk Assessment

**Low Risk Changes**:
- Moving early returns to conditional JSX
- Stabilizing useEffect dependencies
- Adding Error Boundary

**Medium Risk Changes**:
- Extracting custom hooks
- Significant refactoring of component logic

**Mitigation Strategies**:
- Implement changes incrementally
- Test each phase thoroughly before proceeding
- Maintain backup of working code
- Use feature flags for gradual rollout

## Testing Strategy

1. **Unit Tests**: Test hook behavior in isolation
2. **Integration Tests**: Verify component behavior with different data states
3. **Manual Testing**: Test all user workflows
4. **Performance Testing**: Monitor re-render frequency

## Timeline

- **Phase 1** (Critical Fix): 30 minutes
- **Phase 2** (Stabilization): 1 hour
- **Phase 3** (Architecture): 2-3 hours
- **Phase 4** (Testing): 1 hour

**Total Estimated Time**: 4-5 hours

## Success Metrics

1. ✅ React hooks error eliminated
2. ✅ Component renders consistently
3. ✅ Deployment detection works reliably
4. ✅ Performance improvements measured
5. ✅ No regression in existing functionality

## Conclusion

The React hooks error is caused by early returns after hook declarations, violating React's Rules of Hooks. The comprehensive fix plan addresses both the immediate issue and underlying architectural problems, ensuring long-term stability and maintainability of the codebase.

The fix should be implemented in phases, starting with the critical early returns issue, followed by stabilization improvements, and finally architectural enhancements for long-term success.