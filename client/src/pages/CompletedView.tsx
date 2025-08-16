import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { StatementWithRelations } from "@shared/schema";

export default function CompletedView() {
  const { user } = useAuth();

  const { data: statements, isLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/statements', { status: 'completed' }],
  });

  // Group completed statements into finished tests
  const groupedTests = statements?.reduce((acc, statement) => {
    const testKey = `${statement.projectId}-${statement.createdAt ? new Date(statement.createdAt).toISOString().split('T')[0] : 'no-date'}`;
    if (!acc[testKey]) {
      acc[testKey] = {
        id: testKey,
        projectId: statement.projectId,
        projectName: statement.project?.name || 'Unknown Project',
        statements: [],
        createdAt: statement.createdAt,
        completedCount: 0
      };
    }
    acc[testKey].statements.push(statement);
    if (statement.status === 'completed') {
      acc[testKey].completedCount++;
    }
    return acc;
  }, {} as Record<string, any>) || {};

  const completedTests = Object.values(groupedTests).filter((test: any) => test.completedCount > 0);

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
              <p className="text-gray-600 mt-1">Finished Facebook advertising campaigns and their results</p>
            </div>
            <Badge className="bg-gray-500 text-white text-lg px-4 py-2">
              {completedTests.length} completed
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Table View for Completed Tests */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Test Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed Ads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {completedTests.map(test => (
                    <tr key={test.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {test.projectName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {test.statements.length} total statements
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {test.statements.slice(0, 2).map((statement: any) => (
                            <div key={statement.id} className="text-sm text-gray-700 truncate max-w-xs">
                              {statement.heading}
                            </div>
                          ))}
                          {test.statements.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{test.statements.length - 2} more...
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className="bg-gray-500 text-white">
                          {test.completedCount} completed
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {test.createdAt ? new Date(test.createdAt).toLocaleDateString() : 'Unknown date'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Link href={`/projects/${test.projectId}`}>
                            <Button variant="outline" size="sm">
                              <i className="fas fa-eye mr-1 text-xs"></i>
                              View
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-800">
                            <i className="fas fa-chart-bar mr-1 text-xs"></i>
                            Analytics
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {completedTests.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-trophy text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No completed tests yet</h3>
              <p className="text-gray-500">Complete your first advertising campaign to see results here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}