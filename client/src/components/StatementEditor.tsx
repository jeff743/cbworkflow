import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ColorblockPreview } from "./ColorblockPreview";
import { ObjectUploader } from "./ObjectUploader";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { StatementWithRelations, UpdateStatement } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

interface StatementEditorProps {
  statement: StatementWithRelations;
  onStatementUpdated: () => void;
  navigationRequest?: { targetStatementId: string; timestamp: number } | null;
  onNavigationComplete?: (statementId: string) => void;
}

export function StatementEditor({ statement, onStatementUpdated, navigationRequest, onNavigationComplete }: StatementEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"edit" | "review">("edit");
  const [formData, setFormData] = useState({
    heading: statement.heading || "",
    content: statement.content || "",
    footer: statement.footer || "",
    headingFontSize: statement.headingFontSize || 80,
    statementFontSize: statement.statementFontSize || 60,
    footerFontSize: statement.footerFontSize || 35,
    textAlignment: (statement.textAlignment || "center") as "left" | "center" | "right",
    backgroundColor: statement.backgroundColor || "#4CAF50",
    backgroundImageUrl: statement.backgroundImageUrl || "",
  });
  const [useTrueFalse, setUseTrueFalse] = useState(
    statement.heading?.includes("True or False?") || false
  );
  const [reviewNotes, setReviewNotes] = useState(statement.reviewNotes || "");

  // Phase 2 Fix: Add unsaved changes detection
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false); // Step 3: Immediate state access
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingNavigationRequest, setPendingNavigationRequest] = useState<{ targetStatementId: string; timestamp: number } | null>(null);

  // Phase 1 Fix: Add useEffect for Statement Prop Changes
  useEffect(() => {
    setFormData({
      heading: statement.heading || "",
      content: statement.content || "",
      footer: statement.footer || "",
      headingFontSize: statement.headingFontSize || 80,
      statementFontSize: statement.statementFontSize || 60,
      footerFontSize: statement.footerFontSize || 35,
      textAlignment: (statement.textAlignment || "center") as "left" | "center" | "right",
      backgroundColor: statement.backgroundColor || "#4CAF50",
      backgroundImageUrl: statement.backgroundImageUrl || "",
    });
    setUseTrueFalse(statement.heading?.includes("True or False?") || false);
    setReviewNotes(statement.reviewNotes || "");
  }, [statement.id]); // Key on statement.id to detect changes

  // Phase 2 Fix: Add useEffect to detect form changes
  useEffect(() => {
    const hasChanges = 
      formData.heading !== (statement.heading || "") ||
      formData.content !== (statement.content || "") ||
      formData.footer !== (statement.footer || "") ||
      formData.headingFontSize !== (statement.headingFontSize || 80) ||
      formData.statementFontSize !== (statement.statementFontSize || 60) ||
      formData.footerFontSize !== (statement.footerFontSize || 35) ||
      formData.textAlignment !== (statement.textAlignment || "center") ||
      formData.backgroundColor !== (statement.backgroundColor || "#4CAF50") ||
      formData.backgroundImageUrl !== (statement.backgroundImageUrl || "");
    
    setHasUnsavedChanges(hasChanges);
    hasUnsavedChangesRef.current = hasChanges; // Step 3: Immediate access
  }, [formData, statement]);

  // Handle True/False checkbox toggle
  const handleTrueFalseToggle = (checked: boolean) => {
    setUseTrueFalse(checked);
    if (checked) {
      // Replace entire heading with "True or False?"
      setFormData(prev => ({ ...prev, heading: "True or False?" }));
    } else {
      // Clear the heading field when unchecked
      setFormData(prev => ({ ...prev, heading: "" }));
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateStatement) => {
      const response = await apiRequest('PUT', `/api/statements/${statement.id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Statement Updated",
        description: "Your changes have been saved successfully.",
      });
      onStatementUpdated();
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
        description: "Failed to update statement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveDraft = () => {
    updateMutation.mutate(formData);
    setHasUnsavedChanges(false); // Reset unsaved changes after save
    hasUnsavedChangesRef.current = false; // Reset ref as well
  };

  const handleSubmitForReview = () => {
    updateMutation.mutate({
      ...formData,
      status: "under_review",
    });
    setHasUnsavedChanges(false); // Reset unsaved changes after submit
    hasUnsavedChangesRef.current = false; // Reset ref as well
  };

  // Step 4: Improved dialog state management
  const handleDiscardChanges = () => {
    if (pendingNavigationRequest) {
      onNavigationComplete?.(pendingNavigationRequest.targetStatementId);
      setPendingNavigationRequest(null);
    }
    setShowUnsavedChangesDialog(false);
  };

  const handleSaveAndContinue = () => {
    handleSaveDraft(); // Save current changes
    
    // Wait for save to complete, then navigate
    setTimeout(() => {
      if (pendingNavigationRequest) {
        onNavigationComplete?.(pendingNavigationRequest.targetStatementId);
        setPendingNavigationRequest(null);
      }
      setShowUnsavedChangesDialog(false);
    }, 100);
  };

  // Step 1: New navigation request handler using immediate ref access
  const handleInternalNavigationRequest = useCallback((request: { targetStatementId: string; timestamp: number }) => {
    console.log('🧭 NAVIGATION REQUEST:', {
      currentStatement: statement.id,
      targetStatement: request.targetStatementId,
      hasUnsavedChanges: hasUnsavedChangesRef.current,
      timestamp: request.timestamp
    });

    if (hasUnsavedChangesRef.current) {
      // Show confirmation dialog
      setPendingNavigationRequest(request);
      setShowUnsavedChangesDialog(true);
    } else {
      // Allow immediate navigation
      onNavigationComplete?.(request.targetStatementId);
    }
  }, [statement.id, onNavigationComplete]);

  // Step 1: Watch for navigation requests from parent
  useEffect(() => {
    if (navigationRequest && navigationRequest.targetStatementId !== statement.id) {
      handleInternalNavigationRequest(navigationRequest);
    }
  }, [navigationRequest, statement.id, handleInternalNavigationRequest]);

  const handleReviewAction = (action: "approved" | "needs_revision") => {
    updateMutation.mutate({
      status: action,
      reviewedBy: (user as any)?.id,
      reviewNotes: reviewNotes,
    });
  };

  const handleGetUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/objects/upload');
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  // Legacy upload handler - no longer used as images are now managed at project level
  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      try {
        const response = await apiRequest('PUT', '/api/background-images', {
          backgroundImageURL: uploadURL,
        });
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          backgroundImageUrl: data.objectPath,
        }));
        toast({
          title: "Background Image Uploaded",
          description: "Your background image has been uploaded successfully.",
        });
      } catch (error) {
        console.error("Error in upload completion:", error);
        toast({
          title: "Upload Failed",
          description: "Failed to set background image. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const canEdit = statement.status === "draft" || statement.status === "needs_revision";
  const canReview = (user as any)?.role === "growth_strategist" && statement.status === "under_review";

  const colorOptions = [
    "#EF4444", "#3B82F6", "#10B981", "#F59E0B", 
    "#8B5CF6", "#EC4899", "#1F2937", "#4CAF50"
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Editor Tabs */}
      <div className="bg-surface border-b border-gray-200">
        <div className="flex">
          <button
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "edit"
                ? "text-primary border-primary bg-blue-50"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("edit")}
            data-testid="tab-edit-statement"
          >
            Edit Statement
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "review"
                ? "text-primary border-primary bg-blue-50"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("review")}
            data-testid="tab-review-approve"
          >
            Review & Approve
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "edit" ? (
          <>
            {/* Form Panel */}
            <div className="w-1/2 p-6 bg-gray-50 overflow-y-auto">
              <div className="space-y-6">
                {/* Heading Field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="heading" className="text-sm font-medium text-gray-700">
                      Heading (Optional)
                    </Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="trueFalseCheckbox"
                        checked={useTrueFalse}
                        onChange={(e) => handleTrueFalseToggle(e.target.checked)}
                        disabled={!canEdit}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        data-testid="checkbox-true-false"
                      />
                      <Label htmlFor="trueFalseCheckbox" className="text-xs text-gray-600 cursor-pointer">
                        True or False?
                      </Label>
                    </div>
                  </div>
                  <Textarea
                    id="heading"
                    placeholder="Enter optional heading text..."
                    className="resize-none"
                    rows={2}
                    value={formData.heading}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setFormData(prev => ({ ...prev, heading: newValue }));
                      // Update checkbox state based on whether "True or False?" is present
                      setUseTrueFalse(newValue.includes("True or False?"));
                    }}
                    disabled={!canEdit}
                    data-testid="input-heading"
                  />
                </div>

                {/* Statement Field */}
                <div>
                  <Label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                    Statement Content <span className="text-error">*</span>
                  </Label>
                  <Textarea
                    id="content"
                    placeholder="Enter your statement content..."
                    className="resize-none"
                    rows={4}
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    disabled={!canEdit}
                    data-testid="input-content"
                  />
                </div>

                {/* Footer Field */}
                <div>
                  <Label htmlFor="footer" className="block text-sm font-medium text-gray-700 mb-2">
                    Footer (Optional)
                  </Label>
                  <Textarea
                    id="footer"
                    placeholder="Enter optional footer text..."
                    className="resize-none"
                    rows={2}
                    value={formData.footer}
                    onChange={(e) => setFormData(prev => ({ ...prev, footer: e.target.value }))}
                    disabled={!canEdit}
                    data-testid="input-footer"
                  />
                </div>

                {/* Typography Controls */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">Typography Settings</h4>
                  
                  {/* Heading Font Size */}
                  <div>
                    <Label className="block text-xs text-gray-600 mb-2">
                      Heading Font Size: <span className="font-medium">{formData.headingFontSize}px</span>
                    </Label>
                    <Slider
                      value={[formData.headingFontSize]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, headingFontSize: value }))}
                      min={50}
                      max={120}
                      step={1}
                      disabled={!canEdit}
                      data-testid="slider-heading-font-size"
                    />
                  </div>

                  {/* Statement Font Size */}
                  <div>
                    <Label className="block text-xs text-gray-600 mb-2">
                      Statement Font Size: <span className="font-medium">{formData.statementFontSize}px</span>
                    </Label>
                    <Slider
                      value={[formData.statementFontSize]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, statementFontSize: value }))}
                      min={40}
                      max={100}
                      step={1}
                      disabled={!canEdit}
                      data-testid="slider-statement-font-size"
                    />
                  </div>

                  {/* Footer Font Size */}
                  <div>
                    <Label className="block text-xs text-gray-600 mb-2">
                      Footer Font Size: <span className="font-medium">{formData.footerFontSize}px</span>
                    </Label>
                    <Slider
                      value={[formData.footerFontSize]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, footerFontSize: value }))}
                      min={20}
                      max={60}
                      step={1}
                      disabled={!canEdit}
                      data-testid="slider-footer-font-size"
                    />
                  </div>

                  {/* Text Alignment */}
                  <div>
                    <Label className="block text-xs text-gray-600 mb-2">Text Alignment</Label>
                    <div className="flex space-x-2">
                      {["left", "center", "right"].map((alignment) => (
                        <button
                          key={alignment}
                          type="button"
                          className={`flex-1 px-3 py-2 text-xs border border-gray-300 rounded transition-colors ${
                            formData.textAlignment === alignment
                              ? "bg-primary text-white border-primary"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, textAlignment: alignment as "left" | "center" | "right" }))}
                          disabled={!canEdit}
                          data-testid={`button-align-${alignment}`}
                        >
                          <i className={`fas fa-align-${alignment} mr-1`}></i>
                          {alignment.charAt(0).toUpperCase() + alignment.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Background Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">Background</h4>
                  
                  {/* Background Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Background Type</span>
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs border border-gray-300 rounded transition-colors ${
                          !formData.backgroundImageUrl
                            ? "bg-primary text-white border-primary"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => setFormData(prev => ({ ...prev, backgroundImageUrl: "" }))}
                        disabled={!canEdit}
                        data-testid="button-solid-color"
                      >
                        Solid Color
                      </button>
                    </div>
                    
                    {/* Project Background Images */}
                    {statement.project.backgroundImages && statement.project.backgroundImages.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-600 mb-2 block">Project Background Images</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {statement.project.backgroundImages.map((imageUrl, index) => (
                            <button
                              key={index}
                              type="button"
                              className={`relative h-16 bg-cover bg-center border-2 rounded transition-colors ${
                                formData.backgroundImageUrl === imageUrl
                                  ? "border-primary"
                                  : "border-gray-300 hover:border-gray-400"
                              }`}
                              style={{
                                backgroundImage: `url(${
                                  imageUrl.startsWith('/') 
                                    ? `${window.location.origin}${imageUrl}`
                                    : imageUrl
                                })`,
                              }}
                              onClick={() => setFormData(prev => ({ ...prev, backgroundImageUrl: imageUrl }))}
                              disabled={!canEdit}
                              data-testid={`button-project-image-${index}`}
                            >
                              {formData.backgroundImageUrl === imageUrl && (
                                <div className="absolute inset-0 bg-primary bg-opacity-20 flex items-center justify-center rounded">
                                  <i className="fas fa-check text-primary text-lg"></i>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {(!statement.project.backgroundImages || statement.project.backgroundImages.length === 0) && (
                      <div className="text-center py-4 text-gray-500 text-xs border-2 border-dashed border-gray-300 rounded">
                        <p>No project background images available.</p>
                        <p>Add images in Project Settings.</p>
                      </div>
                    )}
                  </div>

                  {!formData.backgroundImageUrl && (
                    <>
                      {/* Color Picker */}
                      <div className="grid grid-cols-8 gap-2">
                        {colorOptions.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-8 h-8 rounded-lg cursor-pointer border-2 transition-colors ${
                              formData.backgroundColor === color
                                ? "border-primary"
                                : "border-transparent hover:border-gray-300"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setFormData(prev => ({ ...prev, backgroundColor: color }))}
                            disabled={!canEdit}
                            data-testid={`button-color-${color.slice(1)}`}
                          />
                        ))}
                      </div>

                      {/* Custom Color Input */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={formData.backgroundColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                          className="w-10 h-8 rounded border border-gray-300"
                          disabled={!canEdit}
                          data-testid="input-custom-color"
                        />
                        <input
                          type="text"
                          value={formData.backgroundColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                          className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                          disabled={!canEdit}
                          data-testid="input-color-hex"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                {canEdit && (
                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleSaveDraft}
                      disabled={updateMutation.isPending}
                      data-testid="button-save-draft"
                    >
                      {hasUnsavedChanges && <span className="inline-block w-2 h-2 bg-orange-400 rounded-full mr-2"></span>}
                      {updateMutation.isPending ? "Saving..." : "Save Draft"}
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-primary hover:bg-primary-dark"
                      onClick={handleSubmitForReview}
                      disabled={updateMutation.isPending || !formData.content.trim()}
                      data-testid="button-submit-review"
                    >
                      {hasUnsavedChanges && <span className="inline-block w-2 h-2 bg-orange-400 rounded-full mr-2"></span>}
                      {updateMutation.isPending ? "Submitting..." : "Submit for Review"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Live Preview Panel */}
            <div className="w-1/2 p-6 bg-white overflow-y-auto">
              <ColorblockPreview
                heading={formData.heading}
                content={formData.content}
                footer={formData.footer}
                headingFontSize={formData.headingFontSize}
                statementFontSize={formData.statementFontSize}
                footerFontSize={formData.footerFontSize}
                textAlignment={formData.textAlignment}
                backgroundColor={formData.backgroundColor}
                backgroundImageUrl={formData.backgroundImageUrl}
              />
            </div>
          </>
        ) : (
          /* Review Tab Content */
          <div className="flex-1 p-6 bg-gray-50 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Review Statement</h3>
                <div className="bg-white rounded-lg p-6 space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Heading</Label>
                    <p className="mt-1 text-gray-900" data-testid="text-review-heading">
                      {statement.heading || "No heading"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Content</Label>
                    <p className="mt-1 text-gray-900" data-testid="text-review-content">
                      {statement.content}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Created by</Label>
                      <p className="mt-1 text-gray-900" data-testid="text-review-creator">
                        {statement.creator.firstName} {statement.creator.lastName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Created</Label>
                      <p className="mt-1 text-gray-900" data-testid="text-review-date">
                        {statement.createdAt ? new Date(statement.createdAt).toLocaleDateString() : 'No date'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {canReview && (
                <div>
                  <Label htmlFor="reviewNotes" className="block text-sm font-medium text-gray-700 mb-2">
                    Review Notes
                  </Label>
                  <Textarea
                    id="reviewNotes"
                    placeholder="Add any feedback or notes for the copywriter..."
                    className="resize-none"
                    rows={4}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    data-testid="input-review-notes"
                  />
                </div>
              )}

              {canReview && (
                <div className="flex space-x-3">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleReviewAction("needs_revision")}
                    disabled={updateMutation.isPending}
                    data-testid="button-request-revision"
                  >
                    {updateMutation.isPending ? "Processing..." : "Request Revision"}
                  </Button>
                  <Button
                    className="flex-1 bg-success hover:bg-green-600"
                    onClick={() => handleReviewAction("approved")}
                    disabled={updateMutation.isPending}
                    data-testid="button-approve"
                  >
                    {updateMutation.isPending ? "Processing..." : "Approve"}
                  </Button>
                </div>
              )}

              {!canReview && statement.status === "under_review" && (
                <div className="text-center py-4">
                  <p className="text-gray-600">This statement is awaiting review by a growth strategist.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phase 2 Fix: Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this statement. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedChangesDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleDiscardChanges}
              className="text-red-600 hover:text-red-800"
            >
              Discard Changes
            </Button>
            <AlertDialogAction onClick={handleSaveAndContinue}>
              Save & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
