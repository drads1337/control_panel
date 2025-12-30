"use client"

import * as React from "react"
import { useState, useEffect } from "react"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { toast } from "sonner"
import { enhancedApi } from "@/shared/api/enhanced-client"
import { getErrorMessage } from "@/shared/lib/utils/error-utils"
import { Loader2, Plus, Minus, History } from "lucide-react"

interface Transaction {
  id: number
  amount: number
  type: "credit" | "debit"
  description: string
  created_at: string
}

interface TopupBalanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userName: string
  currentBalance: number
  onSuccess: () => void
}

export const TopupBalanceDialog: React.FC<TopupBalanceDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
  currentBalance,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<
    "topup" | "deduct" | "transactions"
  >("topup")
  const [topupAmount, setTopupAmount] = useState<string>("")
  const [deductAmount, setDeductAmount] = useState<string>("")
  const [deductReason, setDeductReason] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [balance, setBalance] = useState(currentBalance)

  useEffect(() => {
    if (!open) {
      setTopupAmount("")
      setDeductAmount("")
      setDeductReason("")
      setActiveTab("topup")
      setTransactionsPage(1)
    } else {
      setBalance(currentBalance)
    }
  }, [open, currentBalance])

  useEffect(() => {
    if (open && activeTab === "transactions") {
      setTransactionsPage(1)
      loadTransactions(1, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, open])

  const loadTransactions = async (
    page: number = 1,
    append: boolean = false
  ) => {
    try {
      setTransactionsLoading(true)
      const response = await enhancedApi.get(
        "/api/users/balance/transactions",
        {
          params: {
            user_id: userId,
            page: page,
            per_page: 50,
          },
        }
      )

      if (append) {
        setTransactions((prev) => [
          ...prev,
          ...(response.data.transactions || []),
        ])
      } else {
        setTransactions(response.data.transactions || [])
      }
      setTransactionsTotal(response.data.total || 0)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      toast.error(errorMessage || "Failed to load transactions")
    } finally {
      setTransactionsLoading(false)
    }
  }

  const handleTopup = async () => {
    const amountNum = parseFloat(topupAmount)

    if (!topupAmount || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid positive amount")
      return
    }

    try {
      setLoading(true)
      const response = await enhancedApi.post("/api/users/balance/topup", {
        user_id: Number(userId),
        amount: amountNum,
      })

      toast.success(`Successfully topped up ${amountNum} tokens`)
      const newBalance = response.data.new_balance || balance + amountNum
      setBalance(newBalance)
      setTopupAmount("")
      onSuccess()
      if (activeTab === "transactions") loadTransactions(1, false)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      toast.error(errorMessage || "Failed to top up balance")
    } finally {
      setLoading(false)
    }
  }

  const handleDeduct = async () => {
    const amountNum = parseFloat(deductAmount)

    if (!deductAmount || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid positive amount")
      return
    }
    if (amountNum > balance) {
      toast.error("Insufficient balance")
      return
    }

    try {
      setLoading(true)
      const response = await enhancedApi.post("/api/users/balance/deduct", {
        user_id: Number(userId),
        amount: amountNum,
        reason: deductReason || "Balance deduction",
      })

      toast.success(`Successfully deducted ${amountNum} tokens`)
      const newBalance = response.data.new_balance || balance - amountNum
      setBalance(newBalance)
      setDeductAmount("")
      setDeductReason("")
      onSuccess()
      if (activeTab === "transactions") loadTransactions(1, false)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      toast.error(errorMessage || "Failed to deduct balance")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Balance: {balance.toLocaleString()}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage balance for {userName}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full"
        >
          <TabsList className="w-full rounded-none bg-transparent h-9 p-0 mx-4 mt-2">
            <TabsTrigger value="topup" className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent">
              <Plus className="size-3 mr-1" /> Add
            </TabsTrigger>
            <TabsTrigger value="deduct" className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent">
              <Minus className="size-3 mr-1" /> Deduct
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent">
              <History className="size-3 mr-1" /> History
            </TabsTrigger>
          </TabsList>

          <div className="p-4">
            <TabsContent value="topup" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label htmlFor="topup-amount" className="text-xs font-medium">Amount</Label>
                <Input
                  id="topup-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs"
                  disabled={loading}
                />
                {topupAmount && !isNaN(parseFloat(topupAmount)) && parseFloat(topupAmount) > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    New balance: <span className="font-medium text-green-600 dark:text-green-400">
                      {(balance + parseFloat(topupAmount)).toLocaleString()}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
                  onClick={handleTopup}
                  disabled={loading || !topupAmount || parseFloat(topupAmount) <= 0}
                  className="h-8 text-xs min-w-[80px]"
                >
                  {loading ? <Loader2 className="size-3 animate-spin" /> : "Confirm"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="deduct" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label htmlFor="deduct-amount" className="text-xs font-medium">Amount</Label>
                <Input
                  id="deduct-amount"
                  type="number"
                  min="0"
                  max={balance}
                  step="0.01"
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs"
                  disabled={loading}
                />
                {deductAmount && !isNaN(parseFloat(deductAmount)) && parseFloat(deductAmount) > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    New balance: <span className="font-medium text-red-600 dark:text-red-400">
                      {(balance - parseFloat(deductAmount)).toLocaleString()}
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deduct-reason" className="text-xs font-medium">Reason</Label>
                <Input
                  id="deduct-reason"
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  placeholder="Optional"
                  className="h-8 text-xs"
                  disabled={loading}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
                  variant="destructive"
                  onClick={handleDeduct}
                  disabled={loading || !deductAmount || parseFloat(deductAmount) <= 0 || parseFloat(deductAmount) > balance}
                  className="h-8 text-xs min-w-[80px]"
                >
                  {loading ? <Loader2 className="size-3 animate-spin" /> : "Deduct"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="mt-0">
              <div className="border rounded-md overflow-hidden max-h-[400px] bg-muted/10">
                <div className="overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr className="border-b">
                        <th className="text-left p-2 text-muted-foreground w-[100px] text-[10px] font-medium">Date</th>
                        <th className="text-left p-2 text-muted-foreground w-[60px] text-[10px] font-medium">Type</th>
                        <th className="text-right p-2 text-muted-foreground w-[80px] text-[10px] font-medium">Amount</th>
                        <th className="text-left p-2 text-muted-foreground text-[10px] font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactionsLoading && transactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="h-24 text-center text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                            <div className="text-xs">Loading...</div>
                          </td>
                        </tr>
                      ) : transactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="h-24 text-center text-muted-foreground text-xs">
                            No transactions
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t) => (
                          <tr key={t.id} className="hover:bg-muted/30">
                            <td className="p-2 text-muted-foreground text-xs">
                              {new Date(t.created_at).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                            </td>
                            <td className="p-2">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  t.type === "credit"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {t.type === "credit" ? "+" : "-"}
                              </span>
                            </td>
                            <td
                              className={`p-2 text-right font-sans text-xs ${
                                t.type === "credit"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {t.amount}
                            </td>
                            <td className="p-2 text-muted-foreground truncate max-w-[150px] text-xs" title={t.description}>
                              {t.description}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {transactionsTotal > transactions.length && (
                  <div className="p-1.5 border-t bg-muted/10 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const nextPage = transactionsPage + 1;
                        setTransactionsPage(nextPage);
                        loadTransactions(nextPage, true);
                      }}
                      disabled={transactionsLoading}
                    >
                      {transactionsLoading ? (
                        <>
                          <Loader2 className="size-3 animate-spin mr-1" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}