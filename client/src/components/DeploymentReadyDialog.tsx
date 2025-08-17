import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { StatementWithRelations } from "@shared/schema";

interface DeploymentReadyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testBatch: {
    id: string;
    testBatchId?: string | null;
    statements: StatementWithRelations[];
    projectName: string;
  };
  onMarkReadyToDeploy: () => void;
  isProcessing: boolean;
}

export function DeploymentReadyDialog({ 
  open, 
  onOpenChange, 
  testBatch, 
  onMarkReadyToDeploy,
  isProcessing 
}: DeploymentReadyDialogProps) {
  const approvedStatements = testBatch.statements.filter(s => s.status === 'approved');
  const hasColorblocks = approvedStatements.filter(s => s.colorblockImageUrl).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <i className="fas fa-rocket mr-2 text-success"></i>
            Test Ready for Deployment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Test Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-green-800 mb-1">
                  All Statements Approved! 🎉
                </h3>
                <p className="text-sm text-green-700">
                  This test batch has completed the approval process and is ready for deployment.
                </p>
              </div>
              <Badge className="bg-green-600 text-white">
                {approvedStatements.length} Approved
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-800">Project:</span>
                <p className="text-green-700">{testBatch.projectName}</p>
              </div>
              <div>
                <span className="font-medium text-green-800">Colorblocks Generated:</span>
                <p className="text-green-700">{hasColorblocks} of {approvedStatements.length}</p>
              </div>
            </div>
          </div>

          {/* Statement Preview */}
          <div>
            <h4 className="font-semibold mb-3">Approved Statements</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {approvedStatements.map((statement, index) => (
                <div
                  key={statement.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                >
                  <div className="flex items-center space-x-3">
                    {/* Colorblock Thumbnail */}
                    <div className="w-12 h-12 bg-gray-200 rounded border overflow-hidden flex-shrink-0">
                      {statement.colorblockImageUrl ? (
                        <img
                          src={statement.colorblockImageUrl}
                          alt="Colorblock"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <i className="fas fa-image text-xs"></i>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {statement.heading || `Statement ${index + 1}`}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {statement.content}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-success text-white text-xs">
                      Approved
                    </Badge>
                    {statement.colorblockImageUrl && (
                      <i className="fas fa-check-circle text-success text-sm" title="Colorblock ready"></i>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deployment Options */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Next Steps</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div className="flex items-center">
                <i className="fas fa-arrow-right mr-2 text-xs"></i>
                Move to Deployment Dashboard for campaign management
              </div>
              <div className="flex items-center">
                <i className="fas fa-arrow-right mr-2 text-xs"></i>
                Export colorblocks for Facebook Ads Manager
              </div>
              <div className="flex items-center">
                <i className="fas fa-arrow-right mr-2 text-xs"></i>
                Track deployment performance and results
              </div>
            </div>
          </div>

          {/* Warning for Missing Colorblocks */}
          {hasColorblocks < approvedStatements.length && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <i className="fas fa-exclamation-triangle text-yellow-600 mr-2 mt-1"></i>
                <div>
                  <p className="font-medium text-yellow-800 mb-1">Incomplete Colorblocks</p>
                  <p className="text-sm text-yellow-700">
                    {approvedStatements.length - hasColorblocks} statement(s) don't have generated colorblocks yet. 
                    You can still mark this test as ready to deploy, but ensure all colorblocks are generated before final deployment.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between pt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Not Yet
          </Button>
          
          <Button
            onClick={onMarkReadyToDeploy}
            disabled={isProcessing}
            className="bg-success text-white hover:bg-green-600"
          >
            <i className="fas fa-rocket mr-2"></i>
            {isProcessing ? "Processing..." : "Mark Ready to Deploy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}