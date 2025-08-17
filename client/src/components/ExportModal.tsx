import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StatementWithRelations } from "@shared/schema";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statements: StatementWithRelations[];
  onExport: (statementIds: string[], exportType: 'all' | 'selected' | 'single') => void;
  isExporting: boolean;
}

export function ExportModal({ 
  open, 
  onOpenChange, 
  statements, 
  onExport, 
  isExporting 
}: ExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportType, setExportType] = useState<'all' | 'selected'>('all');

  // Filter statements that have colorblock images (exportable)
  const exportableStatements = useMemo(() => {
    return statements.filter(s => 
      (s.status === 'approved' || s.status === 'in_design' || s.status === 'completed') && 
      s.colorblockImageUrl
    );
  }, [statements]);

  const handleSelectAll = () => {
    if (selectedIds.size === exportableStatements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exportableStatements.map(s => s.id)));
    }
  };

  const handleSelectStatement = (statementId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(statementId)) {
      newSelected.delete(statementId);
    } else {
      newSelected.add(statementId);
    }
    setSelectedIds(newSelected);
    setExportType('selected');
  };

  const handleExport = () => {
    if (exportType === 'all') {
      onExport(exportableStatements.map(s => s.id), 'all');
    } else {
      onExport(Array.from(selectedIds), 'selected');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-success text-white text-xs">Approved</Badge>;
      case 'in_design': return <Badge className="bg-accent text-white text-xs">In Design</Badge>;
      case 'completed': return <Badge className="bg-gray-500 text-white text-xs">Completed</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700 text-xs">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <i className="fas fa-download mr-2"></i>
            Export Colorblocks
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-6">
          {/* Export Options */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Export Options</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'all'}
                  onChange={() => {
                    setExportType('all');
                    setSelectedIds(new Set());
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span className="text-sm font-medium">Export All Approved Colorblocks</span>
                <Badge variant="outline" className="text-xs">
                  {exportableStatements.length} items
                </Badge>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'selected'}
                  onChange={() => setExportType('selected')}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span className="text-sm font-medium">Export Selected Colorblocks</span>
                <Badge variant="outline" className="text-xs">
                  {selectedIds.size} selected
                </Badge>
              </label>
            </div>
          </div>

          {/* Statement Selection */}
          {exportableStatements.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Available Colorblocks</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedIds.size === exportableStatements.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <ScrollArea className="flex-1 max-h-96">
                <div className="space-y-3">
                  {exportableStatements.map((statement) => (
                    <div
                      key={statement.id}
                      className={`border rounded-lg p-4 transition-all ${
                        selectedIds.has(statement.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={selectedIds.has(statement.id)}
                          onCheckedChange={() => handleSelectStatement(statement.id)}
                          className="mt-1"
                        />
                        
                        {/* Colorblock Preview */}
                        <div className="w-16 h-16 bg-gray-100 rounded border overflow-hidden flex-shrink-0">
                          {statement.colorblockImageUrl ? (
                            <img
                              src={statement.colorblockImageUrl}
                              alt="Colorblock preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <i className="fas fa-image"></i>
                            </div>
                          )}
                        </div>

                        {/* Statement Details */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-medium text-sm leading-tight">
                                {statement.heading || 'No heading'}
                              </h4>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                {statement.content}
                              </p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              {getStatusBadge(statement.status)}
                              <span className="text-xs text-gray-500">
                                ID: {statement.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                          
                          {statement.description && (
                            <p className="text-xs text-gray-500 italic">
                              {statement.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quick Export Button */}
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onExport([statement.id], 'single')}
                          disabled={isExporting}
                          className="text-xs"
                        >
                          <i className="fas fa-download mr-1"></i>
                          Export This
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-exclamation-circle text-3xl mb-3"></i>
              <p>No approved colorblocks available for export</p>
              <p className="text-sm mt-1">Statements must be approved and have generated colorblock images to be exported.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {exportType === 'all' 
              ? `Exporting ${exportableStatements.length} colorblock${exportableStatements.length !== 1 ? 's' : ''}`
              : `Exporting ${selectedIds.size} selected colorblock${selectedIds.size !== 1 ? 's' : ''}`
            }
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleExport}
              disabled={
                isExporting || 
                exportableStatements.length === 0 || 
                (exportType === 'selected' && selectedIds.size === 0)
              }
              className="bg-success text-white hover:bg-green-600"
            >
              <i className="fas fa-download mr-2"></i>
              {isExporting ? 'Exporting...' : 'Export ZIP'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}