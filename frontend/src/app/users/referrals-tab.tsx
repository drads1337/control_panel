import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import CreateReferralDialog from './create-referral-dialog';
import { useAuthContext } from '@/contexts/auth-context';
import { Plus, RefreshCw, Key, Edit, Trash2 } from 'lucide-react';
import { useReferralsTab } from '@/hooks/use-referrals-tab';

/**
 * Referrals Tab Component
 * Follows SRP: Component only handles UI rendering, data logic is in useReferralsTab hook
 */
const ReferralsTab: React.FC = () => {
  const { user } = useAuthContext();
  const isAdmin = user?.roles?.includes('owner') || user?.roles?.includes('admin') || user?.roles?.includes('moderator');

  // Use hook for all data management and business logic
  const {
    referralCodeForm,
    isCreateReferralDialogOpen,
    referralCodes,
    roles,
    availableGames,
    isLoading: referralCodesLoading,
    referralCodesError,
    rbacLoading,
    rbacError,
    gamesLoading,
    gamesError,
    isCreating,
    setReferralCodeForm,
    setIsCreateReferralDialogOpen,
    handleCreateReferralCode,
    generateReferralCode,
    refetchReferralCodes,
  } = useReferralsTab();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Referrals Management</CardTitle>
              <CardDescription>Manage user referrals, commission tracking, and referral codes</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                onClick={() => refetchReferralCodes()}
                disabled={referralCodesLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {referralCodesLoading ? 'Loading...' : 'Refresh'}
              </Button>

              {isAdmin && (
                <Button 
                  variant="default" 
                  onClick={() => setIsCreateReferralDialogOpen(true)}
                  disabled={referralCodesLoading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Referral Code
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Referral Codes Section */}
            <div className="space-y-4">
              {referralCodesLoading ? (
                <Spinner message="Loading referral codes..." />
              ) : referralCodesError ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-red-500">Error: {referralCodesError instanceof Error ? referralCodesError.message : 'An error occurred'}</div>
                </div>
              ) : referralCodes.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No Referral Codes</h4>
                  <p className="text-muted-foreground mb-4">
                    Create referral codes to track and manage referrals with commission tracking.
                  </p>
                  <Button onClick={() => setIsCreateReferralDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Referral Code
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {referralCodes.map((refCode) => (
                    <div 
                      key={refCode.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Key className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{refCode.code}</h4>
                          <p className="text-sm text-muted-foreground">
                            Role: {refCode.role || 'No role'} • 
                            Games: {refCode.game_ids?.length || 0} • 
                            Tokens: {refCode.token_balance || 0} • 
                            Work: {refCode.work_duration_days || 7} days
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded ${
                              refCode.used 
                                ? 'bg-green-100 text-green-800' 
                                : refCode.is_expired 
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {refCode.used ? 'Used' : refCode.is_expired ? 'Expired' : 'Active'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Created: {refCode.created_at ? new Date(refCode.created_at).toLocaleDateString('en-US') : 'Unknown'}
                            </span>
                            {refCode.expires_at && (
                              <span className="text-xs text-muted-foreground">
                                • Expires: {new Date(refCode.expires_at).toLocaleDateString('en-US')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" disabled={referralCodesLoading}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={referralCodesLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Referral Code Dialog */}
      <CreateReferralDialog
        open={isCreateReferralDialogOpen}
        onOpenChange={setIsCreateReferralDialogOpen}
        onCreate={handleCreateReferralCode}
        onGenerate={generateReferralCode}
        loading={isCreating}
        form={referralCodeForm}
        onFormChange={setReferralCodeForm}
        roles={roles}
        games={availableGames}
        rbacLoading={rbacLoading}
        rbacError={rbacError?.message || null}
        gamesLoading={gamesLoading}
        gamesError={gamesError?.message || null}
      />
    </div>
  );
};

export default ReferralsTab;

