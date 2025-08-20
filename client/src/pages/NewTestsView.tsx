import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { NewStatementModal } from "@/components/NewStatementModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { StatementWithRelations, ProjectWithStats } from "@shared/schema";

export default function NewTestsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [showNewStatementModal, setShowNewStatementModal] = useState(false);
  const [testToDelete, setTestToDelete] = useState<any>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Extract project context from URL parameters or current location
  useEffect(() => {
    console.log('🔍 NewTestsView: Detecting project context', {
      location,
      search: window.location.search,
      pathname: window.location.pathname
    });

    // First, try to get project from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdFromUrl = urlParams.get('project');
    
    if (projectIdFromUrl) {
      console.log('🎯 NewTestsView: Using project from URL parameter:', projectIdFromUrl);
      setCurrentProjectId(projectIdFromUrl);
      // Store for future reference
      localStorage.setItem('lastVisitedProject', projectIdFromUrl);
      return;
    }

    // Second, try to extract from current location path (if navigating from project view)
    const urlPath = window.location.pathname;
    const projectMatch = urlPath.match(/\/projects\/([^\/]+)/);
    if (projectMatch) {
      console.log('🎯 NewTestsView: Using project from URL path:', projectMatch[1]);
      setCurrentProjectId(projectMatch[1]);
      localStorage.setItem('lastVisitedProject', projectMatch[1]);
      return;
    }

    // Third, check for recent navigation from localStorage with timestamp
    const lastProjectId = localStorage.getItem('lastVisitedProject');
    const navigationTimestamp = localStorage.getItem('lastNavTimestamp');
    const recentNavigation = navigationTimestamp && (Date.now() - parseInt(navigationTimestamp)) < 5000; // 5 seconds
    
    if (lastProjectId && recentNavigation) {
      console.log('🎯 NewTestsView: Using recent project from localStorage:', lastProjectId);
      setCurrentProjectId(lastProjectId);
      return;
    }

    // Fourth, fallback to user's most recent project from localStorage (without timestamp check)
    if (lastProjectId) {
      console.log('🎯 NewTestsView: Using last visited project:', lastProjectId);
      setCurrentProjectId(lastProjectId);
      return;
    }

    console.log('⚠️ NewTestsView: No project context found, will use fallback');
    // If no project context available, we'll need to get user's first available project
    // This will be handled by the projects query below
  }, [location]);

  // Get user's projects to determine fallback project if needed
  const { data: projects } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects'],
  });

  // Set fallback project if none is selected and projects are available
  useEffect(() => {
    if (!currentProjectId && projects && projects.length > 0) {
      const fallbackProjectId = projects[0].id;
      setCurrentProjectId(fallbackProjectId);
      console.log('NewTestsView: Using fallback project:', fallbackProjectId);
    }
  }, [currentProjectId, projects]);

  // Use project-specific endpoint instead of global /api/statements
  const { data: statements, isLoading } = useQuery<StatementWithRelations[]>({
    queryKey: [`/api/projects/${currentProjectId}/statements`],
    enabled: !!currentProjectId,
  });

  // Group statements into tests based on testBatchId, excluding completed/ready tests
  const groupedTests = statements?.reduce((acc, statement) => {
    // Skip statements without testBatchId (legacy statements)
    if (!statement.testBatchId) return acc;
    
    // Skip tests that have been moved to Ready to Deploy or Completed
    if (statement.deploymentStatus === 'ready' || statement.deploymentStatus === 'completed') {
      return acc;
    }
    
    const testKey = statement.testBatchId;
    if (!acc[testKey]) {
      acc[testKey] = {
        id: testKey,
        testBatchId: statement.testBatchId,
        projectId: statement.projectId,
        projectName: statement.project?.name || 'Unknown Project',
        statements: [],
        createdAt: statement.createdAt,
        status: 'in_progress'
      };
    }
    acc[testKey].statements.push(statement);
    return acc;
  }, {} as Record<string, any>) || {};

  const tests = Object.values(groupedTests);

  // Delete test batch mutation
  const deleteTestBatchMutation = useMutation({
    mutationFn: async (testBatchId: string) => {
      const response = await apiRequest('DELETE', `/api/test-batches/${testBatchId}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${currentProjectId}/statements`] });
      setTestToDelete(null);
    },
    onError: (error) => {
      console.error('Failed to delete test batch:', error);
    },
  });

  // Handler functions
  const handleDeleteTest = (test: any) => {
    if (test.testBatchId) {
      setTestToDelete({
        id: test.id,
        testBatchId: test.testBatchId,
        statementsCount: test.statements.length
      });
    }
  };

  const confirmDeleteTest = () => {
    if (testToDelete?.testBatchId) {
      deleteTestBatchMutation.mutate(testToDelete.testBatchId);
    }
  };

  const handleCardClick = (test: any) => {
    setLocation(`/projects/${test.projectId}?statement=${test.statements[0]?.id}`);
  };

  // Show loading state while determining project context or loading statements
  if (isLoading || !currentProjectId) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="w-64 bg-surface animate-pulse"></div>
        <div className="flex-1 animate-pulse bg-gray-50">
          <div className="p-6">
            <div className="h-8 bg-gray-300 rounded mb-4"></div>
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-surface border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-secondary">New Tests</h2>
              {currentProjectId && (
                <p className="text-sm text-gray-600 mt-1">
                  Project: {projects?.find(p => p.id === currentProjectId)?.name || 'Loading...'}
                </p>
              )}
              <p className="text-gray-600 mt-1">All tests currently in progress</p>
            </div>
            <Button
              onClick={() => setShowNewStatementModal(true)}
              className="bg-primary text-white hover:bg-primary-dark"
              data-testid="button-new-test"
            >
              <i className="fas fa-plus text-sm mr-2"></i>
              New Test
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map(test => (
              <div key={test.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleCardClick(test)}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {test.statements[0]?.description || (test.testBatchId ? 'Test Batch' : 'Legacy Statement')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {test.projectName} • {test.statements.length} ad statement{test.statements.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-warning text-white">
                      In Progress
                    </Badge>
                    {/* Delete button for test batches */}
                    {test.testBatchId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTest(test);
                        }}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2"
                        data-testid={`button-delete-test-${test.id}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
                  
                  <div className="space-y-2">
                    {test.statements.slice(0, 3).map((statement: any) => (
                      <div key={statement.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 truncate">{statement.heading}</span>
                          <Badge className={`text-xs ${
                            statement.status === 'draft' ? 'bg-gray-100' :
                            statement.status === 'under_review' ? 'bg-warning text-white' :
                            statement.status === 'approved' ? 'bg-success text-white' :
                            'bg-error text-white'
                          }`}>
                            {statement.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {test.statements.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{test.statements.length - 3} more statements
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Created {test.createdAt ? new Date(test.createdAt).toLocaleDateString() : 'Unknown date'}
                    </p>
                  </div>
                </div>
              ))}
          </div>
          
          {tests.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No tests in progress</h3>
              <p className="text-gray-500 mb-6">Create your first test to get started with Facebook ad campaigns</p>
              <Button
                onClick={() => setShowNewStatementModal(true)}
                className="bg-primary text-white hover:bg-primary-dark"
                data-testid="button-create-first-test"
              >
                Create Your First Test
              </Button>
            </div>
          )}
        </div>
      </div>

      {showNewStatementModal && currentProjectId && (
        <NewStatementModal
          projectId={currentProjectId}
          onClose={() => setShowNewStatementModal(false)}
          onStatementCreated={() => {
            // Refresh data with project-specific endpoint
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${currentProjectId}/statements`] });
            setShowNewStatementModal(false);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!testToDelete} onOpenChange={() => setTestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this test batch? This will permanently delete {testToDelete?.statementsCount} statement{testToDelete?.statementsCount !== 1 ? 's' : ''} and this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTest}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteTestBatchMutation.isPending}
            >
              {deleteTestBatchMutation.isPending ? "Deleting..." : "Delete Test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}