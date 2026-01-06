"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from '@/lib/utils.ts'
import type { User } from "@/entities/user"

interface NotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: () => void
  loading: boolean
  form: {
    title: string
    message: string
    type: "info" | "warning" | "success" | "error"
    targetUsers: number[]
    sendToAll: boolean
    repeatCount: number
  }
  onFormChange: (form: any) => void
  users: User[]
  currentUserId?: number
}

const NotificationDialog: React.FC<NotificationDialogProps> = ({
  open,
  onOpenChange,
  onSend,
  loading,
  form,
  onFormChange,
  users,
  currentUserId
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Send Notification
            </DialogTitle>
            <DialogDescription className="text-xs">
              Send a notification to your employees
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notification-title" className="text-xs font-medium">Title *</Label>
              <Input
                id="notification-title"
                value={form.title}
                onChange={(e) => onFormChange({...form, title: e.target.value})}
                placeholder="Enter notification title"
                disabled={loading}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notification-type" className="text-xs font-medium">Type</Label>
              <Select
                value={form.type}
                onValueChange={(
                  value: "info" | "warning" | "success" | "error"
                ) => onFormChange({ ...form, type: value })}
                disabled={loading}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notification-message" className="text-xs font-medium">Message *</Label>
              <Textarea
                id="notification-message"
                value={form.message}
                onChange={(e) => onFormChange({...form, message: e.target.value})}
                placeholder="Enter notification message"
                disabled={loading}
                className="text-xs min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="repeat-count" className="text-xs font-medium">Repeat Count (1-10) *</Label>
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
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Times to show the notification to recipients
              </p>
            </div>

            <div className="space-y-3">
              <div
                className="flex items-center space-x-2 p-2 border rounded-md bg-muted/30 cursor-pointer"
                onClick={() =>
                  !loading &&
                  onFormChange({ ...form, sendToAll: !form.sendToAll })
                }
              >
                <Checkbox
                  id="send-to-all"
                  checked={form.sendToAll}
                  onCheckedChange={(checked) =>
                    onFormChange({ ...form, sendToAll: checked as boolean })
                  }
                  disabled={loading}
                />
                <Label htmlFor="send-to-all" className="text-xs cursor-pointer">
                  Send to all
                </Label>
              </div>

              {!form.sendToAll && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Select Employees</Label>
                  <div className="max-h-[200px] overflow-y-auto border rounded-md bg-muted/10">
                    {users.filter((user) => {
                      // Exclude admin, owner, and current user
                      const isAdminOrOwner =
                        user.roles?.includes("admin") ||
                        user.roles?.includes("owner")
                      // Normalize IDs for comparison (handle both string and number)
                      const userId =
                        typeof user.id === "string"
                          ? parseInt(user.id, 10)
                          : user.id
                      const normalizedCurrentUserId = currentUserId
                        ? typeof currentUserId === "string"
                          ? parseInt(currentUserId, 10)
                          : currentUserId
                        : null
                      const isCurrentUser =
                        normalizedCurrentUserId && userId === normalizedCurrentUserId
                      return !isAdminOrOwner && !isCurrentUser
                    }).length === 0 ? (
                      <div className="text-xs text-muted-foreground p-4 text-center">
                        No available employees found.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {users
                          .filter((user) => {
                            // Exclude admin, owner, and current user
                            const isAdminOrOwner =
                              user.roles?.includes("admin") ||
                              user.roles?.includes("owner")
                            // Normalize IDs for comparison (handle both string and number)
                            const userId =
                              typeof user.id === "string"
                                ? parseInt(user.id, 10)
                                : user.id
                            const normalizedCurrentUserId = currentUserId
                              ? typeof currentUserId === "string"
                                ? parseInt(currentUserId, 10)
                                : currentUserId
                              : null
                            const isCurrentUser =
                              normalizedCurrentUserId &&
                              userId === normalizedCurrentUserId
                            return !isAdminOrOwner && !isCurrentUser
                          })
                          .map((user) => {
                            const isChecked = form.targetUsers.includes(user.id)
                            return (
                              <div
                                key={user.id}
                                className={cn(
                                  "flex items-center space-x-2 p-2 hover:bg-accent/50 transition-colors cursor-pointer",
                                  isChecked && "bg-accent/20"
                                )}
                                onClick={() => {
                                  if (!loading) {
                                    if (isChecked) {
                                      onFormChange({
                                        ...form,
                                        targetUsers: form.targetUsers.filter(
                                          (id) => id !== user.id
                                        ),
                                      })
                                    } else {
                                      onFormChange({
                                        ...form,
                                        targetUsers: [...form.targetUsers, user.id],
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
                                <Label
                                  htmlFor={`user-${user.id}`}
                                  className="text-xs cursor-pointer flex-1"
                                >
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.username}
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSend}
            disabled={loading}
            className="h-8 text-xs min-w-[80px]"
          >
            {loading ? (
              <Spinner className="size-3" />
            ) : (
              "Send Notification"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default NotificationDialog