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
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import {
  Key,
  Copy,
  Monitor,
  Eye,
  BarChart2,
  CheckCircle,
  XCircle,
  PauseCircle
} from 'lucide-react';
import type { LicenseKey } from '@/entities/key';
import { getLicenseKeyDetails, getLicenseKeyAnalytics, revealLicenseKey } from '@/entities/key';
import { formatDate as formatDateUtil } from '@/lib/utils/date-utils';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks';
import { isMaskedKey } from '@/lib/key-masking';

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

      toast.error('Error loading key analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCopyText = async (text: string, entity: string = "Key") => {

    let fullKey: string;

    if (keyDetails?.key?.key && !isMaskedKey(keyDetails.key.key) && !keyDetails.key.key_masked) {
      fullKey = keyDetails.key.key;
    } else if (keyId) {

      try {
        const revealResponse = await revealLicenseKey(keyId);
        fullKey = revealResponse.key;

        if (isMaskedKey(fullKey) || revealResponse.key_masked) {
          toast.error('You do not have permission to copy full keys. Contact your administrator.');
          return;
        }
      } catch (error: unknown) {
        const { getErrorStatus } = await import('@/lib/utils/error-utils')
        const status = getErrorStatus(error)
        if (status === 403) {
          toast.error('You do not have permission to copy full keys. Contact your administrator.');
        } else {
          toast.error('Failed to get full key. Please try again.');
        }
        return;
      }
    } else {

      fullKey = text;
      if (isMaskedKey(fullKey)) {
        toast.error('Cannot copy masked key. Please open key details first.');
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(fullKey);
      toast.success(`${entity} copied to clipboard!`);
    } catch (error) {

      const textArea = document.createElement('textarea');
      textArea.value = fullKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success(`${entity} copied to clipboard!`);
    }
  };

  const getStatus = (key: any) => {
    if (key.is_expired) return 'Expired';
    return key.is_active ? 'Active' : 'Inactive';
  };

  const getStatusBadge = (status: string) => {
    let statusType: StatusType;
    let icon: React.ReactNode;

    switch (status) {
      case 'Active':
        statusType = 'active';
        icon = <CheckCircle className="h-3 w-3" />;
        break;
      case 'Expired':
        statusType = 'expired';
        icon = <XCircle className="h-3 w-3" />;
        break;
      case 'Inactive':
        statusType = 'inactive';
        icon = <PauseCircle className="h-3 w-3" />;
        break;
      default:
        statusType = 'inactive';
        icon = <PauseCircle className="h-3 w-3" />;
    }

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${getStatusClasses(statusType)}`}>
        {icon}
        <span>{getStatusText(statusType)}</span>
      </div>
    );
  };

  // Using centralized date formatting utility
  const formatDate = (dateString: string) => {
    return formatDateUtil(dateString, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    if (hours < 168) return `${Math.floor(hours / 24)}d`;
    if (hours < 720) return `${Math.floor(hours / 168)}w`;
    if (hours < 8760) return `${Math.floor(hours / 720)}mo`;
    return `${Math.floor(hours / 8760)}y`;
  };

  if (!keyData && !keyDetails) return null;

  if (!canViewKeys) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] w-[90vw] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="text-base">
            License Key Details
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Detailed information about the key and its usage.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b flex-shrink-0">
          <Button
            variant={activeTab === 'details' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('details')}
            className="flex-1 h-9 text-sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Details
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setActiveTab('analytics');
              if (!keyAnalytics && keyId) {
                loadKeyAnalytics();
              }
            }}
            className="flex-1 h-9 text-sm"
          >
            <BarChart2 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2">
          {activeTab === 'details' ? (
            loadingDetails ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Spinner className="h-6 w-6 mb-2" />
                <span className="text-xs">Loading details...</span>
              </div>
            ) : (keyDetails || keyData) ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="key" className="text-sm">Key</Label>
                        <div className="flex items-center gap-2">
                          <p className="font-sans text-xs bg-secondary p-2 rounded flex-1 break-all">
                            {(keyDetails?.key || keyData)?.key}
                          </p>
                          {(keyDetails?.key?.key_masked || isMaskedKey((keyDetails?.key || keyData)?.key || '')) && keyId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const revealResponse = await revealLicenseKey(keyId);
                                  if (revealResponse.key && !revealResponse.key_masked) {
                                    await loadKeyDetails();
                                    toast.success('Key revealed');
                                  } else {
                                    toast.error('You do not have permission to view full keys. Contact your administrator.');
                                  }
                                } catch (error: unknown) {
                                  const { getErrorStatus } = await import('@/lib/utils/error-utils')
                                  const status = getErrorStatus(error)
                                  if (status === 403) {
                                    toast.error('You do not have permission to view full keys. Contact your administrator.');
                                  } else {
                                    toast.error('Failed to reveal key. Please try again.');
                                  }
                                }
                              }}
                              title="Reveal full key (requires keys.see_analytics or keys.copy permission)"
                              className="h-9 w-9 p-0 flex-shrink-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const keyToCopy = keyDetails?.key?.key || keyData?.key;
                              if (keyToCopy) {
                                handleCopyText(keyToCopy);
                              }
                            }}
                            className="h-9 w-9 p-0 flex-shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        {(keyDetails?.key?.key_masked || isMaskedKey((keyDetails?.key || keyData)?.key || '')) && (
                          <p className="text-xs text-muted-foreground">
                            Key is masked. Click the eye icon to reveal (requires keys.see_analytics or keys.copy permission).
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Status</Label>
                        <div>
                          {getStatusBadge(getStatus(keyDetails?.key || keyData))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Product</Label>
                        <p className="text-sm text-muted-foreground">{(keyDetails?.key || keyData)?.product_name || 'Not specified'}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Target Type</Label>
                        <div>
                          <Badge variant={(keyDetails?.key || keyData)?.agent_id ? "default" : "secondary"} className="text-xs">
                            {(keyDetails?.key || keyData)?.agent_id ? 'Agent' : 'Product'}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Project</Label>
                        <p className="text-sm text-muted-foreground">ID: {(keyDetails?.key || keyData)?.project_id}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Created</Label>
                        <p className="text-sm text-muted-foreground">
                          {(keyDetails?.key || keyData)?.created_at ? new Date((keyDetails?.key || keyData)?.created_at).toLocaleString('en-US') : 'Not specified'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Activated</Label>
                        <p className="text-sm text-muted-foreground">
                          {(keyDetails?.key || keyData)?.activated_at ? new Date((keyDetails?.key || keyData)?.activated_at).toLocaleString('en-US') : 'Not activated'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Expires</Label>
                        <p className="text-sm text-muted-foreground">
                          {(keyDetails?.key || keyData)?.expires_at && (keyDetails?.key || keyData)?.activated_at ? 
                            new Date((keyDetails?.key || keyData)?.expires_at).toLocaleString('en-US') : 
                            (keyDetails?.key || keyData)?.activated_at ? 'Permanent' : 'Not activated'
                          }
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Duration</Label>
                        <p className="text-sm text-muted-foreground">{(keyDetails?.key || keyData)?.duration_hours} hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Devices Section */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    Devices ({(keyDetails?.key || keyData)?.device_count || 0} / {(keyDetails?.key || keyData)?.max_devices || 0})
                  </Label>
                  {keyDetails?.devices && keyDetails.devices.length > 0 ? (
                    <div className="space-y-2">
                      {keyDetails.devices.map((device: any, index: number) => (
                        <div key={index} className="p-3 rounded-lg border bg-muted/30">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">HWID:</span>
                              <p className="font-sans text-xs bg-background p-1.5 rounded break-all">{device.device_id || device.serial || 'Not specified'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">IP Address:</span>
                              <p className="text-xs text-muted-foreground">{device.ip_address || 'Not specified'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">Device Model:</span>
                              <p className="text-xs text-muted-foreground">
                                {device.device_brand && device.device_model 
                                  ? `${device.device_brand} ${device.device_model}` 
                                  : device.device_model || device.device_brand || 'Not specified'
                                }
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">Connected:</span>
                              <p className="text-xs text-muted-foreground">
                                {device.connected_at ? new Date(device.connected_at).toLocaleString('en-US') : 'Not specified'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">Last Activity:</span>
                              <p className="text-xs text-muted-foreground">
                                {device.last_seen ? new Date(device.last_seen).toLocaleString('en-US') : 'Not specified'}
                              </p>
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">User Agent:</span>
                              <p className="text-xs bg-background p-1.5 rounded break-all">
                                {device.user_agent || 'Not specified'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-background/50">
                      <Monitor className="h-8 w-8 mb-2" />
                      <p className="text-sm">No devices connected</p>
                    </div>
                  )}
                </div>

                {(keyDetails?.key || keyData)?.fingerprint && (
                  <div className="space-y-2">
                    <Label className="text-sm">Fingerprint</Label>
                    <p className="font-sans text-xs bg-secondary p-2 rounded break-all">
                      {(keyDetails?.key || keyData)?.fingerprint}
                    </p>
                  </div>
                )}

                {(keyDetails?.key || keyData)?.key_metadata && (
                  <div className="space-y-2">
                    <Label className="text-sm">Metadata</Label>
                    <pre className="text-xs bg-secondary p-2 rounded overflow-x-auto">
                      {(() => {
                        const metadata = (keyDetails?.key || keyData)?.key_metadata;
                        try {
                          // If metadata is already an object, stringify it directly
                          // If it's a string, parse it first then stringify for formatting
                          const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
                          return JSON.stringify(parsed, null, 2);
                        } catch (error) {
                          // If parsing fails, just display the raw value
                          return typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
                        }
                      })()}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4" />
                <p>Information not loaded</p>
              </div>
            )
          ) : (

            loadingAnalytics ? (
              <div className="text-center py-12">
                <Spinner message="Loading analytics..." />
              </div>
            ) : keyAnalytics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {keyAnalytics.summary.total_connections_all_time}
                    </div>
                    <div className="text-sm text-muted-foreground">Total connections</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {keyAnalytics.summary.max_unique_devices_all_time}
                    </div>
                    <div className="text-sm text-muted-foreground">Unique devices</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {keyAnalytics.summary.products_played.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Products</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {keyAnalytics.summary.analytics_days_count}
                    </div>
                    <div className="text-sm text-muted-foreground">Days of activity</div>
                  </div>
                </div>

                {keyAnalytics.summary.products_played.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Products:</h4>
                    <div className="flex flex-wrap gap-2">
                      {keyAnalytics.summary.products_played.map((product: string, index: number) => (
                        <Badge key={index} variant="secondary">{product}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {keyAnalytics.daily_analytics.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Daily Statistics:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {keyAnalytics.daily_analytics.map((day: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <div className="font-medium">{new Date(day.date).toLocaleDateString('en-US')}</div>
                            <div className="text-sm text-muted-foreground">
                              {day.products_played.length > 0 && day.products_played.join(', ')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{day.total_connections} connections</div>
                            <div className="text-sm text-muted-foreground">{day.unique_devices} devices</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  {keyAnalytics.summary.first_analytics_date && keyAnalytics.summary.last_analytics_date ? (
                    <>Period: {new Date(keyAnalytics.summary.first_analytics_date).toLocaleDateString('en-US')} - {new Date(keyAnalytics.summary.last_analytics_date).toLocaleDateString('en-US')}</>
                  ) : (
                    'No data for the last 30 days'
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <BarChart2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No analytics data</p>
              </div>
            )
          )}
        </div>

        <DialogFooter className="pt-4 border-t flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={() => {
              onOpenChange(false);
              setKeyDetails(null);
              setKeyAnalytics(null);
              setActiveTab('details');
              setLoadingDetails(false);
              setLoadingAnalytics(false);
            }}
            className="h-9"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KeyDetailsDialog;
