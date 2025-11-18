import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  Search, 
  MoreHorizontal, 
  Globe, 
  MapPin, 
  Clock, 
  Unlock,
  Eye
} from 'lucide-react'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import AddIPBlock from './add-ip-block'

interface BlockedIP {
  id: number
  ip_address: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  country?: string
  city?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

interface BlockedIPsListProps {
  blockedIPs: BlockedIP[]
  loading: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  onUnblockIP: (ipId: number) => void
  onViewDetails: (ip: BlockedIP) => void
  onBlockIP: (data: {
    ip_address: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
}

export default function BlockedIPsList({
  blockedIPs,
  loading,
  searchTerm,
  setSearchTerm,
  onUnblockIP,
  onViewDetails,
  onBlockIP
}: BlockedIPsListProps) {
  const { canViewIPs, canBlockIPs, canUnblockIPs } = useSecurityPermissions();
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'spam': return 'bg-blue-100 text-blue-800'
      case 'abuse': return 'bg-red-100 text-red-800'
      case 'fraud': return 'bg-purple-100 text-purple-800'
      case 'malware': return 'bg-red-100 text-red-800'
      case 'suspicious': return 'bg-yellow-100 text-yellow-800'
      case 'violation': return 'bg-orange-100 text-orange-800'
      case 'rate_limit': return 'bg-gray-100 text-gray-800'
      case 'geo_block': return 'bg-indigo-100 text-indigo-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredIPs = (blockedIPs || []).filter(ip =>
    ip.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ip.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ip.country && ip.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (ip.city && ip.city.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (!canViewIPs) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              Blocked IP Addresses
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredIPs.length} of {blockedIPs?.length || 0} blocked IPs
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search IPs, reasons, locations..."
              className="w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {canBlockIPs && (
              <AddIPBlock onAdd={onBlockIP} loading={loading} />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading blocked IPs...</p>
            </div>
          </div>
        ) : filteredIPs.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Blocked IPs</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'No IPs match your search criteria' : 'No IP addresses are currently blocked'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Blocked At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIPs.map((ip) => (
                  <TableRow key={ip.id}>
                    <TableCell className="font-mono">{ip.ip_address}</TableCell>
                    <TableCell className="max-w-xs truncate" title={ip.reason}>
                      {ip.reason}
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(ip.category)}>
                        {ip.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(ip.severity)}>
                        {ip.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {ip.city && ip.country ? `${ip.city}, ${ip.country}` : 
                           ip.country || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(ip.blocked_at).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ip.is_active ? 'destructive' : 'secondary'}>
                        {ip.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewDetails(ip)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {ip.is_active && canUnblockIPs && (
                            <DropdownMenuItem 
                              onClick={() => onUnblockIP(ip.id)}
                              className="text-red-600"
                            >
                              <Unlock className="h-4 w-4 mr-2" />
                              Unblock
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
