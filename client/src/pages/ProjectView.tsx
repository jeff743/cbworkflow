import { useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StatementEditor } from "@/components/StatementEditor";
import { NewStatementModal } from "@/components/NewStatementModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Project, StatementWithRelations } from "@shared/schema";

export default function ProjectView() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewStatementModal, setShowNewStatementModal] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
  });

  const { data: statements, isLoading: statementsLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/projects', projectId, 'statements', statusFilter === 'all' ? undefined : statusFilter],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/export`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Export Complete",
        description: `Downloaded ${data.count} approved colorblocks`,
      });
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

  if (projectLoading || statementsLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="w-64 bg-surface animate-pulse"></div>
        <div className="flex-1 animate-pulse bg-gray-50"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Not Found</h1>
          <p className="text-gray-600">The project you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Group statements into tests by testBatchId
  const groupedTests = statements?.reduce((acc, statement) => {
    // Skip statements without testBatchId (legacy statements) - group them individually
    const testKey = statement.testBatchId || statement.id;
    if (!acc[testKey]) {
      acc[testKey] = {
        id: testKey,
        testBatchId: statement.testBatchId,
        statements: [],
        projectId: statement.projectId,
        createdAt: statement.createdAt,
      };
    }
    acc[testKey].statements.push(statement);
    return acc;
  }, {} as Record<string, any>) || {};

  const tests = Object.values(groupedTests);
  const selectedTest = tests.find(t => t.id === selectedTestId);
  const selectedStatement = selectedTest?.statements.find(s => s.id === selectedStatementId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under_review': return 'bg-warning text-white';
      case 'approved': return 'bg-success text-white';
      case 'needs_revision': return 'bg-error text-white';
      case 'in_design': return 'bg-accent text-white';
      case 'completed': return 'bg-success text-white';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
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
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
                className="bg-success text-white hover:bg-green-600"
                data-testid="button-export-approved"
              >
                <i className="fas fa-download text-sm mr-2"></i>
                {exportMutation.isPending ? "Exporting..." : "Export Approved"}
              </Button>
              <Button
                onClick={() => setShowNewStatementModal(true)}
                className="bg-primary text-white hover:bg-primary-dark"
                data-testid="button-new-test"
              >
                <i className="fas fa-plus text-sm mr-2"></i>
                New Test
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
              {!selectedTestId ? (
                // Show test cards when no test is selected
                <>
                  {tests.map(test => {
                    const completedCount = test.statements.filter(s => s.status === 'completed').length;
                    const approvedCount = test.statements.filter(s => s.status === 'approved').length;
                    const pendingCount = test.statements.filter(s => s.status === 'under_review').length;
                    const draftCount = test.statements.filter(s => s.status === 'draft').length;
                    
                    return (
                      <div
                        key={test.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedTestId(test.id)}
                        data-testid={`card-test-${test.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {test.testBatchId ? `Test Batch` : 'Legacy Statement'}
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
                              {approvedCount > 0 && (
                                <Badge className="bg-success text-white text-xs">
                                  {approvedCount} approved
                                </Badge>
                              )}
                              {completedCount > 0 && (
                                <Badge className="bg-gray-500 text-white text-xs">
                                  {completedCount} completed
                                </Badge>
                              )}
                            </div>
                          </div>
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
                  {selectedTest?.statements.map(statement => (
                    <div
                      key={statement.id}
                      className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                        selectedStatementId === statement.id ? 'border-primary shadow-md' : ''
                      }`}
                      onClick={() => setSelectedStatementId(statement.id)}
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
              statement={selectedStatement}
              onStatementUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'statements'] });
                queryClient.invalidateQueries({ queryKey: ['/api/statements', selectedStatementId] });
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
    </div>
  );
}
