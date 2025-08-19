import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { StatementWithRelations } from "@shared/schema";

interface CompletedTest {
  id: string;
  testBatchId: string;
  projectId: string;
  projectName: string;
  statements: StatementWithRelations[];
  completedDate: string;
  status: string;
}

export default function CompletedView() {
  const { user } = useAuth();

  const { data: completedTests = [], isLoading } = useQuery<CompletedTest[]>({
    queryKey: ['/api/deployment/tests', 'completed'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/deployment/tests?status=completed');
      return response.json();
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
              <h2 className="text-2xl font-bold text-secondary">Completed Tests</h2>
              <p className="text-gray-600 mt-1">Successfully deployed and completed advertising campaigns</p>
            </div>
            <Badge className="bg-gray-600 text-white text-lg px-4 py-2">
              {completedTests.length} test{completedTests.length !== 1 ? 's' : ''} completed
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {completedTests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">✓</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Completed Tests Yet</h3>
              <p className="text-gray-500 mb-6">
                Tests will appear here after being exported and marked as completed.
              </p>
              <Link href="/dashboard">
                <Button className="bg-primary text-white hover:bg-primary-dark">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedTests.map(test => (
                <div key={test.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {test.statements[0]?.description || (test.testBatchId ? 'Test Batch' : 'Legacy Statement')}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {test.projectName} • {test.statements.length} completed ad{test.statements.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge className="bg-gray-600 text-white">
                      Completed
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

                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Completed:</span>
                      <span>{new Date(test.completedDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Link href={`/projects/${test.projectId}`}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        data-testid={`button-view-project-${test.id}`}
                      >
                        View Project
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}