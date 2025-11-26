import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { sendProductNotification, sendAgentNotification } from '@/entities/notification';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import type { Product } from '@/entities/product';

interface CreateNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onNotificationCreated?: () => void;
  isAgent?: boolean;
}

const CreateNotificationDialog: React.FC<CreateNotificationDialogProps> = ({
  open,
  onOpenChange,
  product,
  onNotificationCreated,
  isAgent = false,
}) => {
  const { hasPermission } = usePermissions();

  const canCreateNotifications = isAgent
    ? hasPermission('agents.notifications_create') || hasPermission('products.notifications_create')
    : hasPermission('products.notifications_create');

  if (!canCreateNotifications) {
    return null;
  }

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'error' | 'success' | 'custom'>('info');
  const [customType, setCustomType] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduledHour, setScheduledHour] = useState<string>('');
  const [scheduledMinute, setScheduledMinute] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Генерируем опции для часов и минут
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Обновляем scheduledTime когда меняются час или минута
  useEffect(() => {
    if (scheduledHour && scheduledMinute) {
      setScheduledTime(`${scheduledHour}:${scheduledMinute}`);
    } else if (!scheduledHour && !scheduledMinute) {
      setScheduledTime('');
    }
  }, [scheduledHour, scheduledMinute]);

  // Парсим scheduledTime в час и минуту при изменении
  useEffect(() => {
    if (scheduledTime && scheduledTime.includes(':')) {
      const [hour, minute] = scheduledTime.split(':');
      setScheduledHour(hour);
      setScheduledMinute(minute);
    } else if (!scheduledTime) {
      setScheduledHour('');
      setScheduledMinute('');
    }
  }, [scheduledTime]);

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
        const dateStr = scheduledDate.toISOString().split('T')[0];
        scheduledAt = new Date(`${dateStr}T${scheduledTime}`).toISOString();
      }

      let result;
      if (isAgent) {
        result = await sendAgentNotification(product.id, {
          message: `${title.trim()}: ${message.trim()}`,
          type: type === 'custom' ? customType.trim() : type,
          is_scheduled: !useCurrentTime,
          scheduled_at: scheduledAt
        });
        toast.success(`Notification "${title}" sent successfully! Received by ${result.notifications_created} users.`);
      } else {
        result = await sendProductNotification(product.id, {
          title: title.trim(),
          message: message.trim(),
          type: type === 'custom' ? customType.trim() : type,
          repeatCount,
          is_scheduled: !useCurrentTime,
          scheduled_at: scheduledAt
        });
        toast.success(`Notification "${title}" sent successfully! Received by ${result.notifications_created} users.`);
      }

      setTitle('');
      setMessage('');
      setType('info');
      setCustomType('');
      setRepeatCount(1);
      setUseCurrentTime(true);
      setScheduledDate(undefined);
      setScheduledTime('');
      setScheduledHour('');
      setScheduledMinute('');

      onOpenChange(false);

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
    setScheduledDate(undefined);
    setScheduledTime('');
    setScheduledHour('');
    setScheduledMinute('');
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
        default: return type;
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
          <DialogTitle className="text-base">
            Create New Notification
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Create a new notification for the product "{product.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
          <div className="border rounded-lg p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notificationTitle" className="text-sm">Notification Title</Label>
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
                    <Label htmlFor="notificationType" className="text-sm">Notification Type</Label>
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
                    <Label htmlFor="customType" className="text-sm">Custom Type Name</Label>
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
                  <Label htmlFor="notificationMessage" className="text-sm">Notification Text</Label>
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
                    <span className="text-xs text-muted-foreground">
                      times (from 1 to 10)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Send Time</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="useCurrentTime"
                        checked={useCurrentTime}
                        onCheckedChange={(checked) => {
                          setUseCurrentTime(checked);
                          if (checked) {
                            const now = new Date();
                            setScheduledDate(now);
                            const timeStr = now.toTimeString().slice(0, 5);
                            setScheduledTime(timeStr);
                            const [hour, minute] = timeStr.split(':');
                            setScheduledHour(hour);
                            setScheduledMinute(minute);
                          } else {
                            setScheduledDate(undefined);
                            setScheduledTime('');
                            setScheduledHour('');
                            setScheduledMinute('');
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
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-9",
                                  !scheduledDate && "text-muted-foreground"
                                )}
                                disabled={sending}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={scheduledDate}
                                onSelect={setScheduledDate}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label htmlFor="scheduledTime" className="text-sm text-muted-foreground">Time</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-9",
                                  !scheduledTime && "text-muted-foreground"
                                )}
                                disabled={sending}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                {scheduledTime || "Pick a time"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4" align="start">
                              <div className="flex items-center gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Hour</Label>
                                  <Select
                                    value={scheduledHour}
                                    onValueChange={setScheduledHour}
                                    disabled={sending}
                                  >
                                    <SelectTrigger className="w-20 h-9">
                                      <SelectValue placeholder="HH" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                      {hours.map((hour) => (
                                        <SelectItem key={hour} value={hour}>
                                          {hour}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <span className="text-lg font-semibold mt-6">:</span>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Minute</Label>
                                  <Select
                                    value={scheduledMinute}
                                    onValueChange={setScheduledMinute}
                                    disabled={sending}
                                  >
                                    <SelectTrigger className="w-20 h-9">
                                      <SelectValue placeholder="MM" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                      {minutes.map((minute) => (
                                        <SelectItem key={minute} value={minute}>
                                          {minute}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}

                    {useCurrentTime && (
                      <div className="p-2 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">
                          The notification will be sent at: <span className="font-medium">{new Date().toLocaleString('en-US')}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {(title.trim() || message.trim()) && (
                  <div className="space-y-2">
                    <Label className="text-sm">Preview</Label>
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTypeBadge(type === 'custom' ? customType : type)}
                          <Badge variant="outline" className="text-xs">
                            Unread
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">
                          {title.trim() ? `${title.trim()}: ${message.trim()}` : message.trim()}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{useCurrentTime ? 'Now' : (scheduledDate && scheduledTime ? new Date(`${scheduledDate.toISOString().split('T')[0]}T${scheduledTime}`).toLocaleString('en-US') : 'Not specified')}</span>
                          <span className="flex items-center gap-1">
                            <span>Repeats:</span>
                            <span className="font-medium">
                              {repeatCount}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
          </div>
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
          <ConditionalRender 
            permission={isAgent ? "agents.notifications_create" : "products.notifications_create"} 
            fallback={null}
          >
            <Button 
              onClick={handleSendClick} 
              disabled={sending || !title.trim() || !message.trim() || (type === 'custom' && !customType.trim())}
              className="h-9"
            >
              {sending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Sending...
                </>
              ) : (
                'Send'
              )}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateNotificationDialog;