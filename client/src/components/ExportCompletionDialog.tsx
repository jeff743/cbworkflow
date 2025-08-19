import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExportCompletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkCompleted: () => void;
  testCount: number;
}

export function ExportCompletionDialog({ 
  isOpen, 
  onClose, 
  onMarkCompleted, 
  testCount 
}: ExportCompletionDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export Complete</AlertDialogTitle>
          <AlertDialogDescription>
            Your {testCount} test{testCount !== 1 ? 's' : ''} have been exported successfully. 
            Would you like to mark {testCount === 1 ? 'this test' : 'these tests'} as completed and move {testCount === 1 ? 'it' : 'them'} to the Completed section?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            Keep in Ready to Deploy
          </AlertDialogCancel>
          <AlertDialogAction onClick={onMarkCompleted} className="bg-primary hover:bg-primary-dark">
            Mark as Completed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}