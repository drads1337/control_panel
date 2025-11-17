import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, Loader2, Clock, EyeOff } from 'lucide-react';
import { sendGameNotification } from '@/entities/notification';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import type { Game } from '@/entities/game';

interface CreateNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game;
  onNotificationCreated?: () => void;
}

const CreateNotificationDialog: React.FC<CreateNotificationDialogProps> = ({
  open,
  onOpenChange,
  game,
  onNotificationCreated,
}) => {
  const { hasPermission } = usePermissions();
  
  const canCreateNotifications = hasPermission('games.notifications_create');
  
  // Early return if user doesn't have permission to create notifications
  if (!canCreateNotifications) {
    return null;
  }
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'error' | 'success' | 'custom'>('info');
  const [customType, setCustomType] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendClick = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    if (type === 'custom' && !customType.trim()) {
      toast.error('Enter a name for the custom type');
      return;
    }
    
    if (!canCreateNotifications) {
      toast.error('You do not have permission to create notifications');
      return;
    }

    try {
      setSending(true);
      
      let scheduledAt = null;
      if (!useCurrentTime && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const result = await sendGameNotification(game.id, {
        title: title.trim(),
        message: message.trim(),
        type: type === 'custom' ? customType.trim() : type,
        repeatCount,
        is_scheduled: !useCurrentTime,
        scheduled_at: scheduledAt
      });

      toast.success(`Notification "${title}" sent successfully! Received by ${result.notifications_created} users.`);
      
      // Reset form
      setTitle('');
      setMessage('');
      setType('info');
      setCustomType('');
      setRepeatCount(1);
      setUseCurrentTime(true);
      setScheduledDate('');
      setScheduledTime('');
      
      // Close dialog
      onOpenChange(false);
      
      // Call the callback if provided
      if (onNotificationCreated) {
        onNotificationCreated();
      }
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error sending notification');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setMessage('');
    setType('info');
    setCustomType('');
    setRepeatCount(1);
    setUseCurrentTime(true);
    setScheduledDate('');
    setScheduledTime('');
    onOpenChange(false);
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    };
    
    const getTypeLabel = (type: string) => {
      switch (type) {
        case 'info': return 'Info';
        case 'warning': return 'Warning';
        case 'error': return 'Error';
        case 'success': return 'Success';
        default: return type; // For custom types
    }
  };
  
    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'}>
        {getTypeLabel(type)}
      </Badge>
    );
  };

  if (!canCreateNotifications) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] w-[90vw] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bell className="h-6 w-6" />
            Create New Notification
          </DialogTitle>
          <DialogDescription className="text-base">
            Create a new notification for the game "{game.name}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
          <Card className="border-2">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="notificationTitle" className="text-sm font-medium">Notification Title</Label>
                    <Input
                      id="notificationTitle"
                      placeholder="Enter notification title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={sending}
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notificationType" className="text-sm font-medium">Notification Type</Label>
                    <Select 
                      value={type} 
                      onValueChange={(value: 'info' | 'warning' | 'error' | 'success' | 'custom') => setType(value)}
                      disabled={sending}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="custom">Custom Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {type === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="customType" className="text-sm font-medium">Custom Type Name</Label>
                    <Input
                      id="customType"
                      placeholder="Enter type name (e.g., Update, News, Important)"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      disabled={sending}
                      className="h-9"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="notificationMessage" className="text-sm font-medium">Notification Text</Label>
                  <Textarea
                    id="notificationMessage"
                    placeholder="Enter notification text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sending}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="repeatCount" className="text-sm font-medium">Number of Displays</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="repeatCount"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      disabled={sending}
                      className="h-9 w-20"
                    />
                    <span className="text-sm text-muted-foreground">
                      times (from 1 to 10)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Send Time</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="useCurrentTime"
                        checked={useCurrentTime}
                        onCheckedChange={(checked) => {
                          setUseCurrentTime(checked);
                          if (checked) {
                            const now = new Date();
                            setScheduledDate(now.toISOString().split('T')[0]);
                            setScheduledTime(now.toTimeString().slice(0, 5));
                          }
                        }}
                        disabled={sending}
                      />
                      <Label htmlFor="useCurrentTime" className="text-sm">
                        Send Now
                      </Label>
                    </div>
                    
                    {!useCurrentTime && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="scheduledDate" className="text-sm text-muted-foreground">Date</Label>
                          <Input
                            id="scheduledDate"
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            disabled={sending}
                            className="h-9"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div>
                          <Label htmlFor="scheduledTime" className="text-sm text-muted-foreground">Time</Label>
                          <Input
                            id="scheduledTime"
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            disabled={sending}
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}
                    
                    {useCurrentTime && (
                      <div className="p-2 bg-muted/50 rounded-md">
                        <p className="text-sm text-muted-foreground">
                          The notification will be sent at: <span className="font-medium">{new Date().toLocaleString('en-US')}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview */}
                {(title.trim() || message.trim()) && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTypeBadge(type === 'custom' ? customType : type)}
                          <Badge variant="outline" className="text-xs">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Unread
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">
                          {title.trim() ? `${title.trim()}: ${message.trim()}` : message.trim()}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {useCurrentTime ? 'Now' : (scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('en-US') : 'Not specified')}
                          </div>
                          <span>Views: 0/{repeatCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={sending}
            className="h-9"
          >
            Cancel
          </Button>
          <ConditionalRender permission="games.notifications_create" fallback={null}>
            <Button 
              onClick={handleSendClick} 
              disabled={sending || !title.trim() || !message.trim() || (type === 'custom' && !customType.trim())}
              className="h-9"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateNotificationDialog;