import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ExportCompletionDialog } from "@/components/ExportCompletionDialog";
import type { StatementWithRelations } from "@shared/schema";
import { useState } from "react";

interface DeploymentTest {
  id: string;
  testBatchId: string;
  projectId: string;
  projectName: string;
  statements: StatementWithRelations[];
  readyDate: string;
  status: string;
}

export default function ReadyToDeployView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [exportedTestIds, setExportedTestIds] = useState<string[]>([]);

  const { data: readyTests = [], isLoading } = useQuery<DeploymentTest[]>({
    queryKey: ['/api/deployment/tests', 'ready'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/deployment/tests?status=ready');
      return response.json();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (testBatchIds: string[]) => {
      // Get statement IDs for the selected test batches
      const statementIds: string[] = [];
      
      readyTests.forEach((test) => {
        if (testBatchIds.includes(test.testBatchId)) {
          test.statements.forEach((statement) => {
            statementIds.push(statement.id);
          });
        }
      });
      
      const queryParams = statementIds.length > 0 
        ? `?${statementIds.map(id => `ids=${id}`).join('&')}`
        : '';
      
      const response = await apiRequest('GET', `/api/deployment/export${queryParams}`);
      
      // Handle blob response for ZIP file
      if (response.headers.get('content-type')?.includes('application/zip')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'deployment_colorblocks.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return { count: statementIds.length };
      }
      
      return response.json();
    },
    onSuccess: (data, testBatchIds) => {
      toast({
        title: "Export Complete",
        description: `Downloaded ${data.count} ready-to-deploy colorblocks`,
      });
      setExportedTestIds(testBatchIds);
      setShowCompletionDialog(true);
      queryClient.invalidateQueries({ queryKey: ['/api/deployment/tests'] });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export colorblocks",
        variant: "destructive",
      });
    },
  });

  const markCompletedMutation = useMutation({
    mutationFn: async (testBatchIds: string[]) => {
      const response = await apiRequest('POST', '/api/deployment/complete', {
        testBatchIds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tests Marked as Completed",
        description: `${exportedTestIds.length} test${exportedTestIds.length !== 1 ? 's' : ''} moved to Completed section`,
      });
      setShowCompletionDialog(false);
      setExportedTestIds([]);
      queryClient.invalidateQueries({ queryKey: ['/api/deployment/tests'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark tests as completed",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="w-64 bg-surface animate-pulse"></div>
        <div className="flex-1 animate-pulse bg-gray-50"></div>
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
              <h2 className="text-2xl font-bold text-secondary">Ready to Deploy</h2>
              <p className="text-gray-600 mt-1">Approved tests ready for Facebook advertising campaigns</p>
            </div>
            <Badge className="bg-success text-white text-lg px-4 py-2">
              {readyTests.length} test{readyTests.length !== 1 ? 's' : ''} ready
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {readyTests.map(test => (
              <div key={test.id} className="bg-white border border-green-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{test.projectName}</h3>
                    <p className="text-sm text-gray-600">
                      {test.statements.length} approved ad{test.statements.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge className="bg-success text-white">
                    Ready
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  {test.statements.slice(0, 3).map((statement) => (
                    <div key={statement.id} className="text-sm">
                      <span className="text-gray-700 truncate">{statement.heading || statement.content.slice(0, 30) + '...'}</span>
                    </div>
                  ))}
                  {test.statements.length > 3 && (
                    <p className="text-xs text-gray-500">
                      +{test.statements.length - 3} more statements
                    </p>
                  )}
                </div>

                <div className="flex space-x-2 mb-4">
                  <Link href={`/projects/${test.projectId}`}>
                    <Button variant="outline" size="sm" className="flex-1">
                      <i className="fas fa-eye mr-1 text-xs"></i>
                      View
                    </Button>
                  </Link>
                  <Button 
                    size="sm" 
                    className="flex-1 bg-success text-white hover:bg-green-600"
                    onClick={() => exportMutation.mutate([test.testBatchId])}
                    disabled={exportMutation.isPending}
                  >
                    <i className="fas fa-download mr-1 text-xs"></i>
                    {exportMutation.isPending ? "Exporting..." : "Export"}
                  </Button>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Ready {test.readyDate ? new Date(test.readyDate).toLocaleDateString() : 'Unknown date'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {readyTests.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-hourglass-half text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No tests ready to deploy</h3>
              <p className="text-gray-500">Complete the review process to get tests ready for deployment</p>
            </div>
          )}
        </div>
      </div>

      <ExportCompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => {
          setShowCompletionDialog(false);
          setExportedTestIds([]);
        }}
        onMarkCompleted={() => markCompletedMutation.mutate(exportedTestIds)}
        testCount={exportedTestIds.length}
      />
    </div>
  );
}