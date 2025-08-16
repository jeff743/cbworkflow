import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { StatementWithRelations } from "@shared/schema";

export default function ReadyToDeployView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statements, isLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/statements', { status: 'approved' }],
  });

  // Group approved statements into deployable tests
  const groupedTests = statements?.reduce((acc, statement) => {
    const testKey = `${statement.projectId}-${statement.createdAt ? new Date(statement.createdAt).toISOString().split('T')[0] : 'no-date'}`;
    if (!acc[testKey]) {
      acc[testKey] = {
        id: testKey,
        projectId: statement.projectId,
        projectName: statement.project?.name || 'Unknown Project',
        statements: [],
        createdAt: statement.createdAt,
        approvedCount: 0
      };
    }
    acc[testKey].statements.push(statement);
    if (statement.status === 'approved') {
      acc[testKey].approvedCount++;
    }
    return acc;
  }, {} as Record<string, any>) || {};

  const readyTests = Object.values(groupedTests).filter((test: any) => test.approvedCount > 0);

  const exportMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/export`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Export Complete",
        description: `Downloaded ${data.count} approved colorblocks`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/statements'] });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export colorblocks",
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
                      {test.approvedCount} approved ad{test.approvedCount > 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge className="bg-success text-white">
                    Ready
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  {test.statements.filter((s: any) => s.status === 'approved').slice(0, 3).map((statement: any) => (
                    <div key={statement.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 truncate">{statement.heading}</span>
                        <Badge className="bg-success text-white text-xs">
                          Approved
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {test.approvedCount > 3 && (
                    <p className="text-xs text-gray-500">
                      +{test.approvedCount - 3} more approved
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
                    onClick={() => exportMutation.mutate(test.projectId)}
                    disabled={exportMutation.isPending}
                  >
                    <i className="fas fa-download mr-1 text-xs"></i>
                    {exportMutation.isPending ? "Exporting..." : "Export"}
                  </Button>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Created {test.createdAt ? new Date(test.createdAt).toLocaleDateString() : 'Unknown date'}
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
    </div>
  );
}