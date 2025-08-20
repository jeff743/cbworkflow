import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StatementEditor } from "@/components/StatementEditor";
import { NewStatementModal } from "@/components/NewStatementModal";
import { DeleteTestBatchDialog } from "@/components/DeleteTestBatchDialog";
import { ProjectSettings } from "@/components/ProjectSettings";
import { ExportModal } from "@/components/ExportModal";
import { DeploymentReadyDialog } from "@/components/DeploymentReadyDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Project, StatementWithRelations } from "@shared/schema";

export default function ProjectView() {
  const { id: projectId } = useParams();
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [navigationRequest, setNavigationRequest] = useState<{targetStatementId: string; timestamp: number} | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewStatementModal, setShowNewStatementModal] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [testToDelete, setTestToDelete] = useState<{ id: string; testBatchId?: string | null; statementsCount: number } | null>(null);
  const [deploymentReadyTest, setDeploymentReadyTest] = useState<{
    id: string;
    testBatchId?: string | null;
    statements: StatementWithRelations[];
    projectName: string;
  } | null>(null);
  
  // Phase 1 Fix: Add deployment tracking state to prevent race condition
  const [recentlyMarkedTestIds, setRecentlyMarkedTestIds] = useState<Set<string>>(new Set());
  // Additional state to track deployment in progress more aggressively
  const [deploymentInProgress, setDeploymentInProgress] = useState<string | null>(null);

  // Phase 3: Navigation Event Handler - Listen for navigation reset signals
  const { data: navReset } = useQuery({
    queryKey: ['project-nav-reset', projectId],
    enabled: false,
  });

  useEffect(() => {
    if (navReset) {
      setSelectedTestId(null);
      setSelectedStatementId(null);
    }
  }, [navReset]);

  // Backup: Reset when projectId changes (different project)
  useEffect(() => {
    setSelectedTestId(null);
    setSelectedStatementId(null);
  }, [projectId]);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
  });

  const { data: statements, isLoading: statementsLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/projects', projectId, 'statements', statusFilter],
    queryFn: async () => {
      const baseUrl = `/api/projects/${projectId}/statements`;
      const url = statusFilter === 'all' ? baseUrl : `${baseUrl}?status=${statusFilter}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch statements: ${response.status}`);
      }
      return response.json();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async ({ statementIds, exportType }: { statementIds: string[], exportType: 'all' | 'selected' | 'single' }) => {
      // Create the export URL with selected statement IDs
      const params = new URLSearchParams();
      if (exportType !== 'all') {
        statementIds.forEach(id => params.append('ids', id));
      }
      const url = `/api/projects/${projectId}/export${params.toString() ? '?' + params.toString() : ''}`;
      
      // Create a temporary link to trigger download
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'colorblocks.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return { count: statementIds.length };
    },
    onSuccess: (data, variables) => {
      const { exportType } = variables;
      const description = exportType === 'single' 
        ? 'Downloaded 1 colorblock'
        : `Downloaded ${data.count} approved colorblock${data.count !== 1 ? 's' : ''}`;
      
      toast({
        title: "Export Complete",
        description,
      });
      setShowExportModal(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Export Failed",
        description: "Failed to export colorblocks",
        variant: "destructive",
      });
    },
  });

  const markReadyToDeployMutation = useMutation({
    mutationFn: async (testBatchId: string) => {
      const response = await apiRequest('POST', `/api/deployment/mark-ready/${testBatchId}`);
      return response.json();
    },
    onSuccess: () => {
      console.log('Mark ready to deploy mutation success - closing dialog');
      const testBatchId = deploymentReadyTest?.testBatchId;
      
      // CRITICAL: Close dialog immediately and unconditionally
      setDeploymentReadyTest(null);
      
      if (testBatchId) {
        // Set deployment in progress to completely block dialog reopening
        setDeploymentInProgress(testBatchId);
        
        // Add to recently marked set to prevent re-detection
        setRecentlyMarkedTestIds(prev => new Set([...Array.from(prev), testBatchId]));
        console.log('Set deployment in progress and added to recently marked set:', testBatchId);
      }
      
      // Toast notification
      toast({
        title: "Ready to Deploy",
        description: "Test batch has been marked as ready for deployment",
      });
      
      // Refresh data with longer delay for database consistency
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'statements'] });
        console.log('Invalidated queries after deploy success');
        
        // Clear all tracking after much longer delay to ensure database consistency
        setTimeout(() => {
          if (testBatchId) {
            setRecentlyMarkedTestIds(prev => {
              const newSet = new Set([...Array.from(prev)]);
              newSet.delete(testBatchId);
              return newSet;
            });
            setDeploymentInProgress(null);
            console.log('Cleared all deployment tracking for:', testBatchId);
          }
        }, 15000); // 15 second delay to ensure complete database consistency
      }, 1000); // 1 second delay for initial data refresh
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed",
        description: "Failed to mark test as ready to deploy",
        variant: "destructive",
      });
    },
  });

  const deleteTestBatchMutation = useMutation({
    mutationFn: async (testBatchId: string) => {
      const response = await apiRequest('DELETE', `/api/test-batches/${testBatchId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test Batch Deleted",
        description: `Successfully deleted ${data.deletedCount} statement${data.deletedCount !== 1 ? 's' : ''}`,
      });
      // Refresh the statements list
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'statements'] });
      // Close delete dialog
      setTestToDelete(null);
      // Reset selection if the deleted test was selected
      if (selectedTestId === testToDelete?.id) {
        setSelectedTestId(null);
        setSelectedStatementId(null);
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Delete Failed",
        description: "Failed to delete test batch",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTest = (test: any) => {
    // Only allow deletion of test batches (not legacy single statements)
    if (test.testBatchId) {
      setTestToDelete({
        id: test.id,
        testBatchId: test.testBatchId,
        statementsCount: test.statements.length
      });
    } else {
      toast({
        title: "Cannot Delete",
        description: "Legacy single statements cannot be deleted as batches. Delete individual statements instead.",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteTest = () => {
    if (testToDelete?.testBatchId) {
      deleteTestBatchMutation.mutate(testToDelete.testBatchId);
    }
  };

  // Removed early returns to fix React hooks error - now using conditional JSX rendering

  // Group statements into tests by testBatchId
  const groupedTests = statements?.reduce((acc, statement) => {
    // Skip statements without testBatchId (legacy statements) - group them individually
    const testKey = statement.testBatchId || statement.id;
    if (!acc[testKey]) {
      acc[testKey] = {
        id: testKey,
        testBatchId: statement.testBatchId,
        statements: [] as StatementWithRelations[],
        projectId: statement.projectId,
        createdAt: statement.createdAt,
      };
    }
    acc[testKey].statements.push(statement);
    return acc;
  }, {} as Record<string, any>) || {};

  const tests = Object.values(groupedTests);
  const selectedTest = tests.find((t: any) => t.id === selectedTestId);
  const selectedStatement = selectedTest?.statements.find((s: any) => s.id === selectedStatementId);

  // Check for completed test batches that are ready for deployment
  useEffect(() => {
    if (!statements || !project || deploymentReadyTest || markReadyToDeployMutation.isPending) return;
    
    // Group statements and check for deployment readiness
    const testGroups = statements.reduce((acc, statement) => {
      const testKey = statement.testBatchId || statement.id;
      if (!acc[testKey]) {
        acc[testKey] = {
          id: testKey,
          testBatchId: statement.testBatchId,
          statements: [] as StatementWithRelations[],
        };
      }
      acc[testKey].statements.push(statement);
      return acc;
    }, {} as Record<string, any>);

    for (const test of Object.values(testGroups)) {
      // Only check test batches (not individual statements)
      if (test.testBatchId && test.statements.length > 0) {
        const allApproved = test.statements.every((s: StatementWithRelations) => s.status === 'approved');
        const notYetMarkedForDeployment = test.statements.every((s: StatementWithRelations) => 
          !s.deploymentStatus || s.deploymentStatus === 'pending'
        ) && !recentlyMarkedTestIds.has(test.testBatchId);
        
        // Additional check: if any statement has 'ready' status, don't show dialog
        const hasReadyStatus = test.statements.some((s: StatementWithRelations) => 
          s.deploymentStatus === 'ready'
        );
        
        console.log(`Test ${test.testBatchId} - allApproved: ${allApproved}, notYetMarked: ${notYetMarkedForDeployment}, hasReady: ${hasReadyStatus}, dialogOpen: ${!!deploymentReadyTest}, isPending: ${markReadyToDeployMutation.isPending}, inProgress: ${deploymentInProgress === test.testBatchId}`);
        console.log(`Recently marked IDs:`, Array.from(recentlyMarkedTestIds), `Deployment in progress:`, deploymentInProgress);
        
        if (allApproved && notYetMarkedForDeployment && !hasReadyStatus && !deploymentReadyTest && !markReadyToDeployMutation.isPending && deploymentInProgress !== test.testBatchId) {
          // Show deployment ready dialog
          setDeploymentReadyTest({
            id: test.id,
            testBatchId: test.testBatchId,
            statements: test.statements,
            projectName: project.name,
          });
          break; // Only show one dialog at a time
        }
      }
    }
  }, [statements, project, deploymentReadyTest, markReadyToDeployMutation.isPending, recentlyMarkedTestIds, deploymentInProgress]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under_review': return 'bg-warning text-white';
      case 'approved': return 'bg-success text-white';
      case 'needs_revision': return 'bg-error text-white';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {(projectLoading || statementsLoading) ? (
        <>
          <div className="w-64 bg-surface animate-pulse"></div>
          <div className="flex-1 animate-pulse bg-gray-50"></div>
        </>
      ) : !project ? (
        <div className="min-h-screen flex items-center justify-center w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Not Found</h1>
            <p className="text-gray-600">The project you're looking for doesn't exist.</p>
          </div>
        </div>
      ) : (
        <>
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-secondary" data-testid="text-project-name">
                    {project.name}
                  </h2>
                  <p className="text-gray-600 mt-1" data-testid="text-project-description">
                    {project.description || "Create and manage colorblock statements for Facebook ads testing"}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={() => setShowExportModal(true)}
                    disabled={exportMutation.isPending}
                    className="bg-success text-white hover:bg-green-600"
                    data-testid="button-export-approved"
                  >
                    <i className="fas fa-download text-sm mr-2"></i>
                    {exportMutation.isPending ? "Exporting..." : "Export Colorblocks"}
                  </Button>
                  <Button
                    onClick={() => setShowNewStatementModal(true)}
                    className="bg-primary text-white hover:bg-primary-dark"
                    data-testid="button-new-test"
                  >
                    <i className="fas fa-plus text-sm mr-2"></i>
                    New Test
                  </Button>
                  <Button
                    onClick={() => setShowProjectSettings(true)}
                    variant="outline"
                    data-testid="button-project-settings"
                  >
                    <i className="fas fa-cog text-sm mr-2"></i>
                    Project Settings
                  </Button>
                </div>
              </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Statements List */}
              <div className="w-1/2 bg-surface border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Tests</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">Filter:</span>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="under_review">Under Review</SelectItem>
                          <SelectItem value="needs_revision">Needs Revision</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Always start by showing test cards, drill down when test is selected */}
                  {!selectedTestId ? (
                    // Show test cards when no test is selected
                    <>
                      {tests.map((test: any) => {
                        const completedCount = test.statements.filter((s: any) => s.status === 'completed').length;
                        const approvedCount = test.statements.filter((s: any) => s.status === 'approved').length;
                        const pendingCount = test.statements.filter((s: any) => s.status === 'under_review').length;
                        const revisionCount = test.statements.filter((s: any) => s.status === 'needs_revision').length;
                        const draftCount = test.statements.filter((s: any) => s.status === 'draft').length;
                    
                        return (
                          <div
                            key={test.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => setSelectedTestId(test.id)}
                            data-testid={`card-test-${test.id}`}
                          >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1" data-testid={`text-test-title-${test.id}`}>
                              {test.statements[0]?.description || (test.testBatchId ? 'Test Batch' : 'Legacy Statement')}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {test.statements.length} ad statement{test.statements.length > 1 ? 's' : ''}
                            </p>
                            <div className="flex space-x-2">
                              {draftCount > 0 && (
                                <Badge className="bg-gray-100 text-gray-700 text-xs">
                                  {draftCount} draft
                                </Badge>
                              )}
                              {pendingCount > 0 && (
                                <Badge className="bg-warning text-white text-xs">
                                  {pendingCount} pending
                                </Badge>
                              )}
                              {revisionCount > 0 && (
                                <Badge className="bg-orange-500 text-white text-xs">
                                  {revisionCount} revision{revisionCount > 1 ? 's' : ''}
                                </Badge>
                              )}
                              {approvedCount > 0 && (
                                <Badge className="bg-success text-white text-xs">
                                  {approvedCount} approved
                                </Badge>
                              )}
                              {/* Show deployment status */}
                              {test.statements[0]?.deploymentStatus === 'ready' && (
                                <Badge className="bg-green-600 text-white text-xs">
                                  🚀 Ready to Deploy
                                </Badge>
                              )}
                              {test.statements[0]?.deploymentStatus === 'completed' && (
                                <Badge className="bg-gray-600 text-white text-xs">
                                  ✓ Completed
                                </Badge>
                              )}
                            </div>
                          </div>
                          {/* Delete button for test batches only - show for any test with testBatchId */}
                          {test.testBatchId && (
                            <div className="flex-shrink-0 ml-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200 hover:border-red-400 px-3 py-1"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent card click
                                  handleDeleteTest(test);
                                }}
                                data-testid={`button-delete-test-${test.id}`}
                              >
                                🗑️ Delete
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Created {test.createdAt ? new Date(test.createdAt).toLocaleDateString() : 'Unknown date'}
                        </div>
                      </div>
                    );
                  })}
                  {!tests.length && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No tests found</p>
                      <Button
                        onClick={() => setShowNewStatementModal(true)}
                        className="mt-4"
                        variant="outline"
                        data-testid="button-create-first-test"
                      >
                        Create your first test
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                // Show statements within selected test
                <>
                  <div className="mb-4">
                    <Button
                      onClick={() => {setSelectedTestId(null); setSelectedStatementId(null);}}
                      variant="outline"
                      size="sm"
                    >
                      ← Back to Tests
                    </Button>
                  </div>
                  {selectedTest?.statements.map((statement: any) => (
                    <div
                      key={statement.id}
                      className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                        selectedStatementId === statement.id ? 'border-primary shadow-md' : ''
                      }`}
                      onClick={() => {
                        const targetStatementId = statement.id;
                        
                        // If no statement is currently selected, select directly
                        if (!selectedStatementId) {
                          setSelectedStatementId(targetStatementId);
                        } else if (selectedStatementId !== targetStatementId) {
                          // If different statement selected, send navigation request to check for unsaved changes
                          setNavigationRequest({ targetStatementId, timestamp: Date.now() });
                        }
                        // If same statement clicked, do nothing
                      }}
                      data-testid={`card-statement-${statement.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-1" data-testid={`text-statement-heading-${statement.id}`}>
                            {statement.heading || 'No heading'}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2" data-testid={`text-statement-content-${statement.id}`}>
                            {statement.content}
                          </p>
                        </div>
                        <Badge className={getStatusColor(statement.status)} data-testid={`status-statement-${statement.id}`}>
                          {statement.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span data-testid={`text-statement-creator-${statement.id}`}>
                          Created by {statement.creator.firstName} {statement.creator.lastName}
                        </span>
                        <span data-testid={`text-statement-date-${statement.id}`}>
                          {statement.createdAt ? new Date(statement.createdAt).toLocaleDateString() : 'No date'}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Statement Editor & Preview */}
          {selectedStatement ? (
            <StatementEditor
              key={selectedStatement.id} // Phase 1 Fix: Add key prop for proper re-mounting
              statement={selectedStatement}
              onStatementUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'statements'] });
                queryClient.invalidateQueries({ queryKey: ['/api/statements', selectedStatementId] });
              }}
              navigationRequest={navigationRequest} // Step 1: New navigation request pattern
              onNavigationComplete={(statementId) => {
                setSelectedStatementId(statementId);
                setNavigationRequest(null); // Clear request after completion
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <i className="fas fa-edit text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  {selectedTestId ? 'Select a Statement' : 'Select a Test'}
                </h3>
                <p className="text-gray-500">
                  {selectedTestId 
                    ? 'Choose a statement from the test to edit and preview'
                    : 'Choose a test to view its statements, or create a new test'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* New Statement Modal */}
      {showNewStatementModal && (
        <NewStatementModal
          projectId={projectId!}
          onClose={() => setShowNewStatementModal(false)}
          onStatementCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'statements'] });
            setShowNewStatementModal(false);
          }}
        />
      )}

      {/* Delete Test Batch Dialog */}
      {testToDelete && (
        <DeleteTestBatchDialog
          isOpen={!!testToDelete}
          onClose={() => setTestToDelete(null)}
          onConfirm={confirmDeleteTest}
          testBatchInfo={{
            statementsCount: testToDelete.statementsCount,
            testBatchId: testToDelete.testBatchId
          }}
          isDeleting={deleteTestBatchMutation.isPending}
        />
      )}

      {/* Project Settings Modal */}
      {showProjectSettings && project && (
        <ProjectSettings
          project={project}
          onClose={() => setShowProjectSettings(false)}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        statements={statements || []}
        onExport={(statementIds, exportType) => exportMutation.mutate({ statementIds, exportType })}
        isExporting={exportMutation.isPending}
      />

      {/* Deployment Ready Dialog */}
      {deploymentReadyTest && (
        <DeploymentReadyDialog
          open={!!deploymentReadyTest}
          onOpenChange={(open) => {
            console.log('Dialog onOpenChange called with:', open);
            if (!open) {
              console.log('Closing deployment dialog via onOpenChange');
              setDeploymentReadyTest(null);
            }
          }}
          testBatch={deploymentReadyTest}
          onMarkReadyToDeploy={() => {
            if (deploymentReadyTest.testBatchId) {
              markReadyToDeployMutation.mutate(deploymentReadyTest.testBatchId);
            }
          }}
          onNotYet={() => {
            console.log('Not Yet clicked - dismissing dialog permanently');
            const testBatchId = deploymentReadyTest?.testBatchId;
            if (testBatchId) {
              // Add to recently marked set to prevent re-detection
              setRecentlyMarkedTestIds(prev => new Set([...Array.from(prev), testBatchId]));
              console.log('Added to recently marked set to prevent reopening:', testBatchId);
            }
            setDeploymentReadyTest(null);
          }}
          isProcessing={markReadyToDeployMutation.isPending}
        />
      )}
    </div>
  );
}
