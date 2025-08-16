import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteTestBatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  testBatchInfo: {
    statementsCount: number;
    testBatchId?: string | null;
  };
  isDeleting?: boolean;
}

export function DeleteTestBatchDialog({
  isOpen,
  onClose,
  onConfirm,
  testBatchInfo,
  isDeleting = false,
}: DeleteTestBatchDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-delete-test">
            Delete Test Batch
          </DialogTitle>
          <DialogDescription data-testid="dialog-description-delete-test">
            Are you sure you want to delete this test batch? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <i className="fas fa-exclamation-triangle text-yellow-400 mr-2 mt-0.5"></i>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">
                  This will permanently delete:
                </h4>
                <ul className="mt-2 text-sm text-yellow-700">
                  <li>• {testBatchInfo.statementsCount} ad statement{testBatchInfo.statementsCount !== 1 ? 's' : ''}</li>
                  <li>• All associated content and reviews</li>
                  <li>• Any colorblock images generated</li>
                </ul>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mt-4">
            <strong>Recommendation:</strong> Make sure this test batch is completed before deleting it, 
            as you may lose valuable campaign data and insights.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="button-cancel-delete"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="button-confirm-delete"
          >
            <i className="fas fa-trash mr-2"></i>
            {isDeleting ? "Deleting..." : "Delete Test Batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}