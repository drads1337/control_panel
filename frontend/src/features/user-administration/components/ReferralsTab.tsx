"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import CreateReferralDialog from "./CreateReferralDialog"
import { useAuthContext } from "@/app/providers/auth-provider"
import {
  Plus,
  RefreshCw,
  Key,
  Copy,
  Trash2,
  MoreVertical,
  Layers,
  Coins,
  Clock,
  Calendar,
  Check,
} from "lucide-react"
import { useReferralsTab } from "@/features/user-administration/hooks/use-referrals-tab"
import type { ReferralCodeRole } from "@/features/user-administration/hooks/use-referrals"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { copyToClipboard } from "@/utils"

// Hook to detect screen size
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) setMatches(media.matches)
    const listener = () => setMatches(media.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [matches, query])
  return matches
}

// Mobile Card Component
const MobileReferralCard = React.memo(({
  refCode,
  loading,
  onCopy,
  onDelete,
  isDeleting
}: {
  refCode: any;
  loading: boolean;
  onCopy: (code: string) => void;
  onDelete: (codeId: number) => void;
  isDeleting: boolean;
}) => {
  const getStatusColor = () => {
    if (refCode.used) return 'text-gray-700 dark:text-gray-300';
    if (refCode.is_expired) return 'text-destructive';
    return 'text-green-700 dark:text-green-300';
  };

  return (
    <div className="flex flex-col p-4 border border-muted-foreground/10 rounded-lg bg-background text-foreground shadow-sm mb-3">
      {/* Header */}
      <div className="flex justify-between items-start mb-3 pb-3 border-b border-muted-foreground/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-sans font-semibold text-sm tracking-wide">
              {refCode.code}
            </h4>
            <span className={cn("mt-1 text-[10px] px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/10 inline-block font-medium", getStatusColor())}>
              {refCode.used ? 'Used' : refCode.is_expired ? 'Expired' : 'Active'}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 hover:bg-muted/50">
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={loading || isDeleting}
              onClick={() => onCopy(refCode.code)}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy Code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={loading || isDeleting}
              onClick={() => onDelete(refCode.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 border border-muted-foreground/10 p-2 rounded">
          <Layers className="h-3.5 w-3.5" />
          <span>
            Role: {refCode.roles && refCode.roles.length > 0
              ? refCode.roles.map((r: ReferralCodeRole) => r.name).join(', ')
              : refCode.role || 'None'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 border border-muted-foreground/10 p-2 rounded">
          <Coins className="h-3.5 w-3.5" />
          <span>Tokens: {refCode.token_balance || 0}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 border border-muted-foreground/10 p-2 rounded">
          <Clock className="h-3.5 w-3.5" />
          <span>Duration: {refCode.work_duration_days || 7}d</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 border border-muted-foreground/10 p-2 rounded">
          <Calendar className="h-3.5 w-3.5" />
          <span className="truncate">
            {refCode.expires_at
              ? new Date(refCode.expires_at).toLocaleDateString()
              : 'No Expiry'}
          </span>
        </div>
      </div>
    </div>
  );
});
MobileReferralCard.displayName = 'MobileReferralCard';

// Desktop Row Component
const ReferralRow = React.memo(({
  refCode,
  loading,
  onCopy,
  onDelete,
  isDeleting,
  isCopied
}: {
  refCode: any;
  loading: boolean;
  onCopy: (code: string) => void;
  onDelete: (codeId: number) => void;
  isDeleting: boolean;
  isCopied: boolean;
}) => {
  return (
    <div className="flex items-center justify-between p-3 border-b border-muted-foreground/10 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Key className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate font-sans">{refCode.code}</h4>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/10",
              refCode.used
                ? 'text-gray-700 dark:text-gray-300'
                : refCode.is_expired
                  ? 'text-destructive'
                  : 'text-green-700 dark:text-green-300'
            )}>
              {refCode.used ? 'Used' : refCode.is_expired ? 'Expired' : 'Active'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="truncate font-medium">
              {refCode.roles && refCode.roles.length > 0
                ? refCode.roles.map((r: ReferralCodeRole) => r.name).join(', ')
                : refCode.role || 'No role'}
            </span>
            <span>•</span>
            <span>{refCode.product_ids?.length || 0} products</span>
            <span>•</span>
            <span>{refCode.token_balance || 0} tokens</span>
            <span>•</span>
            <span>{refCode.work_duration_days || 7} days</span>
            {refCode.expires_at && (
              <>
                <span>•</span>
                <span>Expires {new Date(refCode.expires_at).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-muted/50"
          disabled={loading || isDeleting}
          onClick={() => onCopy(refCode.code)}
          title="Copy code to clipboard"
        >
          {isCopied ? (
            <Check className="size-3.5 text-green-600" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={loading || isDeleting}
          onClick={() => onDelete(refCode.id)}
          title="Delete referral code"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
});
ReferralRow.displayName = 'ReferralRow';

const ReferralsTab: React.FC = () => {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { user } = useAuthContext()
  const isAdmin =
    user?.roles?.includes("owner") ||
    user?.roles?.includes("admin") ||
    user?.roles?.includes("moderator")

  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);

  const {
    referralCodeForm,
    isCreateReferralDialogOpen,
    referralCodes,
    roles,
    availableProducts,
    isLoading: referralCodesLoading,
    referralCodesError,
    rbacLoading,
    rbacError,
    productsLoading,
    productsError,
    isCreating,
    isDeleting,
    setReferralCodeForm,
    setIsCreateReferralDialogOpen,
    handleCreateReferralCode,
    generateReferralCode,
    deleteReferralCode,
    refetchReferralCodes,
  } = useReferralsTab();

  const handleCopyCode = async (code: string, codeId: number) => {
    try {
      await copyToClipboard(code)
      setCopiedCodeId(codeId)
      toast.success("Code copied to clipboard!")
      setTimeout(() => {
        setCopiedCodeId(null)
      }, 2000)
    } catch (error) {
      toast.error("Failed to copy code to clipboard")
    }
  }

  const handleDeleteCode = async (codeId: number) => {
    if (window.confirm("Are you sure you want to delete this referral code?")) {
      await deleteReferralCode(codeId)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Referral Codes</CardTitle>
              <CardDescription className="text-xs">
                {referralCodes.length || 0} codes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted/50"
                onClick={() => refetchReferralCodes()}
                disabled={referralCodesLoading}
              >
                <RefreshCw className={cn("size-3.5", referralCodesLoading && "animate-spin")} />
              </Button>
              {isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsCreateReferralDialogOpen(true)}
                  disabled={referralCodesLoading}
                >
                  <Plus className="size-3 mr-1.5" />
                  Add
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-1">
          {referralCodesLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : referralCodesError ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-destructive text-xs text-center px-4 bg-destructive/10 border border-destructive/20 rounded-md p-2">
                Error: {referralCodesError instanceof Error ? referralCodesError.message : 'An error occurred'}
              </div>
            </div>
          ) : referralCodes.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
                <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">
                  No referral codes found
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              {!isMobile && (
                <div className="divide-y border border-muted-foreground/10 rounded-md bg-muted/10">
                  {referralCodes.map((refCode) => (
                    <ReferralRow
                      key={refCode.id}
                      refCode={refCode}
                      loading={referralCodesLoading}
                      onCopy={(code) => handleCopyCode(code, refCode.id)}
                      onDelete={handleDeleteCode}
                      isDeleting={isDeleting}
                      isCopied={copiedCodeId === refCode.id}
                    />
                  ))}
                </div>
              )}

              {/* Mobile View */}
              {isMobile && (
                <div className="flex flex-col gap-1 border border-muted-foreground/10 rounded-md bg-muted/10 p-1">
                  {referralCodes.map((refCode) => (
                    <MobileReferralCard
                      key={refCode.id}
                      refCode={refCode}
                      loading={referralCodesLoading}
                      onCopy={(code) => handleCopyCode(code, refCode.id)}
                      onDelete={handleDeleteCode}
                      isDeleting={isDeleting}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateReferralDialog
        open={isCreateReferralDialogOpen}
        onOpenChange={setIsCreateReferralDialogOpen}
        onCreate={handleCreateReferralCode}
        onGenerate={generateReferralCode}
        loading={isCreating}
        form={referralCodeForm}
        onFormChange={setReferralCodeForm}
        roles={roles}
        products={availableProducts}
        rbacLoading={rbacLoading}
        rbacError={rbacError?.message || null}
        productsLoading={productsLoading}
        productsError={productsError?.message || null}
      />
    </div>
  );
};

export default ReferralsTab;