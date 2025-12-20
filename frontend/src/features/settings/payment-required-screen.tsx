import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Clock, AlertTriangle, Trash2, Calendar, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthContext } from '@/app/providers/auth-provider'
import type { Project } from '@/entities/project';
import type { Log } from '@/entities/log';

interface PaymentRequiredScreenProps {
  projectName: string
  gracePeriodDaysLeft: number
  onPaymentClick: () => void
}

export function PaymentRequiredScreen({
  projectName,
  gracePeriodDaysLeft,
  onPaymentClick
}: PaymentRequiredScreenProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { logout } = useAuthContext()

  const handlePayment = async () => {
    setIsProcessing(true)
    try {
      await onPaymentClick()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="text-center space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 bg-destructive/10 rounded-full flex items-center justify-center">
                <CreditCard className="h-6 w-6 sm:h-7 sm:w-7 text-destructive" />
              </div>

              <div>
                <h1 className="text-lg sm:text-xl font-semibold">Project Expired</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  "{projectName}" requires subscription renewal
                </p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-xs sm:text-sm">
                    You have <strong>{gracePeriodDaysLeft} {gracePeriodDaysLeft === 1 ? 'day' : 'days'}</strong> 
                    {' '}left to renew, otherwise all project data will be deleted.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">Grace Period</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px] sm:text-xs">
                    {gracePeriodDaysLeft} days
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">Status</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px] sm:text-xs">Expired</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="p-2.5 sm:p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <h4 className="font-semibold text-destructive mb-2 flex items-center gap-1.5 text-[10px] sm:text-xs">
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                    To be deleted
                  </h4>
                  <ul className="text-[10px] sm:text-xs text-destructive/80 space-y-0.5 sm:space-y-1">
                    <li>• License Keys</li>
                    <li>• Users</li>
                    <li>• Products</li>
                    <li>• Settings</li>
                  </ul>
                </div>

                <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50 border border-border/50">
                  <h4 className="font-semibold mb-2 text-[10px] sm:text-xs">After payment</h4>
                  <div className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>Instant Access</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>Data Restoration</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>One-month Extension</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>Technical Support</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full text-xs sm:text-sm"
                >
                  <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                  {isProcessing ? 'Processing...' : 'Pay Now'}
                </Button>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    disabled={isProcessing}
                    className="flex-1 text-xs sm:text-sm"
                    size="sm"
                  >
                    Refresh Status
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    disabled={isProcessing}
                    className="flex-1 text-xs sm:text-sm"
                    size="sm"
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    Log Out
                  </Button>
                </div>
              </div>

              <p className="text-[10px] sm:text-xs text-center text-muted-foreground pt-2">
                Need help? Contact support
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}