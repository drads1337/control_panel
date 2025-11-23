import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { User } from '@/entities/user';

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: () => void;
  loading: boolean;
  form: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    targetUsers: number[];
    sendToAll: boolean;
    repeatCount: number;
  };
  onFormChange: (form: any) => void;
  users: User[];
}

const NotificationDialog: React.FC<NotificationDialogProps> = ({
  open,
  onOpenChange,
  onSend,
  loading,
  form,
  onFormChange,
  users
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
          <DialogTitle className="text-base">Send Notification</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Send a notification to your employees
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notification-title" className="text-sm font-medium">Title *</Label>
            <Input
              id="notification-title"
              value={form.title}
              onChange={(e) => onFormChange({...form, title: e.target.value})}
              placeholder="Enter notification title"
              disabled={loading}
              className="text-base sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification-type" className="text-sm font-medium">Type</Label>
            <Select 
              value={form.type} 
              onValueChange={(value: 'info' | 'warning' | 'success' | 'error') => 
                onFormChange({...form, type: value})
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full text-base sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification-message" className="text-sm font-medium">Message *</Label>
            <textarea
              id="notification-message"
              className="w-full min-h-[100px] px-3 py-2 border border-input bg-background rounded-md text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              value={form.message}
              onChange={(e) => onFormChange({...form, message: e.target.value})}
              placeholder="Enter notification message"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repeat-count" className="text-sm font-medium">Repeat Count (1-10) *</Label>
            <Input
              id="repeat-count"
              type="number"
              min="1"
              max="10"
              value={form.repeatCount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                const clampedValue = Math.max(1, Math.min(10, value));
                onFormChange({...form, repeatCount: clampedValue});
              }}
              placeholder="How many times to show"
              disabled={loading}
              className="text-base sm:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Times to show the notification to recipients
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/20 cursor-pointer" onClick={() => !loading && onFormChange({...form, sendToAll: !form.sendToAll})}>
              <Checkbox
                id="send-to-all"
                checked={form.sendToAll}
                onCheckedChange={(checked) => 
                  onFormChange({...form, sendToAll: checked as boolean})
                }
                disabled={loading}
              />
              <Label htmlFor="send-to-all" className="text-sm cursor-pointer">Send to all (except admin/owner)</Label>
            </div>

            {!form.sendToAll && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Employees</Label>
                <div className="max-h-[200px] overflow-y-auto border rounded-md bg-card">
                  {users.filter(user => !user.roles?.includes('admin') && !user.roles?.includes('owner')).length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">
                      No available employees found.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {users
                        .filter(user => !user.roles?.includes('admin') && !user.roles?.includes('owner'))
                        .map((user) => {
                          const isChecked = form.targetUsers.includes(user.id);
                          return (
                            <div 
                              key={user.id} 
                              className={cn(
                                "flex items-center space-x-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer",
                                isChecked && "bg-accent/20"
                              )}
                              onClick={() => {
                                if (!loading) {
                                  if (isChecked) {
                                    onFormChange({
                                      ...form,
                                      targetUsers: form.targetUsers.filter(id => id !== user.id)
                                    })
                                  } else {
                                    onFormChange({
                                      ...form,
                                      targetUsers: [...form.targetUsers, user.id]
                                    })
                                  }
                                }
                              }}
                            >
                              <Checkbox
                                id={`user-${user.id}`}
                                checked={isChecked}
                                onCheckedChange={() => {}} // Handled by parent div
                                disabled={loading}
                              />
                              <Label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer flex-1">
                                {user.first_name && user.last_name 
                                  ? `${user.first_name} ${user.last_name}`
                                  : user.username
                                }
                              </Label>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 border-t bg-background flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={onSend} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : 'Send Notification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationDialog;