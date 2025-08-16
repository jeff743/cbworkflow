# Test Title Display Issue - Deep Investigation & Fix Plan

## Issue Summary
Test titles entered in the "Test Title" field when creating new tests are not appearing on test cards. Instead, cards show "Test Batch" as the default title.

## Root Cause Analysis

### 1. Data Flow Investigation

#### ✅ Frontend Form (WORKING)
- **File**: `client/src/components/NewStatementModal.tsx`  
- **Status**: CORRECT - Test title is being captured in `formData.description`
- **Evidence**: Form field exists with proper binding:
  ```tsx
  <Label>Test Title</Label>
  <Textarea 
    value={formData.description}
    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
  />
  ```

#### ✅ API Request (WORKING)
- **File**: `client/src/components/NewStatementModal.tsx` (lines 49-58)
- **Status**: CORRECT - Description is included in statements array sent to server
- **Evidence**: Each statement includes: `description: formData.description || undefined`

#### ✅ Database Storage (WORKING)
- **File**: `server/routes.ts` + Database
- **Status**: CORRECT - Data is being saved to database
- **Evidence**: Database query confirms description "pain desire" is stored:
  ```sql
  SELECT description FROM statements WHERE test_batch_id = 'iy4ogBEUUv6q33riogG54';
  -- Result: "pain desire" for all statements
  ```

#### ❌ Database Retrieval (BROKEN)
- **File**: `server/storage.ts` (lines 211-286)  
- **Status**: MISSING FIELD - The `getStatements` function does NOT select the description field
- **Evidence**: In the SELECT query (lines 217-237), `description` field is missing from the selection list
- **Impact**: Description data exists in database but is not retrieved and sent to frontend

#### ❌ Frontend Display (BROKEN)
- **File**: `client/src/pages/ProjectView.tsx` (line 296)
- **Status**: LOGIC CORRECT but receives undefined data
- **Evidence**: Code `test.statements[0]?.description` is correct but `description` is undefined because backend doesn't send it

### 2. Database Schema Verification
- ✅ `description` field exists in `statements` table (confirmed in `shared/schema.ts` line 60)
- ✅ Data is being written to database (confirmed via SQL queries)
- ❌ Data is not being read from database (missing from SELECT query)

### 3. Debugging Evidence
- **Database contains data**: Multiple SQL queries confirm descriptions are saved correctly
- **Frontend logic is correct**: Test card rendering logic checks for `test.statements[0]?.description`
- **Missing link**: The bridge between database and frontend (storage layer) is incomplete

## Fix Plan

### Step 1: Fix Database Retrieval
**File**: `server/storage.ts`
**Action**: Add `description` field to SELECT query in `getStatements` method

```typescript
// In getStatements method, around line 220, add:
description: statements.description,
```

**Location**: Between `testBatchId: statements.testBatchId,` and `heading: statements.heading,`

### Step 2: Verify TypeScript Types
**File**: `shared/schema.ts`
**Action**: Ensure `StatementWithRelations` type includes description field
**Expected**: Should already be correct since description field exists in base schema

### Step 3: Test & Verify
1. After fixing storage layer, create a new test with title "Test Fix Verification"
2. Verify the title appears on the test card
3. Check database contains the data
4. Verify frontend receives the data in API response

### Step 4: Clean Up Debugging Code
**Files**: 
- `client/src/components/NewStatementModal.tsx`
- `server/routes.ts`
**Action**: Remove debugging console.log statements added during investigation

### Step 5: Test Edge Cases
1. Test with empty title (should fallback to "Test Batch")
2. Test with very long titles (should display properly)
3. Test with special characters in title

## Implementation Priority

### 🔥 Critical (Fix Immediately)
1. Add `description` field to storage layer SELECT query
2. Test new test creation

### 🟡 Important (Fix Soon) 
1. Remove debugging code
2. Verify edge cases work properly

### ✅ Optional (Enhancement)
1. Add character limit validation to title field
2. Add title preview in test creation modal
3. Consider truncating very long titles with ellipsis

## Risk Assessment
- **Risk Level**: LOW - This is a single missing field in a SELECT query
- **Impact**: Minimal - Only affects display, no data loss
- **Rollback Plan**: If issues occur, the fix can be easily reverted

## Testing Strategy
1. **Unit Test**: Verify `getStatements` returns description field
2. **Integration Test**: Create new test and verify title displays
3. **Regression Test**: Ensure existing functionality still works
4. **User Acceptance Test**: Confirm test cards show proper titles

## Expected Outcome
After implementing the fix:
- Test titles entered in "Test Title" field will display as the main heading on test cards
- Existing tests will show "Test Batch" (expected, as they were created before description field was properly saved)
- New tests will show custom titles
- Fallback behavior remains intact for tests without titles

---

**Investigation conducted**: January 16, 2025
**Issue severity**: Medium (cosmetic but important for user experience)
**Estimated fix time**: 5 minutes
**Estimated test time**: 10 minutes