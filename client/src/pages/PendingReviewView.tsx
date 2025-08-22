import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import type { StatementWithRelations, ProjectWithStats } from "@shared/schema";

export default function PendingReviewView() {
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

  // Use project-specific endpoint
  const { data: statements, isLoading } = useQuery<StatementWithRelations[]>({
    queryKey: [`/api/projects/${projectId}/statements`],
    enabled: !!projectId,
  });

  // Group statements into tests that have at least one pending statement, excluding deployed tests
  const groupedTests = statements?.reduce((acc, statement) => {
    // Skip tests that have been moved to Ready to Deploy or Completed
    if (statement.deploymentStatus === 'ready' || statement.deploymentStatus === 'completed') {
      return acc;
    }

    // Only include statements from the current project
    if (statement.projectId !== projectId) {
      return acc;
    }

    const testKey = statement.testBatchId || `${statement.projectId}-${statement.createdAt ? new Date(statement.createdAt).toISOString().split('T')[0] : 'no-date'}`;
    if (!acc[testKey]) {
      acc[testKey] = {
        id: testKey,
        projectId: statement.projectId,
        projectName: statement.project?.name || 'Unknown Project',
        statements: [],
        createdAt: statement.createdAt,
        pendingCount: 0
      };
    }
    acc[testKey].statements.push(statement);
    if (statement.status === 'under_review') {
      acc[testKey].pendingCount++;
    }
    return acc;
  }, {} as Record<string, any>) || {};

  const testsWithPendingReview = Object.values(groupedTests).filter((test: any) => test.pendingCount > 0);

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
                  <h2 className="text-2xl font-bold text-secondary">Pending Review</h2>
                  <p className="text-gray-600 mt-1">Tests with statements awaiting approval</p>
                </div>
              </div>
            </div>
            <Badge className="bg-error text-white text-lg px-4 py-2">
              {testsWithPendingReview.length} test{testsWithPendingReview.length !== 1 ? 's' : ''} pending
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testsWithPendingReview.map(test => (
              <Link key={test.id} href={`/projects/${test.projectId}`}>
                <div className="bg-white border border-red-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {test.statements[0]?.description || (test.testBatchId ? 'Test Batch' : 'Legacy Statement')}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {test.projectName} • {test.statements.length} ad statement{test.statements.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge className="bg-error text-white">
                      {test.pendingCount} pending
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {test.statements.filter((s: any) => s.status === 'under_review').slice(0, 3).map((statement: any) => (
                      <div key={statement.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 truncate">{statement.heading}</span>
                          <Badge className="bg-warning text-white text-xs">
                            Under Review
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {test.pendingCount > 3 && (
                      <p className="text-xs text-gray-500">
                        +{test.pendingCount - 3} more pending review
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Created {test.createdAt ? new Date(test.createdAt).toLocaleDateString() : 'Unknown date'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {testsWithPendingReview.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-check-circle text-6xl text-green-300 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">All caught up!</h3>
              <p className="text-gray-500">No tests are currently pending review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}