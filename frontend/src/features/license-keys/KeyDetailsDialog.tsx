import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import type { LicenseKey } from '@/entities/key';
import { getLicenseKeyDetails, getLicenseKeyAnalytics, revealLicenseKey } from '@/entities/key';
import { toast } from 'sonner';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { isMaskedKey } from '@/shared/lib/key-masking';
import { cn } from '@/lib/utils';

interface KeyDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyData: LicenseKey | null;
  keyId?: number;
}

const KeyDetailsDialog: React.FC<KeyDetailsDialogProps> = ({ open, onOpenChange, keyData, keyId }) => {
  const { hasPermission } = usePermissions();
  const canViewKeys = hasPermission('keys.see_analytics');

  const [keyDetails, setKeyDetails] = useState<any>(null);
  const [keyAnalytics, setKeyAnalytics] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'analytics'>('details');

  useEffect(() => {
    if (open && keyId) {
      loadKeyDetails();
    } else if (open && keyData && !keyId) {
      setKeyDetails({ key: keyData });
    }
  }, [open, keyId, keyData]);

  const loadKeyDetails = async () => {
    if (!keyId) return;
    try {
      setLoadingDetails(true);
      const details = await getLicenseKeyDetails(keyId);
      setKeyDetails(details);
    } catch (error) {
      toast.error('Error loading key details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadKeyAnalytics = async () => {
    if (!keyId) return;
    try {
      setLoadingAnalytics(true);
      const analytics = await getLicenseKeyAnalytics(keyId);
      setKeyAnalytics(analytics);
    } catch (error) {
      toast.error('Error loading analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCopyText = async (text: string, entity: string = "Key") => {
    const currentKeyData = keyDetails?.key || keyData;
    let fullKey: string;

    // Если ключ уже есть и не замаскирован, используем его
    if (currentKeyData?.key && !isMaskedKey(currentKeyData.key) && !currentKeyData.key_masked) {
      fullKey = currentKeyData.key;
    } else if (keyId) {
      // Получаем полный ключ через API
      try {
        const revealResponse = await revealLicenseKey(keyId);
        fullKey = revealResponse.key;
        
        if (isMaskedKey(fullKey) || revealResponse.key_masked) {
          toast.error('Permission denied to copy full key.');
          return;
        }
        
        // Обновляем данные, чтобы ключ был виден после копирования
        await loadKeyDetails();
      } catch (error: unknown) {
        toast.error('Failed to get full key.');
        return;
      }
    } else {
      fullKey = text;
      if (isMaskedKey(fullKey)) {
        toast.error('Cannot copy masked key.');
        return;
      }
    }

    // Копируем ключ
    try {
      await navigator.clipboard.writeText(fullKey);
      toast.success('Copied!');
    } catch (error) {
      toast.error('Copy failed');
    }
  };

  const getStatus = (key: any) => {
    if (!key) return 'Inactive';
    // If key is not activated, show "Not activated"
    if (!key.activated_at) return 'Not activated';
    // Only check expiration if key was activated
    if (key.is_expired) return 'Expired';
    return key.is_active ? 'Active' : 'Inactive';
  };

  const getStatusBadge = (status: string) => {
    let statusType: StatusType = 'inactive';
    if (status === 'Active') statusType = 'active';
    if (status === 'Expired') statusType = 'expired';
    if (status === 'Not activated') statusType = 'not_activated';

    return (
      <span className={cn(getStatusClasses(statusType), "rounded-none")}>
        {getStatusText(statusType)}
      </span>
    );
  };

  const handleReveal = async () => {
    if (!keyId) return;
    try {
      const revealResponse = await revealLicenseKey(keyId);
      if (revealResponse.key && !revealResponse.key_masked) {
        await loadKeyDetails();
        toast.success('Key revealed');
      } else {
        toast.error('Permission denied.');
      }
    } catch (error) {
      toast.error('Failed to reveal key.');
    }
  };

  if ((!keyData && !keyDetails) || !canViewKeys) return null;

  const displayKey = keyDetails?.key || keyData;
  const isMasked = displayKey?.key_masked || isMaskedKey(displayKey?.key || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[600px] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-1 border-b bg-muted/5 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            License Key Details
          </DialogTitle>
          <DialogDescription className="text-xs">
            Viewing information for key <span className="font-mono text-foreground">#{keyId || displayKey?.id}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={(v) => {
            setActiveTab(v as 'details' | 'analytics');
            if (v === 'analytics' && !keyAnalytics && keyId) {
              loadKeyAnalytics();
            }
          }} 
          className="flex-1 flex flex-col min-h-0 w-full"
        >
          <TabsList className="w-full rounded-none bg-transparent h-9 p-0 flex-shrink-0">
            <TabsTrigger 
              value="details" 
              className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent"
            >
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="flex-1 h-9 rounded-none text-xs data-[state=active]:bg-transparent"
            >
              Analytics
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <TabsContent value="details" className="mt-0 space-y-4">
              {loadingDetails ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-5 w-5" />
                </div>
              ) : (
                <>
                  {/* Key String Block */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">License Key</Label>
                    <div className="flex gap-2">
                      <code className="flex-1 font-mono text-xs bg-muted/50 p-2 rounded border break-all">
                        {displayKey?.key}
                      </code>
                      <div className="flex flex-col gap-1 shrink-0">
                        {isMasked && keyId && (
                          <Button variant="outline" size="sm" onClick={handleReveal} className="h-7 text-[10px] px-2">
                            Reveal
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCopyText(displayKey?.key)} 
                          className="h-7 text-[10px] px-2"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/10 border rounded-md">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</span>
                      <div>{getStatusBadge(getStatus(displayKey))}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Product</span>
                      <p className="text-xs font-medium truncate" title={displayKey?.product_name}>
                        {displayKey?.product_name || 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Target</span>
                      <p className="text-xs font-medium">{displayKey?.agent_id ? 'Agent' : 'Product'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</span>
                      <p className="text-xs font-medium">{displayKey?.duration_hours} hrs</p>
                    </div>
                    
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Created</span>
                      <p className="text-xs truncate">
                        {displayKey?.created_at ? new Date(displayKey.created_at).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Activated</span>
                      <p className="text-xs truncate">
                        {displayKey?.activated_at ? new Date(displayKey.activated_at).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="space-y-0.5 col-span-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Expires</span>
                      <p className="text-xs truncate">
                        {displayKey?.activated_at 
                          ? (displayKey?.expires_at 
                              ? new Date(displayKey.expires_at).toLocaleString() 
                              : 'Permanent')
                          : 'Not activated'}
                      </p>
                    </div>
                  </div>

                  {/* Devices List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Devices ({displayKey?.device_count || 0}/{displayKey?.max_devices || 0})
                      </Label>
                    </div>
                    
                    {keyDetails?.devices && keyDetails.devices.length > 0 ? (
                      <div className="border rounded-md divide-y">
                        {keyDetails.devices.map((device: any, i: number) => (
                          <div key={i} className="p-2.5 text-xs hover:bg-muted/20 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-mono font-medium bg-muted/50 px-1 rounded text-[10px]">
                                {device.ip_address || 'Unknown IP'}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {device.last_seen ? new Date(device.last_seen).toLocaleDateString() : '-'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-muted-foreground">
                              <div className="truncate">
                                <span className="text-[10px] opacity-70">HWID:</span> {device.device_id || 'N/A'}
                              </div>
                              <div className="truncate text-right">
                                {device.device_model || device.device_brand || 'Generic Device'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center border border-dashed rounded-md bg-muted/10">
                        <p className="text-xs text-muted-foreground">No devices connected.</p>
                      </div>
                    )}
                  </div>

                  {/* Metadata/Fingerprint */}
                  {(displayKey?.fingerprint || displayKey?.key_metadata) && (
                    <div className="space-y-2 pt-2 border-t">
                      {displayKey?.fingerprint && (
                        <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
                          <span className="text-muted-foreground">Fingerprint:</span>
                          <code className="font-mono bg-muted/30 px-1 rounded truncate">
                            {displayKey.fingerprint}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="mt-0 space-y-4">
              {loadingAnalytics ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-5 w-5" />
                </div>
              ) : keyAnalytics ? (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-muted/10 border p-3 rounded-md text-center">
                      <div className="text-lg font-bold text-primary">
                        {keyAnalytics.summary.total_connections_all_time}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">Connections</div>
                    </div>
                    <div className="bg-muted/10 border p-3 rounded-md text-center">
                      <div className="text-lg font-bold text-primary">
                        {keyAnalytics.summary.max_unique_devices_all_time}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">Devices</div>
                    </div>
                    <div className="bg-muted/10 border p-3 rounded-md text-center">
                      <div className="text-lg font-bold text-primary">
                        {keyAnalytics.summary.products_played.length}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">Products</div>
                    </div>
                    <div className="bg-muted/10 border p-3 rounded-md text-center">
                      <div className="text-lg font-bold text-primary">
                        {keyAnalytics.summary.analytics_days_count}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">Active Days</div>
                    </div>
                  </div>

                  {/* Products List */}
                  {keyAnalytics.summary.products_played.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Accessed Products</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {keyAnalytics.summary.products_played.map((product: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                            {product}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Daily Log */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Daily Activity Log</Label>
                    <div className="border rounded-md text-xs divide-y max-h-[200px] overflow-y-auto">
                      {keyAnalytics.daily_analytics.length > 0 ? (
                        keyAnalytics.daily_analytics.map((day: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 hover:bg-muted/20">
                            <div className="space-y-0.5">
                              <div className="font-medium">{new Date(day.date).toLocaleDateString()}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                {day.products_played.join(', ')}
                              </div>
                            </div>
                            <div className="text-right text-[10px]">
                              <div>
                                <span className="font-medium">{day.total_connections}</span> conn
                              </div>
                              <div className="text-muted-foreground">{day.unique_devices} dev</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-muted-foreground text-[10px]">
                          No daily data available.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-md">
                  <span className="text-xs">No analytics data available</span>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-2 border-t bg-background flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KeyDetailsDialog;