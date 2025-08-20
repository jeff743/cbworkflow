import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { ProjectWithStats, StatementWithRelations, User } from "@shared/schema";

const createProjectFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
});

type CreateProjectFormData = z.infer<typeof createProjectFormSchema>;

export function Sidebar() {
  const [location] = useLocation();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showManageUsers, setShowManageUsers] = useState(false);
  const { toast } = useToast();

  const { data: user, refetch: refetchUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 401) {
          console.log('User not authenticated, but continuing to show UI');
          return null; // Return null instead of redirecting immediately
        }
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
    retry: false, // Don't retry on auth failures
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Pre-logout: Clear sensitive data immediately
      queryClient.clear();
      localStorage.clear(); 
      sessionStorage.clear();
      
      // Call logout endpoint
      const response = await fetch('/api/logout', {
        method: 'GET',
        credentials: 'include'
      });
      
      return response;
    },
    onSuccess: () => {
      // Force page reload to ensure complete state reset
      window.location.href = '/';
    },
    onError: (error) => {
      console.error('Logout error:', error);
      // Even if logout API fails, clear local state and redirect
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/api/logout';
    }
  });

  const refreshUserProfile = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/refresh", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include' // Ensure cookies are sent
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired');
        }
        throw new Error(`Refresh failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.id || !data.email) {
        throw new Error('Invalid user data received');
      }
      
      return data;
    },
    onSuccess: (freshUser) => {
      // Update user data in cache
      queryClient.setQueryData(["/api/auth/user"], freshUser);
      
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      toast({
        title: "Profile Refreshed",
        description: "Your profile data has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Profile refresh failed:', error);
      
      if (error.message === 'Session expired') {
        toast({
          title: "Session Expired", 
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        // Redirect to login after short delay
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 2000);
      } else {
        toast({
          title: "Refresh Failed",
          description: "Could not refresh profile data. Please try again.",
          variant: "destructive",
        });
      }
    }
  });

  const { data: projects } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects'],
    queryFn: () => fetch("/api/projects").then((res) => res.json()),
    enabled: !!user,
  });

  const { data: myStatements } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/my-statements'],
  });

  const { data: reviewStatements } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/review-statements'],
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: (user as any)?.role === 'super_admin',
  });

  const projectForm = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const onCreateProject = (data: CreateProjectFormData) => {
    const projectData = {
      name: data.name,
      clientName: data.name,
      description: `Project for ${data.name}`,
      status: "active" as const,
    };
    createProjectMutation.mutate(projectData);
  };

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/projects', data);
      const result = await response.json();
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setShowCreateProject(false);
      projectForm.reset();
      toast({
        title: "Success",
        description: "Project created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}/role`, { role });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const newStatementsCount = myStatements?.filter(s => s.status === 'draft').length || 0;
  const pendingReviewCount = reviewStatements?.length || 0;
  const readyToDeployCount = myStatements?.filter(s => s.status === 'completed').length || 0;

  const handleProjectClick = useCallback((projectId: string) => {
    // Signal to ProjectView to reset state
    queryClient.invalidateQueries({ queryKey: ['project-nav-reset', projectId] });
    // Store project in localStorage for future reference
    localStorage.setItem('lastVisitedProject', projectId);
  }, []);

  // Determine current project context for workflow links
  const getCurrentProjectId = () => {
    // Extract from URL if we're in a project view
    const projectMatch = location.match(/\/projects\/([^\/]+)/);
    if (projectMatch) {
      return projectMatch[1];
    }

    // Fallback to last visited project
    const lastProjectId = localStorage.getItem('lastVisitedProject');
    if (lastProjectId && projects?.some(p => p.id === lastProjectId)) {
      return lastProjectId;
    }

    // Fallback to first available project
    return projects?.[0]?.id || null;
  };

  const currentProjectId = getCurrentProjectId();

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
                <Link key={project.id} href={`/projects/${project.id}`} onClick={() => handleProjectClick(project.id)}>
                  <div className={`flex items-center p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-primary text-white' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`} data-testid={`link-project-${project.id}`}>
                    <div className="flex items-center space-x-3">
                      <i className="fas fa-folder text-sm"></i>
                      <span>{project.name}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Workflow</h3>
          <div className="space-y-1">
            <Link 
              href={currentProjectId ? `/tests/new?project=${currentProjectId}` : "/tests/new"}
              onClick={() => {
                if (currentProjectId) {
                  localStorage.setItem('lastVisitedProject', currentProjectId);
                  localStorage.setItem('lastNavTimestamp', Date.now().toString());
                  console.log('🚀 Sidebar: Navigating to New Tests for project:', currentProjectId);
                }
              }}
            >
              <div className={`flex items-center justify-between p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                location === '/tests/new' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <i className="fas fa-edit"></i>
                  <span>New Tests</span>
                </div>
                {newStatementsCount > 0 && (
                  <Badge className={location === '/tests/new' ? "bg-white bg-opacity-20 text-white border-white" : "bg-warning text-white"} data-testid="text-new-statements-count">
                    {newStatementsCount}
                  </Badge>
                )}
              </div>
            </Link>
            <Link href="/tests/pending-review">
              <div className={`flex items-center justify-between p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                location === '/tests/pending-review' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <i className="fas fa-eye"></i>
                  <span>Pending Review</span>
                </div>
                {pendingReviewCount > 0 && (
                  <Badge className={location === '/tests/pending-review' ? "bg-white bg-opacity-20 text-white border-white" : "bg-error text-white"} data-testid="text-pending-review-count">
                    {pendingReviewCount}
                  </Badge>
                )}
              </div>
            </Link>
            <Link href="/tests/ready-to-deploy">
              <div className={`flex items-center justify-between p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                location === '/tests/ready-to-deploy' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <i className="fas fa-rocket"></i>
                  <span>Ready to Deploy</span>
                </div>
                {readyToDeployCount > 0 && (
                  <Badge className={location === '/tests/ready-to-deploy' ? "bg-white bg-opacity-20 text-white border-white" : "bg-success text-white"} data-testid="text-ready-deploy-count">
                    {readyToDeployCount}
                  </Badge>
                )}
              </div>
            </Link>
            <Link href="/tests/completed">
              <div className={`flex items-center justify-between p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                location === '/tests/completed' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <i className="fas fa-check-circle"></i>
                  <span>Completed</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</h3>
          <div className="space-y-2">
            <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-left"
                  data-testid="button-sidebar-create-project"
                >
                  <i className="fas fa-plus mr-2"></i>
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Enter the client's name to create a new project.
                  </DialogDescription>
                </DialogHeader>
                <Form {...projectForm}>
                  <form onSubmit={projectForm.handleSubmit(onCreateProject)} className="space-y-4">
                    <FormField
                      control={projectForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter client name" {...field} data-testid="input-sidebar-project-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-3">
                      <Button type="button" variant="outline" onClick={() => setShowCreateProject(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createProjectMutation.isPending}
                        data-testid="button-sidebar-submit-project"
                      >
                        {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {(user as any)?.role === 'super_admin' && (
              <Dialog open={showManageUsers} onOpenChange={setShowManageUsers}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="w-full justify-start text-left"
                    data-testid="button-sidebar-manage-users"
                  >
                    <i className="fas fa-users mr-2"></i>
                    Manage Users
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Manage Users</DialogTitle>
                    <DialogDescription>
                      Update user roles and permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {allUsers?.map(userItem => (
                      <div key={userItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium" data-testid={`text-sidebar-user-${userItem.id}`}>
                            {userItem.firstName} {userItem.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{userItem.email}</p>
                        </div>
                        <Select 
                          value={userItem.role} 
                          onValueChange={(role) => updateUserRoleMutation.mutate({ userId: userItem.id, role })}
                          disabled={updateUserRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-48" data-testid={`select-sidebar-role-${userItem.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="creative_strategist">Creative Strategist</SelectItem>
                            <SelectItem value="growth_strategist">Growth Strategist</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {!allUsers?.length && (
                      <p className="text-center text-gray-500 py-4">No users found</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
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
            <p className="text-xs text-gray-500 truncate" data-testid="text-user-email">
              {(user as any)?.email}
            </p>
            <p className="text-xs text-gray-400 capitalize" data-testid="text-user-role">
              {(user as any)?.roleDisplayName || (user as any)?.role?.replace('_', ' ') || 'User'}
            </p>
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-red-500">
                <p>User: {user ? 'Yes' : 'No'}</p>
                <p>Role: {(user as any)?.role}</p>
                <p>Display: {(user as any)?.roleDisplayName}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* TEST: Force visible buttons row */}
        <div className="w-full bg-yellow-200 p-4 mt-2 border-4 border-red-500">
          <p className="text-black font-bold mb-2">BUTTONS TEST SECTION</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                console.log('Refresh clicked!');
                refreshUserProfile.mutate();
              }}
              disabled={refreshUserProfile.isPending}
              className="w-16 h-16 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center text-2xl font-bold border-4 border-blue-300 shadow-lg"
              title="Refresh profile"
              data-testid="button-sidebar-refresh"
            >
              🔄
            </button>
            <button
              onClick={() => {
                console.log('Logout clicked!');
                logoutMutation.mutate();
              }}
              disabled={logoutMutation.isPending}
              className="w-16 h-16 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center text-2xl font-bold border-4 border-red-300 shadow-lg"
              title={logoutMutation.isPending ? "Logging out..." : "Logout"}
              data-testid="button-sidebar-logout"
            >
              {logoutMutation.isPending ? "⏳" : "🚪"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}