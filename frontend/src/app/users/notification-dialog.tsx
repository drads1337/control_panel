import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
          <DialogDescription>
            Send a notification to your employees
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notification-title">Title *</Label>
            <Input
              id="notification-title"
              value={form.title}
              onChange={(e) => onFormChange({...form, title: e.target.value})}
              placeholder="Enter notification title"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification-type">Type</Label>
            <Select 
              value={form.type} 
              onValueChange={(value: 'info' | 'warning' | 'success' | 'error') => 
                onFormChange({...form, type: value})
              }
              disabled={loading}
            >
              <SelectTrigger>
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
            <Label htmlFor="notification-message">Message *</Label>
            <textarea
              id="notification-message"
              className="w-full min-h-[100px] px-3 py-2 border border-input bg-background rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={form.message}
              onChange={(e) => onFormChange({...form, message: e.target.value})}
              placeholder="Enter notification message"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repeat-count">Repeat Count (1-10) *</Label>
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
              placeholder="How many times to show (1-10)"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              How many times the notification should be shown to recipients
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-to-all"
                checked={form.sendToAll}
                onCheckedChange={(checked) => 
                  onFormChange({...form, sendToAll: checked as boolean})
                }
                disabled={loading}
              />
              <Label htmlFor="send-to-all">Send to all employees (excluding admin/owner)</Label>
            </div>
          </div>

          {!form.sendToAll && (
            <div className="space-y-2">
              <Label>Select Employees (admin/owner excluded)</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-2">
                {users
                  .filter(user => !user.roles?.includes('admin') && !user.roles?.includes('owner'))
                  .map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={form.targetUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onFormChange({
                              ...form,
                              targetUsers: [...form.targetUsers, user.id]
                            })
                          } else {
                            onFormChange({
                              ...form,
                              targetUsers: form.targetUsers.filter(id => id !== user.id)
                            })
                          }
                        }}
                        disabled={loading}
                      />
                      <Label htmlFor={`user-${user.id}`} className="text-sm">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}`
                          : user.username
                        }
                      </Label>
                    </div>
                  ))}
                {users.filter(user => !user.roles?.includes('admin') && !user.roles?.includes('owner')).length === 0 && (
                  <p className="text-sm text-muted-foreground p-2">
                    No workers available. All users are admin/owner.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={loading}>
            {loading ? 'Sending...' : 'Send Notification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationDialog;

