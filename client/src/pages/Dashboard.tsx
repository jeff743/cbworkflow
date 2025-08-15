import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { ProjectWithStats, StatementWithRelations } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects'],
  });

  const { data: myStatements, isLoading: myStatementsLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/my-statements'],
  });

  const { data: reviewStatements, isLoading: reviewStatementsLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/review-statements'],
  });

  if (projectsLoading || myStatementsLoading || reviewStatementsLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-secondary">CB Workflow</h1>
              <p className="text-gray-600">Welcome back, {(user as any)?.firstName}</p>
            </div>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/logout'}
            variant="outline"
            data-testid="button-logout"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>
            Sign Out
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Projects Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-secondary mb-4">Your Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map(project => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-project-${project.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{project.name}</h3>
                      <Badge variant="secondary" data-testid={`text-active-tests-${project.id}`}>
                        {project.activeTestsCount} active
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{project.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Client: {project.clientName}</span>
                      <span>{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'No date'}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-primary" data-testid="text-assigned-count">
                {myStatements?.length || 0}
              </div>
              <p className="text-sm text-gray-600">Assigned to Me</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-warning" data-testid="text-review-count">
                {reviewStatements?.length || 0}
              </div>
              <p className="text-sm text-gray-600">Pending Review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-success" data-testid="text-approved-count">
                {myStatements?.filter(s => s.status === 'approved').length || 0}
              </div>
              <p className="text-sm text-gray-600">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-error" data-testid="text-revision-count">
                {myStatements?.filter(s => s.status === 'needs_revision').length || 0}
              </div>
              <p className="text-sm text-gray-600">Need Revision</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Statements */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">My Recent Statements</h3>
              <div className="space-y-3">
                {myStatements?.slice(0, 5).map(statement => (
                  <div key={statement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm" data-testid={`text-statement-heading-${statement.id}`}>
                        {statement.heading || 'No heading'}
                      </h4>
                      <p className="text-xs text-gray-600" data-testid={`text-project-name-${statement.id}`}>
                        {statement.project.name}
                      </p>
                    </div>
                    <Badge className={getStatusColor(statement.status)} data-testid={`status-${statement.id}`}>
                      {statement.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
                {!myStatements?.length && (
                  <p className="text-sm text-gray-500 text-center py-4">No statements assigned to you</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Review Queue */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Review Queue</h3>
              <div className="space-y-3">
                {reviewStatements?.slice(0, 5).map(statement => (
                  <div key={statement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm" data-testid={`text-review-heading-${statement.id}`}>
                        {statement.heading || 'No heading'}
                      </h4>
                      <p className="text-xs text-gray-600" data-testid={`text-review-project-${statement.id}`}>
                        {statement.project.name}
                      </p>
                    </div>
                    <Badge className="bg-warning text-white">Review</Badge>
                  </div>
                ))}
                {!reviewStatements?.length && (
                  <p className="text-sm text-gray-500 text-center py-4">No statements pending review</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
