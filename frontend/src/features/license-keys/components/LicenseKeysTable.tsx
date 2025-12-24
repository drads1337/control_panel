import React, { useState, useMemo } from 'react';
import { Key, Search, Filter, ChevronLeft, ChevronRight, Copy, Eye, Trash2 } from 'lucide-react';
import { useKeysQuery } from '@/entities/key/model/queries';
import type { LicenseKey } from '@/entities/key';
import { revealLicenseKey, deleteLicenseKey } from '@/entities/key/api/operations';
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { keyKeys } from '@/entities/key/model/queries';
import { Button } from '@/shared/ui/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/components/dialog';

// Helper function to format time ago
const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
};

// Helper function to format expires
const formatExpires = (expiresAt: string | null, isExpired: boolean): string => {
  if (!expiresAt) return 'Never';
  if (isExpired) return 'Expired';
  
  const date = new Date(expiresAt);
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  
  if (diffInSeconds < 0) return 'Expired';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo`;
  return `${Math.floor(diffInSeconds / 31536000)}yr`;
};

// Helper function to get status
const getStatus = (key: LicenseKey): 'ACTIVE' | 'EXPIRED' | 'REVOKED' => {
  if (key.status === 0 || !key.is_active) return 'REVOKED';
  if (key.is_expired) return 'EXPIRED';
  return 'ACTIVE';
};

export const LicenseKeysTable: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedKey, setSelectedKey] = useState<LicenseKey | null>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const perPage = 10;
    const queryClient = useQueryClient();
    const { copyToClipboard, isCopied } = useCopyToClipboard({ onCopy: () => toast.success('Key copied to clipboard') });

    const { keys, loading, total, pages, setSearch, setPage, refetch } = useKeysQuery({
        page: currentPage,
        per_page: perPage,
        enabled: true,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: deleteLicenseKey,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: keyKeys.lists() });
            queryClient.invalidateQueries({ queryKey: keyKeys.stats() });
            toast.success('Key deleted successfully');
            refetch();
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Failed to delete key');
        },
    });

    // Filter keys by search term
    const filteredKeys = useMemo(() => {
        if (!searchTerm) return keys;
        const term = searchTerm.toLowerCase();
        return keys.filter(k => 
            k.key.toLowerCase().includes(term) ||
            (k.product_name || '').toLowerCase().includes(term)
        );
    }, [keys, searchTerm]);

    // Handle search
    const handleSearch = (value: string) => {
        setSearchTerm(value);
        if (value) {
            setSearch(value);
        } else {
            setSearch('');
        }
    };

    // Handle pagination
    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            setPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < pages) {
            setCurrentPage(currentPage + 1);
            setPage(currentPage + 1);
        }
    };

    // Handle copy key
    const handleCopyKey = async (key: LicenseKey) => {
        try {
            const response = await revealLicenseKey(key.id);
            if (response.key_masked) {
                toast.error('You do not have permission to copy full keys');
                return;
            }
            copyToClipboard(response.key);
        } catch (error: any) {
            toast.error(error?.message || 'Failed to copy key');
        }
    };

    // Handle show details
    const handleShowDetails = (key: LicenseKey) => {
        setSelectedKey(key);
        setShowDetailsDialog(true);
    };

    // Handle delete key
    const handleDeleteKey = async (keyId: number) => {
        if (confirm('Are you sure you want to delete this key?')) {
            await deleteMutation.mutateAsync(keyId);
        }
    };

    // Format duration hours
    const formatDuration = (hours: number): string => {
        if (hours < 24) return `${hours}h`;
        if (hours < 720) return `${Math.floor(hours / 24)}d`;
        if (hours < 8760) return `${Math.floor(hours / 720)}mo`;
        return `${Math.floor(hours / 8760)}yr`;
    };

    // Format date
    const formatDate = (dateString: string | null): string => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };
    return (
        <div className="bg-surface-dark border border-border-dark rounded-sm flex flex-col shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-dark flex justify-between items-center min-w-0">
                 <div className="min-w-0 flex-shrink">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Key className="text-primary h-4 w-4" />
                        Generated Keys
                    </h3>
                    <p className="text-xs text-text-secondary-dark mt-0.5">Recent license generation history.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                     <div className="relative group">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                            <Search className="text-text-secondary-dark text-xs group-focus-within:text-primary transition-colors h-3 w-3" />
                        </span>
                        <input 
                            className="bg-background-dark border border-border-dark rounded-sm pl-7 pr-3 py-1.5 text-[10px] text-text-primary-dark focus:border-primary outline-none font-mono w-48 focus:ring-1 focus:ring-primary transition-all placeholder-text-secondary-dark/50" 
                            placeholder="Find key..." 
                            type="text"
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                    <button className="px-2 py-1 bg-background-dark border border-border-dark rounded-sm text-text-secondary-dark hover:text-white hover:border-text-secondary-dark/50 transition-all">
                        <Filter className="text-sm h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-background-dark/50 border-b border-border-dark text-[10px] uppercase tracking-widest text-text-secondary-dark font-mono">
                            <th className="px-5 py-3 font-semibold">License Key</th>
                            <th className="px-5 py-3 font-semibold">Product</th>
                            <th className="px-5 py-3 font-semibold">Creator</th>
                            <th className="px-5 py-3 font-semibold">Status</th>
                            <th className="px-5 py-3 font-semibold">Duration</th>
                            <th className="px-5 py-3 font-semibold">Created</th>
                            <th className="px-5 py-3 font-semibold">Activated</th>
                            <th className="px-5 py-3 font-semibold text-right">Usage</th>
                            <th className="px-5 py-3 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px]">
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="px-5 py-8 text-center text-text-secondary-dark">
                                    Loading...
                                </td>
                            </tr>
                        ) : filteredKeys.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-5 py-8 text-center text-text-secondary-dark">
                                    No keys found
                                </td>
                            </tr>
                        ) : (
                            filteredKeys.slice(0, perPage).map((k) => {
                                const status = getStatus(k);
                                return (
                                    <tr key={k.id} className="border-b border-border-dark/50 hover:bg-white/5 transition-colors group">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <Key className="text-xs text-text-secondary-dark opacity-50 h-3 w-3" />
                                                <span className="font-mono text-text-primary-dark font-medium select-all text-[10px]">{k.key}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-text-secondary-dark text-[10px]">{k.product_name || 'N/A'}</td>
                                        <td className="px-5 py-3 text-text-secondary-dark text-[10px]">
                                            {k.creator_username || 'System'}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`px-1.5 py-0.5 rounded-[2px] border text-[9px] font-bold uppercase tracking-wider ${
                                                status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                status === 'REVOKED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                            }`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-text-secondary-dark text-[10px] font-mono">
                                            {formatDuration(k.duration_hours)}
                                        </td>
                                        <td className="px-5 py-3 text-text-secondary-dark text-[10px]">
                                            <div className="flex flex-col">
                                                <span className="text-text-primary-dark">{formatTimeAgo(k.created_at)}</span>
                                                <span className="text-[9px] opacity-60">Exp: {formatExpires(k.expires_at, k.is_expired)}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-text-secondary-dark text-[10px]">
                                            {k.activated_at ? formatTimeAgo(k.activated_at) : 'Never'}
                                        </td>
                                        <td className="px-5 py-3 text-right font-mono text-text-secondary-dark text-[10px]">{k.device_count}/{k.max_devices}</td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleCopyKey(k)}
                                                    className="p-1.5 text-text-secondary-dark hover:text-primary hover:bg-white/10 rounded transition-colors"
                                                    title="Copy key"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleShowDetails(k)}
                                                    className="p-1.5 text-text-secondary-dark hover:text-primary hover:bg-white/10 rounded transition-colors"
                                                    title="Show details"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteKey(k.id)}
                                                    className="p-1.5 text-text-secondary-dark hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Delete key"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
             {/* Footer Pagination */}
            <div className="px-5 py-3 border-t border-border-dark flex justify-between items-center bg-background-dark/30">
                <span className="text-[10px] font-mono text-text-secondary-dark uppercase tracking-widest opacity-50">
                    Showing {filteredKeys.length > 0 ? ((currentPage - 1) * perPage + 1) : 0} - {Math.min(currentPage * perPage, total)} of {total}
                </span>
                <div className="flex gap-1">
                    <button 
                        onClick={handlePrevPage}
                        disabled={currentPage === 1 || loading}
                        className="w-6 h-6 flex items-center justify-center rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30 transition-all"
                    >
                        <ChevronLeft className="text-xs h-3 w-3" />
                    </button>
                    <button 
                        onClick={handleNextPage}
                        disabled={currentPage >= pages || loading}
                        className="w-6 h-6 flex items-center justify-center rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30 transition-all"
                    >
                        <ChevronRight className="text-xs h-3 w-3" />
                    </button>
                </div>
            </div>

            {/* Details Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="bg-surface-dark border-border-dark text-text-primary-dark max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <Key className="h-4 w-4 text-primary" />
                            Key Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedKey && (
                        <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4 text-[11px]">
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">License Key</label>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="font-mono text-text-primary-dark select-all break-all">{selectedKey.key}</span>
                                        <button
                                            onClick={() => handleCopyKey(selectedKey)}
                                            className="p-1 text-text-secondary-dark hover:text-primary hover:bg-white/10 rounded transition-colors"
                                            title="Copy"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Product</label>
                                    <p className="mt-1 text-text-primary-dark">{selectedKey.product_name || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Status</label>
                                    <p className="mt-1">
                                        <span className={`px-1.5 py-0.5 rounded-[2px] border text-[9px] font-bold uppercase tracking-wider ${
                                            getStatus(selectedKey) === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            getStatus(selectedKey) === 'REVOKED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                        }`}>
                                            {getStatus(selectedKey)}
                                        </span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Creator</label>
                                    <p className="mt-1 text-text-primary-dark">{selectedKey.creator_username || 'System'}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Duration</label>
                                    <p className="mt-1 text-text-primary-dark font-mono">{formatDuration(selectedKey.duration_hours)}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Max Devices</label>
                                    <p className="mt-1 text-text-primary-dark font-mono">{selectedKey.max_devices}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Device Usage</label>
                                    <p className="mt-1 text-text-primary-dark font-mono">{selectedKey.device_count}/{selectedKey.max_devices}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Created At</label>
                                    <p className="mt-1 text-text-primary-dark text-[10px]">{formatDate(selectedKey.created_at)}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Activated At</label>
                                    <p className="mt-1 text-text-primary-dark text-[10px]">{selectedKey.activated_at ? formatDate(selectedKey.activated_at) : 'Never'}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Expires At</label>
                                    <p className="mt-1 text-text-primary-dark text-[10px]">{selectedKey.expires_at ? formatDate(selectedKey.expires_at) : 'Never'}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Fingerprint</label>
                                    <p className="mt-1 text-text-primary-dark font-mono text-[10px] break-all">{selectedKey.fingerprint || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Generation Type</label>
                                    <p className="mt-1 text-text-primary-dark text-[10px]">{selectedKey.generation_type || 'license_key'}</p>
                                </div>
                                {selectedKey.agent_id && (
                                    <div>
                                        <label className="text-text-secondary-dark text-[10px] uppercase tracking-wider font-semibold">Agent ID</label>
                                        <p className="mt-1 text-text-primary-dark font-mono">{selectedKey.agent_id}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t border-border-dark">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDetailsDialog(false)}
                                    className="text-xs"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

