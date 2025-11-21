import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import CreateReferralDialog from './create-referral-dialog';
import { useAuthContext } from '@/contexts/auth-context';
import { Plus, RefreshCw, Key, Edit, Trash2 } from 'lucide-react';
import { useReferralsTab } from '@/hooks/use-referrals-tab';

const ReferralsTab: React.FC = () => {
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
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Referral Codes</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {referralCodes.length || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetchReferralCodes()}
                disabled={referralCodesLoading}
              >
                <RefreshCw className="h-4 w-4" />
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
        <CardContent className="pt-0 -mt-3">
              {referralCodesLoading ? (
                <Spinner message="Loading referral codes..." />
              ) : referralCodesError ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-red-500">Error: {referralCodesError instanceof Error ? referralCodesError.message : 'An error occurred'}</div>
                </div>
              ) : referralCodes.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Key className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">No referral codes found</div>
              </div>
                </div>
              ) : (
            <div className="divide-y">
                  {referralCodes.map((refCode) => (
                    <div 
                      key={refCode.id} 
                  className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors"
                    >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Key className="h-4 w-4 text-primary" />
                        </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate">{refCode.code}</h4>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                              refCode.used 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                : refCode.is_expired 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {refCode.used ? 'Used' : refCode.is_expired ? 'Expired' : 'Active'}
                            </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground truncate">
                          {refCode.role || 'No role'}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          • {refCode.product_ids?.length || 0} products
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • {refCode.token_balance || 0} tokens
                        </span>
                            <span className="text-xs text-muted-foreground">
                          • {refCode.work_duration_days || 7} days
                            </span>
                            {refCode.expires_at && (
                              <span className="text-xs text-muted-foreground">
                            • Until {new Date(refCode.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                      disabled={referralCodesLoading}
                    >
                      <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={referralCodesLoading}
                        >
                      <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
