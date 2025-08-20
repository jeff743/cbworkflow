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
import { SpellCheckIndicator } from "./SpellCheckIndicator";
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

  // Helper function to detect template content
  const isTemplateContent = (content: string) => {
    return content.match(/^Facebook ad statement \d+ - write your compelling ad text here$/);
  };

  const [activeTab, setActiveTab] = useState<"edit" | "review" | "design">("edit");
  const [formData, setFormData] = useState({
    heading: statement.heading || "",
    content: isTemplateContent(statement.content) ? "" : (statement.content || ""),
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
      content: isTemplateContent(statement.content) ? "" : (statement.content || ""),
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
    const originalContent = isTemplateContent(statement.content) ? "" : (statement.content || "");
    const hasChanges = 
      formData.heading !== (statement.heading || "") ||
      formData.content !== originalContent ||
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
    // Prepare data for saving - restore template content if field is empty
    const saveData = {
      ...formData,
      content: formData.content || (isTemplateContent(statement.content) ? statement.content : formData.content)
    };
    updateMutation.mutate(saveData);
    setHasUnsavedChanges(false); // Reset unsaved changes after save
    hasUnsavedChangesRef.current = false; // Reset ref as well
  };

  const handleSubmitForReview = () => {
    // Prepare data for saving - restore template content if field is empty
    const saveData = {
      ...formData,
      content: formData.content || (isTemplateContent(statement.content) ? statement.content : formData.content),
      status: "under_review" as const,
    };
    updateMutation.mutate(saveData);
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

  // Growth Strategists and Super Admins should only review, not edit
  const userRole = (user as any)?.role;
  const isReviewer = userRole === "growth_strategist" || userRole === "super_admin";
  
  const canEdit = (statement.status === "draft" || statement.status === "needs_revision") && !isReviewer;
  const canReview = isReviewer && statement.status === "under_review";
  const hasBeenReviewed = statement.status === "approved" || statement.status === "needs_revision";
  // Removed canManageDesign - Design & Deploy step eliminated

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
                {/* Review Feedback Section - Show when statement has been revised */}
                {statement.status === "needs_revision" && statement.reviewNotes && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          Revision Requested
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p><strong>Feedback from reviewer:</strong></p>
                          <p className="mt-1 whitespace-pre-wrap" data-testid="text-review-feedback">{statement.reviewNotes}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                    spellCheck={true}
                    data-testid="input-heading"
                  />
                </div>

                {/* Statement Field */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="content" className="block text-sm font-medium text-gray-700">
                      Statement Content <span className="text-error">*</span>
                    </Label>
                    <SpellCheckIndicator 
                      text={formData.content} 
                      onTextChange={(newText) => setFormData(prev => ({ ...prev, content: newText }))}
                      customWords={['facebook', 'ad', 'campaign', 'cro', 'conversion']}
                    />
                  </div>
                  <Textarea
                    id="content"
                    placeholder="Enter statement here..."
                    className="resize-none"
                    rows={4}
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    disabled={!canEdit}
                    spellCheck={true}
                    data-testid="input-content"
                  />
                </div>

                {/* Footer Field */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="footer" className="block text-sm font-medium text-gray-700">
                      Footer (Optional)
                    </Label>
                    <SpellCheckIndicator 
                      text={formData.footer} 
                      onTextChange={(newText) => setFormData(prev => ({ ...prev, footer: newText }))}
                      customWords={['facebook', 'ad', 'campaign', 'cro', 'conversion']}
                    />
                  </div>
                  <Textarea
                    id="footer"
                    placeholder="Enter optional footer text..."
                    className="resize-none"
                    rows={2}
                    value={formData.footer}
                    onChange={(e) => setFormData(prev => ({ ...prev, footer: e.target.value }))}
                    disabled={!canEdit}
                    spellCheck={true}
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
                      max={120}
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
                      max={120}
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
        ) : activeTab === "review" ? (
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
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <div className="flex items-center mb-3">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <Label htmlFor="reviewNotes" className="text-lg font-semibold text-blue-800 mb-1">
                            📝 Review Notes & Feedback
                          </Label>
                          <p className="text-sm text-blue-700 mt-1">
                            Add specific feedback here when requesting revisions. This will be sent to the copywriter to guide improvements.
                          </p>
                        </div>
                        <SpellCheckIndicator 
                          text={reviewNotes} 
                          onTextChange={setReviewNotes}
                          customWords={['copywriter', 'headline', 'cta', 'compelling', 'benefits']}
                          className="ml-2"
                        />
                      </div>
                    </div>
                  </div>
                  <Textarea
                    id="reviewNotes"
                    placeholder="Example: 'Please make the headline more compelling and add specific benefits in bullet points. The call-to-action should be stronger and more urgent.'"
                    className="resize-none border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                    rows={5}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    spellCheck={true}
                    data-testid="input-review-notes"
                  />
                  <div className="mt-2 flex items-center text-xs text-blue-600">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    💡 Tip: Detailed feedback helps copywriters understand exactly what needs improvement
                  </div>
                </div>
              )}

              {canReview && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-md font-semibold text-gray-800 mb-3">🎯 Review Decision</h4>
                  <div className="flex space-x-3">
                    <Button
                      variant="destructive"
                      className="flex-1 h-12 text-base font-medium"
                      onClick={() => {
                        if (!reviewNotes.trim()) {
                          alert("Please add review notes before requesting revision. This helps the copywriter understand what needs to be improved.");
                          return;
                        }
                        handleReviewAction("needs_revision");
                      }}
                      disabled={updateMutation.isPending}
                      data-testid="button-request-revision"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {updateMutation.isPending ? "Processing..." : "Request Revision"}
                    </Button>
                    <Button
                      className="flex-1 h-12 text-base font-medium bg-success hover:bg-green-600"
                      onClick={() => handleReviewAction("approved")}
                      disabled={updateMutation.isPending}
                      data-testid="button-approve"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {updateMutation.isPending ? "Processing..." : "Approve Statement"}
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-600">
                    <div className="text-center">
                      <p>💬 <strong>Request Revision:</strong> Send back with feedback for improvements</p>
                    </div>
                    <div className="text-center">
                      <p>✅ <strong>Approve:</strong> Move to ready-to-deploy status</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Review Completed Message */}
              {hasBeenReviewed && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <div className="flex items-center mb-3">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-green-800">
                        ✅ Review Completed
                      </h3>
                      <p className="text-sm text-green-700 mt-1">
                        This statement has been reviewed and {statement.status === "approved" ? "approved" : "returned for revision"}.
                      </p>
                    </div>
                  </div>
                  
                  {statement.reviewNotes && (
                    <div className="mt-4 bg-white rounded-lg p-4 border border-green-200">
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">Final Review Notes</Label>
                      <p className="text-gray-900 whitespace-pre-wrap" data-testid="text-final-review-notes">
                        {statement.reviewNotes}
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-4 text-center">
                    <p className="text-sm text-green-700">
                      {statement.status === "approved" 
                        ? "🎉 Statement is ready for deployment"
                        : "📝 Statement has been returned to the creator for revision"
                      }
                    </p>
                  </div>
                </div>
              )}

              {!canReview && !hasBeenReviewed && statement.status === "under_review" && (
                <div className="text-center py-4">
                  <p className="text-gray-600">This statement is awaiting review by a growth strategist.</p>
                </div>
              )}
            </div>
          </div>

        ) : null}
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
