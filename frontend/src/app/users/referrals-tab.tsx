import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import CreateReferralDialog from './create-referral-dialog';
import { useAuthContext } from '@/contexts/auth-context';
import { Plus, RefreshCw, Key, Edit, Trash2, MoreVertical, Layers, Coins, Clock, Calendar } from 'lucide-react';
import { useReferralsTab } from '@/hooks/use-referrals-tab';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Hook to detect screen size
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

// Mobile Card Component
const MobileReferralCard = React.memo(({ 
  refCode, 
  loading 
}: { 
  refCode: any; 
  loading: boolean;
}) => {
  const getStatusColor = () => {
    if (refCode.used) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200';
    if (refCode.is_expired) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200';
  };

  return (
    <div className="flex flex-col p-4 border rounded-lg bg-card text-card-foreground shadow-sm mb-3">
      {/* Header */}
      <div className="flex justify-between items-start mb-3 pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-mono font-semibold text-sm tracking-wide">
              {refCode.code}
            </h4>
            <span className={cn("mt-1 text-[10px] px-1.5 py-0.5 rounded border inline-block font-medium", getStatusColor())}>
              {refCode.used ? 'Used' : refCode.is_expired ? 'Expired' : 'Active'}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem disabled={loading}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={loading} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <Layers className="h-3.5 w-3.5" />
          <span>Role: {refCode.role || 'None'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <Coins className="h-3.5 w-3.5" />
          <span>Tokens: {refCode.token_balance || 0}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <Clock className="h-3.5 w-3.5" />
          <span>Duration: {refCode.work_duration_days || 7}d</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
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
  loading 
}: { 
  refCode: any; 
  loading: boolean; 
}) => {
  return (
    <div className="flex items-center justify-between p-3 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Key className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate font-mono">{refCode.code}</h4>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border",
              refCode.used 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : refCode.is_expired 
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
            )}>
              {refCode.used ? 'Used' : refCode.is_expired ? 'Expired' : 'Active'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="truncate font-medium">{refCode.role || 'No role'}</span>
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
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={loading}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});
ReferralRow.displayName = 'ReferralRow';

const ReferralsTab: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { user } = useAuthContext();
  const isAdmin = user?.roles?.includes('owner') || user?.roles?.includes('admin') || user?.roles?.includes('moderator');

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
    setReferralCodeForm,
    setIsCreateReferralDialogOpen,
    handleCreateReferralCode,
    generateReferralCode,
    refetchReferralCodes,
  } = useReferralsTab();

  return (
    <div className="space-y-4">
      <Card className={cn(isMobile && "border-0 shadow-none bg-transparent")}>
        <CardHeader className={cn("pb-4", isMobile && "px-0 pt-0")}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Referral Codes</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {referralCodes.length || 0} total codes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetchReferralCodes()}
                disabled={referralCodesLoading}
              >
                <RefreshCw className={cn("h-4 w-4", referralCodesLoading && "animate-spin")} />
              </Button>
              {isAdmin && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => setIsCreateReferralDialogOpen(true)}
                  disabled={referralCodesLoading}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className={cn("pt-0", !isMobile && "-mt-3")}>
          {referralCodesLoading ? (
            <div className="flex justify-center py-8">
                <Spinner message="Loading referral codes..." />
            </div>
          ) : referralCodesError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500 text-sm text-center px-4">
                Error: {referralCodesError instanceof Error ? referralCodesError.message : 'An error occurred'}
              </div>
            </div>
          ) : referralCodes.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Key className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">No referral codes found</div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              {!isMobile && (
                <div className="divide-y border rounded-md">
                  {referralCodes.map((refCode) => (
                    <ReferralRow 
                      key={refCode.id} 
                      refCode={refCode} 
                      loading={referralCodesLoading} 
                    />
                  ))}
                </div>
              )}

              {/* Mobile View */}
              {isMobile && (
                <div className="flex flex-col gap-1">
                  {referralCodes.map((refCode) => (
                    <MobileReferralCard 
                      key={refCode.id} 
                      refCode={refCode} 
                      loading={referralCodesLoading} 
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