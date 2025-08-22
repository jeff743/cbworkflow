import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { StatementWithRelations, ProjectWithStats } from "@shared/schema";

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
  const [location, setLocation] = useLocation();

  // Project context detection
  const projectId = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectFromUrl = urlParams.get('project');
    if (projectFromUrl) {
      return projectFromUrl;
    }

    const pathMatch = location.match(/\/projects\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  }, [location]);

  // Get user's projects for validation
  const { data: projects } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects'],
  });

  // Show error when no project context
  if (!projectId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Project Context Required</h2>
          <p className="text-gray-600 mb-4">Please navigate from a specific project dashboard</p>
          <Button onClick={() => setLocation('/')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Use global deployment endpoint but filter by project
  const { data: allCompletedTests = [], isLoading } = useQuery<CompletedTest[]>({
    queryKey: ['/api/deployment/tests', 'completed'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/deployment/tests?status=completed');
      return response.json();
    },
  });

  // Filter tests by current project
  const completedTests = allCompletedTests.filter(test => test.projectId === projectId);

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
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => setLocation(`/projects/${projectId}`)}
                  variant="outline"
                  size="sm"
                >
                  ← Back to Project
                </Button>
                <div>
                  <h2 className="text-2xl font-bold text-secondary">Completed Tests</h2>
                  <p className="text-gray-600 mt-1">Successfully deployed and completed advertising campaigns</p>
                </div>
              </div>
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