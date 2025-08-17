import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportModal } from "@/components/ExportModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { StatementWithRelations } from "@shared/schema";

interface DeploymentTest {
  id: string;
  testBatchId?: string | null;
  projectId: string;
  projectName: string;
  statements: StatementWithRelations[];
  readyDate: string;
  status: 'ready' | 'deploying' | 'deployed' | 'failed';
}

export default function DeploymentDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTest, setSelectedTest] = useState<DeploymentTest | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Fetch all ready-to-deploy tests
  const { data: deploymentTests, isLoading } = useQuery<DeploymentTest[]>({
    queryKey: ['/api/deployment/tests', statusFilter === 'all' ? undefined : statusFilter],
  });

  const exportMutation = useMutation({
    mutationFn: async ({ statementIds, exportType }: { statementIds: string[], exportType: 'all' | 'selected' | 'single' }) => {
      const params = new URLSearchParams();
      if (exportType !== 'all') {
        statementIds.forEach(id => params.append('ids', id));
      }
      const url = `/api/deployment/export${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'deployment_colorblocks.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
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
        ? 'Downloaded 1 colorblock for deployment'
        : `Downloaded ${data.count} colorblock${data.count !== 1 ? 's' : ''} for deployment`;
      
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
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({
        title: "Export Failed",
        description: "Failed to export deployment colorblocks",
        variant: "destructive",
      });
    },
  });

  const updateDeploymentStatus = useMutation({
    mutationFn: async ({ testId, status }: { testId: string, status: string }) => {
      const response = await apiRequest('PUT', `/api/deployment/tests/${testId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployment/tests'] });
      toast({
        title: "Status Updated",
        description: "Deployment status has been updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({
        title: "Update Failed",
        description: "Failed to update deployment status",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-success text-white';
      case 'deploying': return 'bg-accent text-white';
      case 'deployed': return 'bg-primary text-white';
      case 'failed': return 'bg-error text-white';
      default: return 'bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return 'fa-rocket';
      case 'deploying': return 'fa-spinner fa-spin';
      case 'deployed': return 'fa-check-circle';
      case 'failed': return 'fa-exclamation-circle';
      default: return 'fa-circle';
    }
  };

  const filteredTests = deploymentTests?.filter(test => 
    statusFilter === 'all' || test.status === statusFilter
  ) || [];

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-3xl text-gray-400 mb-4"></i>
            <p className="text-gray-600">Loading deployment dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-surface border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-secondary" data-testid="text-deployment-title">
                Deployment Dashboard
              </h2>
              <p className="text-gray-600 mt-1">
                Manage and deploy approved colorblock tests to Facebook Ads
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setShowExportModal(true)}
                disabled={exportMutation.isPending || filteredTests.length === 0}
                className="bg-success text-white hover:bg-green-600"
                data-testid="button-export-deployment"
              >
                <i className="fas fa-download text-sm mr-2"></i>
                {exportMutation.isPending ? "Exporting..." : "Export All"}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden p-6">
          {/* Stats and Filter */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-success">
                    {deploymentTests?.filter(t => t.status === 'ready').length || 0}
                  </div>
                  <p className="text-sm text-gray-600">Ready to Deploy</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-accent">
                    {deploymentTests?.filter(t => t.status === 'deploying').length || 0}
                  </div>
                  <p className="text-sm text-gray-600">Deploying</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">
                    {deploymentTests?.filter(t => t.status === 'deployed').length || 0}
                  </div>
                  <p className="text-sm text-gray-600">Deployed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-error">
                    {deploymentTests?.filter(t => t.status === 'failed').length || 0}
                  </div>
                  <p className="text-sm text-gray-600">Failed</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">Filter by status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ready">Ready to Deploy</SelectItem>
                  <SelectItem value="deploying">Deploying</SelectItem>
                  <SelectItem value="deployed">Deployed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deployment Tests List */}
          <div className="space-y-4 overflow-y-auto">
            {filteredTests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <i className="fas fa-rocket text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Deployment Tests</h3>
                  <p className="text-gray-500">
                    {statusFilter === 'all' 
                      ? 'No tests are ready for deployment yet.'
                      : `No tests with status "${statusFilter}" found.`
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredTests.map((test) => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-lg font-semibold">
                            {test.testBatchId ? 'Test Batch' : 'Legacy Test'}
                          </h3>
                          <Badge className={getStatusColor(test.status)}>
                            <i className={`fas ${getStatusIcon(test.status)} mr-1`}></i>
                            {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <span className="font-medium text-gray-700">Project:</span>
                            <p className="text-gray-600">{test.projectName}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Ready Date:</span>
                            <p className="text-gray-600">{new Date(test.readyDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Statements:</span>
                            <p className="text-gray-600">{test.statements.length} approved</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Colorblocks:</span>
                            <p className="text-gray-600">
                              {test.statements.filter(s => s.colorblockImageUrl).length} ready
                            </p>
                          </div>
                        </div>

                        {/* Statement Preview */}
                        <div className="flex space-x-2 mb-4">
                          {test.statements.slice(0, 5).map((statement, index) => (
                            <div key={statement.id} className="w-12 h-12 bg-gray-100 rounded border overflow-hidden">
                              {statement.colorblockImageUrl ? (
                                <img
                                  src={statement.colorblockImageUrl}
                                  alt="Colorblock"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <i className="fas fa-image text-xs"></i>
                                </div>
                              )}
                            </div>
                          ))}
                          {test.statements.length > 5 && (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-xs font-medium text-gray-500">
                              +{test.statements.length - 5}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTest(test);
                            setShowExportModal(true);
                          }}
                          disabled={exportMutation.isPending}
                          className="bg-success text-white hover:bg-green-600"
                        >
                          <i className="fas fa-download mr-1"></i>
                          Export
                        </Button>
                        
                        {test.status === 'ready' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDeploymentStatus.mutate({ testId: test.id, status: 'deploying' })}
                            disabled={updateDeploymentStatus.isPending}
                          >
                            <i className="fas fa-rocket mr-1"></i>
                            Deploy
                          </Button>
                        )}
                        
                        {test.status === 'deploying' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDeploymentStatus.mutate({ testId: test.id, status: 'deployed' })}
                            disabled={updateDeploymentStatus.isPending}
                          >
                            <i className="fas fa-check mr-1"></i>
                            Mark Deployed
                          </Button>
                        )}
                        
                        {test.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDeploymentStatus.mutate({ testId: test.id, status: 'ready' })}
                            disabled={updateDeploymentStatus.isPending}
                          >
                            <i className="fas fa-redo mr-1"></i>
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        statements={selectedTest ? selectedTest.statements : 
          filteredTests.flatMap(test => test.statements)}
        onExport={(statementIds, exportType) => exportMutation.mutate({ statementIds, exportType })}
        isExporting={exportMutation.isPending}
      />
    </div>
  );
}