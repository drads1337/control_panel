import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { uploadAgentFiles } from '@/entities/agent';
import FileUpload from '@/components/ui/file-upload';
import { toast } from 'sonner';
import type { Agent } from '@/entities/agent';

interface UploadAgentFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  agent: Agent | null;
}

const UploadAgentFilesDialog: React.FC<UploadAgentFilesDialogProps> = ({ open, onOpenChange, onSuccess, agent }) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<{
    logo?: File;
    banner?: File;
    background?: File;
    file?: File;
  }>({});

  const handleFilesSelect = (files: any[], fileType: string) => {
    if (files.length > 0) {
      setSelectedFiles(prev => ({
        ...prev,
        [fileType]: files[0].file
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;
    try {
      setLoading(true);
      setUploadProgress(0);
      const formData = new FormData();
      Object.entries(selectedFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });
      await uploadAgentFiles(agent.id, formData);
      toast.success('Files uploaded successfully!');
      onSuccess();
      onOpenChange(false);
      setSelectedFiles({});
      setUploadProgress(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error uploading files');
    } finally {
      setLoading(false);
    }
  };

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[900px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">Upload Files for Agent</DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            Upload files for the agent "{agent.name}".
          </DialogDescription>
        </DialogHeader>

        {/* Form acts as the flex container filling available space */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 mt-2">
          
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-sm font-medium">
                  Agent Logo
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'logo')}
                  multiple={false}
                  accept="image/*"
                  maxSize={5 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={true}
                  showProgress={false}
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-sm font-medium">
                  Agent Banner
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'banner')}
                  multiple={false}
                  accept="image/*"
                  maxSize={10 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={true}
                  showProgress={false}
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-sm font-medium">
                  Agent Background
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'background')}
                  multiple={false}
                  accept="image/*"
                  maxSize={15 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={true}
                  showProgress={false}
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-sm font-medium">
                  Agent File (required)
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'file')}
                  multiple={false}
                  accept=".exe,.apk,.so,.dmg,.deb,.rpm"
                  maxSize={50 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={false}
                  showProgress={false}
                  className="min-h-[100px] sm:min-h-[140px]"
                />
                {selectedFiles.file && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-green-600 dark:text-green-400">
                    <span>✓</span>
                    <span className="truncate max-w-[200px] sm:max-w-xs">
                      File selected: {selectedFiles.file.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-2">
              <h4 className="text-sm font-medium text-foreground">File Requirements:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Logo: PNG, JPG, JPEG, GIF (up to 5MB)</div>
                <div>Banner: PNG, JPG, JPEG, GIF (up to 10MB)</div>
                <div>Background: PNG, JPG, JPEG, GIF (up to 15MB)</div>
                <div>File: EXE, APK, SO, DMG, DEB, RPM (up to 50MB)</div>
              </div>
            </div>

            {loading && (
              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer pinned to bottom */}
          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 border-t pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedFiles.file}
              className="w-full sm:w-auto min-w-[140px]"
            >
              {loading ? (
                <><Spinner className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
              ) : (
                'Upload Files'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadAgentFilesDialog;