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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import {
  Key,
  Clock,
  Users,
  Gamepad2,
  Calendar,
  Shield,
  Copy,
  ExternalLink,
  Database,
  Activity,
  Monitor,
  Eye,
  BarChart2,
  CheckCircle,
  XCircle,
  PauseCircle
} from 'lucide-react';
import type { LicenseKey } from '@/entities/key';
import { getLicenseKeyDetails, getLicenseKeyAnalytics, revealLicenseKey } from '@/entities/key';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { isMaskedKey } from '@/lib/key-masking';

interface KeyDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyData: LicenseKey | null;
  keyId?: number;
}

const KeyDetailsDialog: React.FC<KeyDetailsDialogProps> = ({ open, onOpenChange, keyData, keyId }) => {
  const { hasPermission } = usePermissions();
  const canViewKeys = hasPermission('keys.view');
  
  const [keyDetails, setKeyDetails] = useState<any>(null);
  const [keyAnalytics, setKeyAnalytics] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'analytics'>('details');

  // Load key details when dialog opens
  useEffect(() => {
    if (open && keyId) {
      // Always load full details to get devices, even if keyData is provided
      loadKeyDetails();
    } else if (open && keyData && !keyId) {
      // Only use keyData if no keyId is provided (shouldn't happen normally)
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
      console.error('Error loading key details:', error);
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
      console.error('Error loading key analytics:', error);
      toast.error('Error loading key analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCopyText = async (text: string, entity: string = "Key") => {
    // SECURITY: Use /reveal endpoint to get full key for copying
    // This ensures we have permission and get the real key, not masked version
    let fullKey: string;
    
    // First try to use keyDetails if available and not masked
    if (keyDetails?.key?.key && !isMaskedKey(keyDetails.key.key) && !keyDetails.key.key_masked) {
      fullKey = keyDetails.key.key;
    } else if (keyId) {
      // Use /reveal endpoint to get full key
      try {
        const revealResponse = await revealLicenseKey(keyId);
        fullKey = revealResponse.key;
        
        // Double-check: if still masked, user doesn't have permission
        if (isMaskedKey(fullKey) || revealResponse.key_masked) {
          toast.error('You do not have permission to copy full keys. Contact your administrator.');
          return;
        }
      } catch (error: any) {
        console.error('Failed to reveal key for copying:', error);
        if (error.response?.status === 403) {
          toast.error('You do not have permission to copy full keys. Contact your administrator.');
        } else {
          toast.error('Failed to get full key. Please try again.');
        }
        return;
      }
    } else {
      // Fallback to provided text if no keyId
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
      // Fallback for older browsers
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            License Key Details
          </DialogTitle>
          <DialogDescription>
            Detailed information about the key and its usage.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === 'details' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('details')}
            className="flex-1"
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
            className="flex-1"
          >
            <BarChart2 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </div>

        <div className="space-y-6">
          {activeTab === 'details' ? (
            loadingDetails ? (
              <div className="text-center py-12">
                <Spinner message="Loading details..." />
              </div>
            ) : (keyDetails || keyData) ? (
              <div className="space-y-6">
                {/* Main Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Key</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-sm bg-secondary p-2 rounded flex-1">
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
                                // Reload details to show full key
                                await loadKeyDetails();
                                toast.success('Key revealed');
                              } else {
                                toast.error('You do not have permission to view full keys. Contact your administrator.');
                              }
                            } catch (error: any) {
                              if (error.response?.status === 403) {
                                toast.error('You do not have permission to view full keys. Contact your administrator.');
                              } else {
                                toast.error('Failed to reveal key. Please try again.');
                              }
                            }
                          }}
                          title="Reveal full key (requires keys.view permission)"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Always use full key from keyDetails if available, otherwise from keyData
                          const keyToCopy = keyDetails?.key?.key || keyData?.key;
                          if (keyToCopy) {
                            handleCopyText(keyToCopy);
                          }
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {(keyDetails?.key?.key_masked || isMaskedKey((keyDetails?.key || keyData)?.key || '')) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Key is masked. Click the eye icon to reveal (requires keys.view permission).
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(getStatus(keyDetails?.key || keyData))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Game</Label>
                    <p className="mt-1">{(keyDetails?.key || keyData)?.game_name || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Project</Label>
                    <p className="mt-1">ID: {(keyDetails?.key || keyData)?.project_id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Created</Label>
                    <p className="mt-1">
                      {(keyDetails?.key || keyData)?.created_at ? new Date((keyDetails?.key || keyData)?.created_at).toLocaleString('en-US') : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Activated</Label>
                    <p className="mt-1">
                      {(keyDetails?.key || keyData)?.activated_at ? new Date((keyDetails?.key || keyData)?.activated_at).toLocaleString('en-US') : 'Not activated'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Expires</Label>
                    <p className="mt-1">
                      {(keyDetails?.key || keyData)?.expires_at && (keyDetails?.key || keyData)?.activated_at ? 
                        new Date((keyDetails?.key || keyData)?.expires_at).toLocaleString('en-US') : 
                        (keyDetails?.key || keyData)?.activated_at ? 'Permanent' : 'Not activated'
                      }
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Duration</Label>
                    <p className="mt-1">{(keyDetails?.key || keyData)?.duration_hours} hours</p>
                  </div>
                </div>

                {/* Devices */}
                <div>
                  <Label className="text-sm font-medium">Devices ({(keyDetails?.key || keyData)?.device_count || 0} / {(keyDetails?.key || keyData)?.max_devices || 0})</Label>
                  {keyDetails?.devices && keyDetails.devices.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {keyDetails.devices.map((device: any, index: number) => (
                        <div key={index} className="bg-secondary p-3 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">HWID:</span>
                              <p className="font-mono text-xs bg-background p-1 rounded mt-1">{device.device_id || device.serial || 'Not specified'}</p>
                            </div>
                            <div>
                              <span className="font-medium">IP Address:</span>
                              <p className="text-xs mt-1">{device.ip_address || 'Not specified'}</p>
                            </div>
                            <div>
                              <span className="font-medium">Device Model:</span>
                              <p className="text-xs mt-1">
                                {device.device_brand && device.device_model 
                                  ? `${device.device_brand} ${device.device_model}` 
                                  : device.device_model || device.device_brand || 'Not specified'
                                }
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Connected:</span>
                              <p className="text-xs mt-1">
                                {device.connected_at ? new Date(device.connected_at).toLocaleString('en-US') : 'Not specified'}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Last Activity:</span>
                              <p className="text-xs mt-1">
                                {device.last_seen ? new Date(device.last_seen).toLocaleString('en-US') : 'Not specified'}
                              </p>
                            </div>
                            <div className="md:col-span-2">
                              <span className="font-medium">User Agent:</span>
                              <p className="text-xs bg-background p-1 rounded mt-1 break-all">
                                {device.user_agent || 'Not specified'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 p-4 bg-secondary rounded-lg text-center text-muted-foreground">
                      <Monitor className="h-8 w-8 mx-auto mb-2" />
                      <p>No devices connected</p>
                    </div>
                  )}
                </div>

                {/* Additional Information */}
                {(keyDetails?.key || keyData)?.fingerprint && (
                  <div>
                    <Label className="text-sm font-medium">Fingerprint</Label>
                    <p className="font-mono text-xs bg-secondary p-2 rounded mt-1 break-all">
                      {(keyDetails?.key || keyData)?.fingerprint}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                {(keyDetails?.key || keyData)?.key_metadata && (
                  <div>
                    <Label className="text-sm font-medium">Metadata</Label>
                    <pre className="text-xs bg-secondary p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(JSON.parse((keyDetails?.key || keyData)?.key_metadata), null, 2)}
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
            /* Analytics Tab */
            loadingAnalytics ? (
              <div className="text-center py-12">
                <Spinner message="Loading analytics..." />
              </div>
            ) : keyAnalytics ? (
              <div className="space-y-6">
                {/* General Statistics */}
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
                      {keyAnalytics.summary.games_played.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Games</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {keyAnalytics.summary.analytics_days_count}
                    </div>
                    <div className="text-sm text-muted-foreground">Days of activity</div>
                  </div>
                </div>

                {/* Games */}
                {keyAnalytics.summary.games_played.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Games:</h4>
                    <div className="flex flex-wrap gap-2">
                      {keyAnalytics.summary.games_played.map((game: string, index: number) => (
                        <Badge key={index} variant="secondary">{game}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily Analytics */}
                {keyAnalytics.daily_analytics.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Daily Statistics:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {keyAnalytics.daily_analytics.map((day: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <div className="font-medium">{new Date(day.date).toLocaleDateString('en-US')}</div>
                            <div className="text-sm text-muted-foreground">
                              {day.games_played.length > 0 && day.games_played.join(', ')}
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

                {/* Analytics Period */}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            onOpenChange(false);
            setKeyDetails(null);
            setKeyAnalytics(null);
            setActiveTab('details');
            setLoadingDetails(false);
            setLoadingAnalytics(false);
          }}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KeyDetailsDialog;
