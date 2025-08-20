import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { StatementEditor } from '../components/StatementEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Sidebar } from '../components/Sidebar';
import { NewStatementModal } from '../components/NewStatementModal';

export default function ProjectView() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [navigationRequest, setNavigationRequest] = useState<{ targetStatementId: string; timestamp: number } | null>(null);
  const [showNewStatementModal, setShowNewStatementModal] = useState(false);
  const [testToDelete, setTestToDelete] = useState<any>(null);
  
  // Fetch project data
  const { data: project } = useQuery<any>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId
  });

  // Fetch all statements for this project
  const { data: statements = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/statements`],
    enabled: !!projectId
  });

  // Group statements by test batch
  const tests = useMemo(() => {
    const testGroups = new Map<string | null, any[]>();
    
    statements.forEach((statement: any) => {
      const key = statement.testBatchId || statement.id; // Use statement.id for legacy statements
      if (!testGroups.has(key)) {
        testGroups.set(key, []);
      }
      testGroups.get(key)!.push(statement);
    });

    return Array.from(testGroups.entries()).map(([testBatchId, stmts]) => ({
      id: testBatchId,
      testBatchId: testBatchId !== stmts[0]?.id ? testBatchId : null, // null for legacy statements
      statements: stmts,
      createdAt: stmts[0]?.createdAt
    }));
  }, [statements]);

  // Calculate workflow stage counts
  const workflowCounts = useMemo(() => {
    let newTests = 0;
    let pendingReview = 0; 
    let readyToDeploy = 0;
    let completed = 0;

    tests.forEach(test => {
      if (test.testBatchId) {
        // Test batch logic
        const hasAnyApproved = test.statements.some((s: any) => s.status === 'approved');
        const allApproved = test.statements.every((s: any) => s.status === 'approved');
        const hasAnyCompleted = test.statements.some((s: any) => s.deploymentStatus === 'completed');
        const hasAnyReady = test.statements.some((s: any) => s.deploymentStatus === 'ready');
        const hasReview = test.statements.some((s: any) => ['under_review', 'needs_revision'].includes(s.status));

        if (hasAnyCompleted) {
          completed++;
        } else if (hasAnyReady || allApproved) {
          readyToDeploy++;
        } else if (hasReview) {
          pendingReview++;
        } else {
          newTests++;
        }
      } else {
        // Legacy statement logic
        const statement = test.statements[0];
        if (statement.deploymentStatus === 'completed') {
          completed++;
        } else if (statement.deploymentStatus === 'ready' || statement.status === 'approved') {
          readyToDeploy++;
        } else if (['under_review', 'needs_revision'].includes(statement.status)) {
          pendingReview++;
        } else {
          newTests++;
        }
      }
    });

    return { newTests, pendingReview, readyToDeploy, completed };
  }, [tests]);

  const selectedTest = useMemo(() => {
    return tests.find(test => test.id === selectedTestId);
  }, [tests, selectedTestId]);

  // Delete test batch mutation
  const deleteTestBatchMutation = useMutation({
    mutationFn: (testBatchId: string) => 
      apiRequest('DELETE', `/api/test-batches/${testBatchId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/statements`] });
      setTestToDelete(null);
    }
  });

  const handleDeleteTest = (test: any) => {
    setTestToDelete(test);
  };

  const confirmDeleteTest = () => {
    if (testToDelete?.testBatchId) {
      deleteTestBatchMutation.mutate(testToDelete.testBatchId);
    }
  };

  // Debug logging
  console.log('ProjectView Debug:', { projectId, project, statements, userRole: (user as any)?.role });

  if (!projectId) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Project Selected</h2>
          <p className="text-gray-600 mb-4">Click on a project card from the dashboard to view the workflow dashboard.</p>
          <Button 
            onClick={() => setLocation('/')}
            className="bg-primary hover:bg-primary/90"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div>Loading project {projectId}...</div>
        {projectId && (
          <div className="mt-2 text-sm text-gray-500">
            Project ID: {projectId}
          </div>
        )}
      </div>
    );
  }

  if (selectedStatementId) {
    const statement = statements.find((s: any) => s.id === selectedStatementId);
    if (statement) {
      return (
        <StatementEditor
          key={selectedStatementId}
          statement={statement}
          onStatementUpdated={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/statements`] });
            setSelectedStatementId(null);
          }}
          navigationRequest={navigationRequest}
          onNavigationComplete={() => setNavigationRequest(null)}
        />
      );
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <header className="bg-surface border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-secondary" data-testid="text-project-title">
                {project.name}
              </h1>
              <p className="text-gray-600" data-testid="text-project-client">
                Client: {project.clientName}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Show New Test button for roles that can create tasks */}
              {(user as any)?.role && ['super_admin', 'growth_strategist', 'creative_strategist'].includes((user as any).role) && (
                <Button
                  onClick={() => setShowNewStatementModal(true)}
                  className="bg-primary text-white hover:bg-primary-dark"
                  data-testid="button-new-test"
                >
                  <i className="fas fa-plus mr-2"></i>
                  New Test
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-6">
          {!selectedTestId ? (
          // Workflow Dashboard View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* New Tests Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedTestId('new')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  New Tests
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 mb-1">{workflowCounts.newTests}</div>
                <p className="text-xs text-gray-600">Ready for review submission</p>
              </CardContent>
            </Card>

            {/* Pending Review Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedTestId('pending')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  Pending Review
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600 mb-1">{workflowCounts.pendingReview}</div>
                <p className="text-xs text-gray-600">Awaiting strategist approval</p>
              </CardContent>
            </Card>

            {/* Ready to Deploy Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedTestId('ready')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  Ready to Deploy
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 mb-1">{workflowCounts.readyToDeploy}</div>
                <p className="text-xs text-gray-600">Approved and ready for deployment</p>
              </CardContent>
            </Card>

            {/* Completed Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedTestId('completed')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  Completed
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600 mb-1">{workflowCounts.completed}</div>
                <p className="text-xs text-gray-600">Deployed and finished tests</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Individual Test Cards View
          <div className="mb-4">
            <Button
              onClick={() => setSelectedTestId(null)}
              variant="outline"
              size="sm"
            >
              ← Back to Workflow Overview
            </Button>
          </div>
        )}

        {selectedTestId && (
          <div className="space-y-4">
            {tests
              .filter(test => {
                if (selectedTestId === 'new') {
                  return !test.statements.some((s: any) => ['under_review', 'needs_revision', 'approved'].includes(s.status) || s.deploymentStatus);
                }
                if (selectedTestId === 'pending') {
                  return test.statements.some((s: any) => ['under_review', 'needs_revision'].includes(s.status));
                }
                if (selectedTestId === 'ready') {
                  return test.statements.some((s: any) => s.status === 'approved' || s.deploymentStatus === 'ready');
                }
                if (selectedTestId === 'completed') {
                  return test.statements.some((s: any) => s.deploymentStatus === 'completed');
                }
                return false;
              })
              .map(test => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {test.statements[0]?.description || (test.testBatchId ? 'Test Batch' : 'Legacy Statement')}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {test.statements.length} ad statement{test.statements.length > 1 ? 's' : ''}
                        </p>
                        <div className="flex space-x-2">
                          {test.statements.map((statement: any, index: number) => (
                            <Badge
                              key={statement.id}
                              className={cn(
                                "text-xs cursor-pointer",
                                statement.status === 'draft' && 'bg-gray-100 text-gray-700',
                                statement.status === 'under_review' && 'bg-yellow-100 text-yellow-800',
                                statement.status === 'needs_revision' && 'bg-orange-100 text-orange-800',
                                statement.status === 'approved' && 'bg-green-100 text-green-800'
                              )}
                              onClick={() => setSelectedStatementId(statement.id)}
                            >
                              #{index + 1} {statement.status.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Created {test.createdAt ? new Date(test.createdAt).toLocaleDateString() : 'Unknown date'}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

          {/* Create New Test Button - moved to header */}
        </div>
      </div>

      {/* New Statement Modal */}
      {showNewStatementModal && (
        <NewStatementModal
          projectId={projectId}
          onClose={() => setShowNewStatementModal(false)}
          onStatementCreated={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/statements`] });
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
              Are you sure you want to delete this test batch? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteTest}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteTestBatchMutation.isPending}
            >
              {deleteTestBatchMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}