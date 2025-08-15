import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { ProjectWithStats, StatementWithRelations } from "@shared/schema";

export function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const { data: projects } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects'],
  });

  const { data: myStatements } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/my-statements'],
  });

  const { data: reviewStatements } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/review-statements'],
  });

  const newStatementsCount = myStatements?.filter(s => s.status === 'draft').length || 0;
  const pendingReviewCount = reviewStatements?.length || 0;
  const designQueueCount = myStatements?.filter(s => s.status === 'approved').length || 0;
  const readyToDeployCount = myStatements?.filter(s => s.status === 'completed').length || 0;

  return (
    <div className="w-64 bg-surface shadow-lg flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/">
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-secondary">CB Workflow</h1>
              <p className="text-sm text-gray-500">CRO Management</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Projects</h3>
          <div className="space-y-1">
            {projects?.map(project => {
              const isActive = location.startsWith(`/projects/${project.id}`);
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className={`flex items-center justify-between p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-primary text-white' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`} data-testid={`link-project-${project.id}`}>
                    <div className="flex items-center space-x-3">
                      <i className="fas fa-folder text-sm"></i>
                      <span>{project.name}</span>
                    </div>
                    <Badge
                      variant={isActive ? "secondary" : "outline"}
                      className={isActive ? "bg-white bg-opacity-20 text-white border-white" : ""}
                      data-testid={`text-project-tests-${project.id}`}
                    >
                      {project.activeTestsCount}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Workflow</h3>
          <div className="space-y-1">
            <Link href="/">
              <div className="flex items-center justify-between p-3 text-sm rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center space-x-3">
                  <i className="fas fa-edit"></i>
                  <span>New Statements</span>
                </div>
                {newStatementsCount > 0 && (
                  <Badge className="bg-warning text-white" data-testid="text-new-statements-count">
                    {newStatementsCount}
                  </Badge>
                )}
              </div>
            </Link>
            <Link href="/">
              <div className="flex items-center justify-between p-3 text-sm rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center space-x-3">
                  <i className="fas fa-eye"></i>
                  <span>Pending Review</span>
                </div>
                {pendingReviewCount > 0 && (
                  <Badge className="bg-error text-white" data-testid="text-pending-review-count">
                    {pendingReviewCount}
                  </Badge>
                )}
              </div>
            </Link>
            <Link href="/">
              <div className="flex items-center justify-between p-3 text-sm rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center space-x-3">
                  <i className="fas fa-palette"></i>
                  <span>Design Queue</span>
                </div>
                {designQueueCount > 0 && (
                  <Badge className="bg-accent text-white" data-testid="text-design-queue-count">
                    {designQueueCount}
                  </Badge>
                )}
              </div>
            </Link>
            <Link href="/">
              <div className="flex items-center justify-between p-3 text-sm rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center space-x-3">
                  <i className="fas fa-rocket"></i>
                  <span>Ready to Deploy</span>
                </div>
                {readyToDeployCount > 0 && (
                  <Badge className="bg-success text-white" data-testid="text-ready-deploy-count">
                    {readyToDeployCount}
                  </Badge>
                )}
              </div>
            </Link>
          </div>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {(user as any)?.firstName?.[0]}{(user as any)?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" data-testid="text-user-name">
              {(user as any)?.firstName} {(user as any)?.lastName}
            </p>
            <p className="text-xs text-gray-500" data-testid="text-user-role">
              {(user as any)?.role?.replace('_', ' ') || 'User'}
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/api/logout'}
            className="text-gray-400 hover:text-gray-600"
            data-testid="button-sidebar-logout"
          >
            <i className="fas fa-sign-out-alt text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
