import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar } from "@/components/Sidebar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useState } from "react";
import type { ProjectWithStats, StatementWithRelations, User } from "@shared/schema";

const createProjectFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
});

type CreateProjectFormData = z.infer<typeof createProjectFormSchema>;

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showManageUsers, setShowManageUsers] = useState(false);

  const projectForm = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const onCreateProject = (data: CreateProjectFormData) => {
    // Use project name as client name
    const projectData = {
      name: data.name,
      clientName: data.name,
      description: `Project for ${data.name}`,
      status: "active" as const,
    };
    createProjectMutation.mutate(projectData);
  };

  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects'],
  });

  const { data: myStatements, isLoading: myStatementsLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/my-statements'],
  });

  const { data: reviewStatements, isLoading: reviewStatementsLoading } = useQuery<StatementWithRelations[]>({
    queryKey: ['/api/dashboard/review-statements'],
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: (user as any)?.role === 'super_admin',
  });

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


  if (projectsLoading || myStatementsLoading || reviewStatementsLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1">
          <div className="max-w-7xl mx-auto p-6">
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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <header className="bg-surface border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-secondary">Dashboard</h1>
              <p className="text-gray-600">Welcome back, {(user as any)?.firstName}</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Create Project Button */}
              <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-primary text-white hover:bg-primary-dark"
                    data-testid="button-create-project"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
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
                              <Input placeholder="Enter client name" {...field} data-testid="input-project-name" />
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
                          data-testid="button-submit-project"
                        >
                          {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Manage Users Button (Super Admin only) */}
              {(user as any)?.role === 'super_admin' && (
                <Dialog open={showManageUsers} onOpenChange={setShowManageUsers}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline"
                      data-testid="button-manage-users"
                    >
                      <i className="fas fa-users mr-2"></i>
                      Manage Users
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Manage Users</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {allUsers?.map(userItem => (
                        <div key={userItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium" data-testid={`text-user-${userItem.id}`}>
                              {userItem.firstName} {userItem.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{userItem.email}</p>
                          </div>
                          <Select 
                            value={userItem.role} 
                            onValueChange={(role) => updateUserRoleMutation.mutate({ userId: userItem.id, role })}
                            disabled={updateUserRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-48" data-testid={`select-role-${userItem.id}`}>
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
    </div>
  );
}