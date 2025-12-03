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
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left px-4 pt-4 pb-3">
          <DialogTitle className="text-sm font-medium">Upload Files</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs truncate pr-4">
            Upload files for the agent "{agent.name}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Agent Logo</Label>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Agent Banner</Label>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Agent Background</Label>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Agent File (required)</Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'file')}
                  multiple={false}
                  accept=".exe,.apk,.so,.dmg,.deb,.rpm"
                  maxSize={50 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={false}
                  showProgress={false}
                />
                {selectedFiles.file && (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <span>✓</span>
                    <span className="truncate">{selectedFiles.file.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/20 rounded p-2 border">
              <h4 className="text-xs font-medium mb-1.5">File Requirements:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>Logo: PNG, JPG, JPEG, GIF (up to 5MB)</div>
                <div>Banner: PNG, JPG, JPEG, GIF (up to 10MB)</div>
                <div>Background: PNG, JPG, JPEG, GIF (up to 15MB)</div>
                <div>File: EXE, APK, SO, DMG, DEB, RPM (up to 50MB)</div>
              </div>
            </div>

            {loading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1">
                  <div 
                    className="bg-primary h-1 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-1.5 px-4 py-3 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={loading}
              className="w-full sm:w-auto h-8 text-xs"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedFiles.file}
              className="w-full sm:w-auto h-8 text-xs"
            >
              {loading ? (
                <><Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />Uploading...</>
              ) : (
                'Upload'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadAgentFilesDialog;