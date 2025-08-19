import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { NewStatementModal } from "@/components/NewStatementModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { StatementWithRelations } from "@shared/schema";

export default function NewTestsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewStatementModal, setShowNewStatementModal] = useState(false);

  const { data: statements, isLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/statements'],
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
              <h2 className="text-2xl font-bold text-secondary">New Tests</h2>
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
              <Link key={test.id} href={`/projects/${test.projectId}`}>
                <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{test.projectName}</h3>
                      <p className="text-sm text-gray-600">
                        {test.statements.length} ad statement{test.statements.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge className="bg-warning text-white">
                      In Progress
                    </Badge>
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
              </Link>
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

      {showNewStatementModal && (
        <NewStatementModal
          projectId={"b0036be7-62d1-4a9c-9c91-526743e72f8f"} // Default to first project for now
          onClose={() => setShowNewStatementModal(false)}
          onStatementCreated={() => {
            // Refresh data
            queryClient.invalidateQueries({ queryKey: ['/api/statements'] });
            setShowNewStatementModal(false);
          }}
        />
      )}
    </div>
  );
}