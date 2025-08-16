import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { nanoid } from "nanoid";
import type { User, InsertStatement } from "@shared/schema";

interface NewStatementModalProps {
  projectId: string;
  onClose: () => void;
  onStatementCreated: () => void;
}

export function NewStatementModal({ projectId, onClose, onStatementCreated }: NewStatementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    assignedTo: "unassigned",
    description: "",
    priority: "normal" as const,
    dueDate: "",
    quantity: 1,
  });

  // Fetch all users to populate assignment dropdown
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Filter for copywriters (creative_strategists)
  const copywriters = users?.filter(user => user.role === 'creative_strategist') || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      // Generate a unique batch ID for this test
      const testBatchId = nanoid();
      console.log('⚡ NEW BATCH LOGIC - Generated testBatchId:', testBatchId);
      console.log('⚡ NEW BATCH INFO - Quantity:', formData.quantity, 'Project:', projectId);
      
      // Create statements array with guaranteed shared testBatchId (bulletproof approach)
      const statements = Array.from({ length: formData.quantity }, (_, i) => ({
        projectId,
        testBatchId, // Same reference for all statements
        description: formData.description || undefined, // Task description for the test
        content: `Facebook ad statement ${i + 1} - write your compelling ad text here`,
        heading: `FB Ad ${i + 1}`,
        status: "draft" as const,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        assignedTo: formData.assignedTo === "unassigned" || !formData.assignedTo ? undefined : formData.assignedTo,
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
                {copywriters.map(copywriter => (
                  <SelectItem key={copywriter.id} value={copywriter.id}>
                    {copywriter.firstName && copywriter.lastName 
                      ? `${copywriter.firstName} ${copywriter.lastName}` 
                      : copywriter.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Test Title
            </Label>
            <Textarea
              id="description"
              placeholder="Enter a descriptive title for this test (e.g., 'Holiday Sale - Value Prop Test', 'Q1 Brand Awareness Campaign')..."
              className="resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
