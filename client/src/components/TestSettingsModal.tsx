import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { SpellCheckIndicator } from "./SpellCheckIndicator";
import type { User, UpdateStatement, ProjectWithStats } from "@shared/schema";

interface TestSettingsModalProps {
  test: any;
  projectId: string;
  onClose: () => void;
  onTestUpdated: () => void;
}

export function TestSettingsModal({ test, projectId, onClose, onTestUpdated }: TestSettingsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    projectId: projectId || "",
    description: "",
    assignedTo: "unassigned",
    growthStrategistId: "unassigned",
    priority: "normal" as const,
    dueDate: "",
    quantity: 1,
  });
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Initialize form data when test changes
  useEffect(() => {
    if (test && test.statements.length > 0) {
      const firstStatement = test.statements[0];
      setFormData({
        projectId: firstStatement.projectId || projectId || "",
        description: firstStatement.description || "",
        assignedTo: firstStatement.assignedTo || "unassigned",
        growthStrategistId: firstStatement.growthStrategistId || "unassigned",
        priority: firstStatement.priority || "normal",
        dueDate: firstStatement.dueDate ? new Date(firstStatement.dueDate).toISOString().split('T')[0] : "",
        quantity: test.statements.length,
      });
    }
  }, [test, projectId]);

  // Try to fetch all users - allow creative strategists to see other users for assignment
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/users'],
    retry: false, // Don't retry on permission failure
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Debug logging for users
  console.log('🔍 USERS DEBUG:', {
    usersCount: users?.length || 0,
    usersLoading,
    usersError,
    currentUserRole: (user as any)?.role,
    availableUsers: users?.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role }))
  });

  // Fetch projects for the project dropdown
  const { data: projects } = useQuery<ProjectWithStats[]>({
    queryKey: ['/api/projects'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Build available assignees list
  const availableAssignees = (() => {
    // If we have full user list, filter for creative strategists
    if (users && users.length > 0) {
      const creativeStrategists = users.filter(u => u.role === 'creative_strategist');
      console.log('🔍 CREATIVE STRATEGISTS:', {
        totalUsers: users.length,
        creativeStrategistsCount: creativeStrategists.length,
        creativeStrategists: creativeStrategists.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role }))
      });
      return creativeStrategists;
    }

    // Otherwise, if current user is a creative strategist, include them
    if ((user as any)?.role === 'creative_strategist') {
      console.log('🔍 CURRENT USER IS CREATIVE STRATEGIST:', { user: user });
      return [user as User];
    }

    // Fallback to empty array
    console.log('🔍 NO CREATIVE STRATEGISTS FOUND');
    return [];
  })();

  // Build available growth strategists list
  const availableGrowthStrategists = (() => {
    // If we have full user list, filter for growth strategists
    if (users && users.length > 0) {
      const growthStrategists = users.filter(u => u.role === 'growth_strategist');
      console.log('🔍 GROWTH STRATEGISTS:', {
        totalUsers: users.length,
        growthStrategistsCount: growthStrategists.length,
        growthStrategists: growthStrategists.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role }))
      });
      return growthStrategists;
    }

    // Otherwise, if current user is a growth strategist, include them
    if ((user as any)?.role === 'growth_strategist') {
      console.log('🔍 CURRENT USER IS GROWTH STRATEGIST:', { user: user });
      return [user as User];
    }

    // Fallback to empty array
    console.log('🔍 NO GROWTH STRATEGISTS FOUND');
    return [];
  })();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const currentCount = test.statements.length;
      const newCount = formData.quantity;

      try {
        // Update existing statements with new common fields
        const updatePromises = test.statements.map((statement: any) => {
          const updates: UpdateStatement = {
            description: formData.description || undefined,
            priority: formData.priority,
            dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
            assignedTo: formData.assignedTo === "unassigned" || !formData.assignedTo ? undefined : formData.assignedTo,
          };

          return apiRequest('PUT', `/api/statements/${statement.id}`, updates);
        });

        await Promise.all(updatePromises);

        // Handle ad count changes
        if (newCount > currentCount) {
          // Add new ads
          const newAdsToCreate = newCount - currentCount;
          const newStatements = Array.from({ length: newAdsToCreate }, (_, i) => ({
            projectId: formData.projectId,
            testBatchId: test.testBatchId,
            description: formData.description || undefined,
            content: `Facebook ad statement ${currentCount + i + 1} - write your compelling ad text here`,
            heading: `FB Ad ${currentCount + i + 1}`,
            status: "draft" as const,
            priority: formData.priority,
            dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
            assignedTo: formData.assignedTo === "unassigned" || !formData.assignedTo ? undefined : formData.assignedTo,
          }));

          await apiRequest('POST', '/api/statements/batch', {
            statements: newStatements,
            testBatchId: test.testBatchId
          });
        } else if (newCount < currentCount) {
          // Remove highest numbered ads
          const adsToRemove = currentCount - newCount;
          const statementsToDelete = test.statements
            .sort((a: any, b: any) => {
              const aNum = parseInt(a.heading?.match(/\d+/)?.[0] || '0');
              const bNum = parseInt(b.heading?.match(/\d+/)?.[0] || '0');
              return bNum - aNum; // Sort in descending order to get highest numbers first
            })
            .slice(0, adsToRemove);

          const deletePromises = statementsToDelete.map((statement: any) =>
            apiRequest('DELETE', `/api/statements/${statement.id}`)
          );

          await Promise.all(deletePromises);
        }

        return { success: true };
      } catch (error) {
        console.error('Error updating test settings:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Test Updated",
        description: "Test settings have been updated successfully.",
      });
      onTestUpdated();
      onClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Update Failed",
        description: "Failed to update test settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that a project is selected
    if (!formData.projectId) {
      toast({
        title: "Project Required",
        description: "Please select a project for this test.",
        variant: "destructive",
      });
      return;
    }

    // Validate quantity
    if (formData.quantity < 1 || formData.quantity > 10) {
      toast({
        title: "Invalid Quantity",
        description: "Number of ads must be between 1 and 10.",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation if deleting ads
    if (formData.quantity < test.statements.length) {
      setShowDeleteConfirmation(true);
      return;
    }

    updateMutation.mutate();
  };

  if (!test) return null;

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl" data-testid="modal-test-settings">
          <DialogHeader>
            <DialogTitle>Test Settings</DialogTitle>
            <DialogDescription>
              Update test properties including title, assignment, number of ads, priority, and due date
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
                Project
              </Label>
              <Select 
                value={formData.projectId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger data-testid="select-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Copywriter
              </Label>
              <Select 
                value={formData.assignedTo} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}
              >
                <SelectTrigger data-testid="select-assign-to">
                  <SelectValue placeholder="Select a copywriter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {availableAssignees.map(assignee => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {assignee.firstName && assignee.lastName 
                        ? `${assignee.firstName} ${assignee.lastName}` 
                        : assignee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

                         <div>
               <Label htmlFor="growthStrategist" className="block text-sm font-medium text-gray-700 mb-2">
                 Assign to Growth Strategist
               </Label>
               <Select 
                 value={formData.growthStrategistId} 
                 onValueChange={(value) => setFormData(prev => ({ ...prev, growthStrategistId: value }))}
               >
                 <SelectTrigger data-testid="select-assign-growth-strategist">
                   <SelectValue placeholder="Select a growth strategist" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="unassigned">Unassigned</SelectItem>
                   {availableGrowthStrategists.map(strategist => (
                     <SelectItem key={strategist.id} value={strategist.id}>
                       {strategist.firstName && strategist.lastName 
                         ? `${strategist.firstName} ${strategist.lastName}` 
                         : strategist.email}
                     </SelectItem>
                   ))}
                   {availableGrowthStrategists.length === 0 && users && users.length > 0 && (
                     <div className="px-2 py-1 text-xs text-gray-500">
                       No growth strategists found. Showing all users:
                     </div>
                   )}
                   {availableGrowthStrategists.length === 0 && users && users.length > 0 && users.map(user => (
                     <SelectItem key={user.id} value={user.id}>
                       {user.firstName && user.lastName 
                         ? `${user.firstName} ${user.lastName} (${user.role})` 
                         : `${user.email} (${user.role})`}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               {usersLoading && (
                 <p className="text-xs text-gray-500 mt-1">
                   Loading users...
                 </p>
               )}
               {usersError && (
                 <p className="text-xs text-red-500 mt-1">
                   Error loading users. Please try again.
                 </p>
               )}
               {!usersLoading && !usersError && availableGrowthStrategists.length === 0 && users && users.length > 0 && (
                 <p className="text-xs text-gray-500 mt-1">
                   No growth strategists found. You can assign to any available user above.
                 </p>
               )}
               {!usersLoading && !usersError && (!users || users.length === 0) && (
                 <p className="text-xs text-red-500 mt-1">
                   No users available. Please contact an administrator.
                 </p>
               )}
             </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Test Title
                </Label>
                <SpellCheckIndicator 
                  text={formData.description} 
                  onTextChange={(newText) => setFormData(prev => ({ ...prev, description: newText }))}
                  customWords={['facebook', 'ad', 'campaign', 'test', 'batch', 'variant']}
                />
              </div>
              <Textarea
                id="description"
                placeholder="Enter a descriptive title for this test (e.g., 'Holiday Sale - Value Prop Test', 'Q1 Brand Awareness Campaign')..."
                className="resize-none"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                spellCheck={true}
                data-testid="input-test-title"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                  Ads in Test
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  data-testid="input-quantity"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.quantity > test.statements.length ? 
                    `Will add ${formData.quantity - test.statements.length} new ad${formData.quantity - test.statements.length > 1 ? 's' : ''}` :
                    formData.quantity < test.statements.length ?
                    `Will remove ${test.statements.length - formData.quantity} highest numbered ad${test.statements.length - formData.quantity > 1 ? 's' : ''}` :
                    'No change in ad count'
                  }
                </p>
              </div>
              <div>
                <Label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </Label>
                <Select value={formData.priority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  data-testid="input-due-date"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary-dark"
                disabled={updateMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Ad Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to remove {test.statements.length - formData.quantity} ad{test.statements.length - formData.quantity > 1 ? 's' : ''} from this test. 
              The highest numbered ad{test.statements.length - formData.quantity > 1 ? 's' : ''} will be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirmation(false);
                updateMutation.mutate();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Deleting..." : "Delete Ads"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
