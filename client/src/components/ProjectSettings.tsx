import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ObjectUploader } from "./ObjectUploader";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

interface ProjectSettingsProps {
  project: Project;
  onClose: () => void;
}

export function ProjectSettings({ project, onClose }: ProjectSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await apiRequest('POST', `/api/projects/${project.id}/background-images`, {
        backgroundImageURL: imageUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Background Image Added",
        description: "The background image has been added to your project.",
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    },
    onError: (error) => {
      console.error("Error adding background image:", error);
      toast({
        title: "Failed to Add Image",
        description: "Could not add the background image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await apiRequest('DELETE', `/api/projects/${project.id}/background-images`, {
        imageUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Background Image Removed",
        description: "The background image has been removed from your project.",
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    },
    onError: (error) => {
      console.error("Error removing background image:", error);
      toast({
        title: "Failed to Remove Image",
        description: "Could not remove the background image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/objects/upload');
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      addImageMutation.mutate(uploadURL);
    }
  };

  const handleRemoveImage = (imageUrl: string) => {
    removeImageMutation.mutate(imageUrl);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Project Settings - {project.name}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="button-close-settings"
          >
            ✕
          </Button>
        </div>

        <div className="space-y-6">
          {/* Background Images Section */}
          <div>
            <h3 className="text-lg font-medium mb-4">Background Images</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload background images that will be available as options when creating statements in this project.
              Recommended size: 1080x1080 pixels or larger.
            </p>

            {/* Upload New Image */}
            <div className="mb-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Add New Background Image
              </Label>
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10485760}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-center"
              >
                <span className="text-sm">
                  {addImageMutation.isPending ? "Uploading..." : "Upload Background Image"}
                </span>
              </ObjectUploader>
            </div>

            {/* Current Background Images */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Current Background Images ({project.backgroundImages?.length || 0})
              </Label>
              
              {project.backgroundImages && project.backgroundImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {project.backgroundImages.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="relative border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div
                        className="w-full h-32 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${imageUrl.startsWith('/') 
                            ? `${window.location.origin}${imageUrl}`
                            : imageUrl
                          })`,
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveImage(imageUrl)}
                          disabled={removeImageMutation.isPending}
                          data-testid={`button-remove-image-${index}`}
                          className="h-8 w-8 p-0"
                        >
                          {removeImageMutation.isPending ? "..." : "✕"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <p>No background images uploaded yet.</p>
                  <p className="text-sm">Upload images above to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-6 border-t border-gray-200">
          <Button
            onClick={onClose}
            data-testid="button-close-settings-footer"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}