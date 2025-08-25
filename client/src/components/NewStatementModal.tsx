import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { nanoid } from "nanoid";
import { SpellCheckIndicator } from "./SpellCheckIndicator";
import type { User, InsertStatement, ProjectWithStats } from "@shared/schema";

interface NewStatementModalProps {
  projectId?: string; // Make optional to allow project selection
  onClose: () => void;
  onStatementCreated: () => void;
}

export function NewStatementModal({ projectId: initialProjectId, onClose, onStatementCreated }: NewStatementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    projectId: initialProjectId || "", // Add project selection to form data
    assignedTo: (user as any)?.id || "unassigned", // Default to current user if they're a creative strategist
    growthStrategistId: "unassigned", // New field for growth strategist assignment
    description: "",
    priority: "normal" as const,
    dueDate: "",
    quantity: 1,
  });

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

  const createMutation = useMutation({
    mutationFn: async () => {
      // Generate a unique batch ID for this test
      const testBatchId = nanoid();
             console.log('⚡ NEW BATCH LOGIC - Generated testBatchId:', testBatchId);
       console.log('⚡ NEW BATCH INFO - Quantity:', formData.quantity, 'Project:', formData.projectId);

       // Create statements array with guaranteed shared testBatchId (bulletproof approach)
       const statements = Array.from({ length: formData.quantity }, (_, i) => ({
         projectId: formData.projectId,
        testBatchId, // Same reference for all statements
        description: formData.description || undefined, // Task description for the test
        content: `Facebook ad statement ${i + 1} - write your compelling ad text here`,
        heading: `FB Ad ${i + 1}`,
        status: "draft" as const,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        assignedTo: formData.assignedTo === "unassigned" || !formData.assignedTo ? undefined : formData.assignedTo,
        growthStrategistId: formData.growthStrategistId === "unassigned" || !formData.growthStrategistId ? undefined : formData.growthStrategistId,
      }));

      console.log('⚡ STATEMENTS ARRAY CREATED - Batch consistency check:', {
        count: statements.length,
        allHaveSameBatchId: statements.every(stmt => stmt.testBatchId === testBatchId) ? '✅ SUCCESS' : '❌ FAILURE',
        batchIds: statements.map(stmt => stmt.testBatchId)
      });

      // Send as single batch request instead of individual calls
      console.log('⚡ SENDING BATCH REQUEST - testBatchId:', testBatchId);

      try {
        const response = await apiRequest('POST', '/api/statements/batch', {
          statements,
          testBatchId // Explicit batch ID in request body for server verification
        });

        const results = await response.json();

        console.log('⚡ BATCH REQUEST COMPLETE - Results:', {
          originalBatchId: testBatchId,
          createdCount: results.length,
          resultBatchIds: results.map((r: any) => r.testBatchId),
          allMatch: results.every((r: any) => r.testBatchId === testBatchId) ? '✅ SUCCESS' : '❌ FAILURE'
        });

        return results;
      } catch (error) {
        console.error('⚡ BATCH REQUEST FAILED:', error);
        throw error;
      }
    },
    onSuccess: (results) => {
      toast({
        title: "Test Created",
        description: `New test with ${results.length} ad statement${results.length > 1 ? 's' : ''} created and assigned successfully.`,
      });
      onStatementCreated();
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
        title: "Creation Failed",
        description: "Failed to create statement. Please try again.",
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

    createMutation.mutate();
  };

  // Get tomorrow's date as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDueDate = tomorrow.toISOString().split('T')[0];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="modal-new-statement">
        <DialogHeader>
          <DialogTitle>Create New Test</DialogTitle>
          <DialogDescription>
            Create a new Facebook test with up to 10 ad statements for A/B testing
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="projectId" className="block text-sm font-medium text-gray-700 mb-2">
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
             <Label htmlFor="growthStrategistId" className="block text-sm font-medium text-gray-700 mb-2">
               Assign to Growth Strategist
             </Label>
             <Select 
               value={formData.growthStrategistId} 
               onValueChange={(value) => setFormData(prev => ({ ...prev, growthStrategistId: value }))}
             >
               <SelectTrigger data-testid="select-growth-strategist">
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
                value={formData.dueDate || defaultDueDate}
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
              disabled={createMutation.isPending}
              data-testid="button-create-assign"
            >
              {createMutation.isPending 
                ? `Creating test with ${formData.quantity} ad${formData.quantity > 1 ? 's' : ''}...` 
                : `Create Test (${formData.quantity} Ad${formData.quantity > 1 ? 's' : ''})`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
