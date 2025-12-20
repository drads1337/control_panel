import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project } from '@/entities/project';

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  gracePeriodDaysLeft: number
  onPaymentClick: () => void
}

export function PaymentModal({
  open,
  onOpenChange,
  projectName,
  gracePeriodDaysLeft,
  onPaymentClick
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handlePayment = async () => {
    setIsProcessing(true)
    try {
      await onPaymentClick()
    } finally {
      setIsProcessing(false)
    }
  }

  const getUrgencyLevel = () => {
    if (gracePeriodDaysLeft <= 3) return 'critical'
    if (gracePeriodDaysLeft <= 7) return 'high'
    return 'medium'
  }

  const urgencyLevel = getUrgencyLevel()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CreditCard className="h-4 w-4 text-destructive" />
            Payment Required
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Subscription expired. Renew to restore access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <div className="text-center py-2">
            <h3 className="font-semibold text-sm sm:text-base">{projectName}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Project Subscription</p>
          </div>

          <Alert className={cn(
            urgencyLevel === 'critical' && "bg-destructive/5 border-destructive/50",
            urgencyLevel === 'high' && "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/50",
            urgencyLevel === 'medium' && "bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200/50 dark:border-yellow-800/50"
          )}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription>
              <p className="font-medium mb-1 text-xs sm:text-sm">
                {urgencyLevel === 'critical' && "Critical: Immediate action required"}
                {urgencyLevel === 'high' && "Warning: Payment due soon"}
                {urgencyLevel === 'medium' && "Reminder: Payment required"}
              </p>
              <p className="text-xs sm:text-sm">
                You have <strong>{gracePeriodDaysLeft} {gracePeriodDaysLeft === 1 ? 'day' : 'days'}</strong> left 
                to renew before all project data is permanently deleted.
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs sm:text-sm">Grace Period</span>
              </div>
              <Badge variant={urgencyLevel === 'critical' ? 'destructive' : urgencyLevel === 'high' ? 'secondary' : 'outline'} className="text-[10px] sm:text-xs">
                {gracePeriodDaysLeft} days
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs sm:text-sm">After payment</span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Immediate access</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-xs sm:text-sm font-medium text-destructive mb-1">
              Data Deletion Warning
            </p>
            <p className="text-[10px] sm:text-xs text-destructive/80">
              If payment is not completed within the grace period, all project data will be permanently deleted.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={handlePayment}
              disabled={isProcessing}
              className="flex-1 text-xs sm:text-sm"
            >
              <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Pay Now'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="text-xs sm:text-sm"
            >
              Later
            </Button>
          </div>

          <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
            Need help? Contact support
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
