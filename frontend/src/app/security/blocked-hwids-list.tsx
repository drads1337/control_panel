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
  Monitor, 
  Clock, 
  Unlock,
  Eye
} from 'lucide-react'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import AddHWIDBlock from './add-hwid-block'

interface BlockedHWID {
  id: number
  hwid: string
  reason: string
  blocked_at: string
  expires_at?: string
  is_active: boolean
  block_type: string
  category: string
  severity: string
  threat_score: number
  cpu_info?: string
  gpu_info?: string
  motherboard_info?: string
  ram_info?: string
  attempt_count: number
  blocked_by?: string
  unblocked_at?: string
  unblocked_by?: string
}

interface BlockedHWIDsListProps {
  blockedHWIDs: BlockedHWID[]
  loading: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  onUnblockHWID: (hwidId: number) => void
  onViewDetails: (hwid: BlockedHWID) => void
  onBlockHWID: (data: {
    hwid: string
    reason: string
    expires_at?: string
    block_type: string
    category: string
    severity: string
    threat_score: number
  }) => void
}

export default function BlockedHWIDsList({
  blockedHWIDs,
  loading,
  searchTerm,
  setSearchTerm,
  onUnblockHWID,
  onViewDetails,
  onBlockHWID
}: BlockedHWIDsListProps) {
  const { canViewHWIDs, canBlockHWIDs, canUnblockHWIDs } = useSecurityPermissions();
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

  const filteredHWIDs = (blockedHWIDs || []).filter(hwid =>
    hwid.hwid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hwid.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hwid.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hwid.severity.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // If user doesn't have view permission, don't render anything
  if (!canViewHWIDs) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Blocked Hardware IDs
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredHWIDs.length} of {blockedHWIDs?.length || 0} blocked HWIDs
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search HWIDs, reasons, categories..."
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {canBlockHWIDs && (
              <AddHWIDBlock onAdd={onBlockHWID} loading={loading} />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading blocked HWIDs...</p>
            </div>
          </div>
        ) : filteredHWIDs.length === 0 ? (
          <div className="text-center py-8">
            <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Blocked HWIDs</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'No HWIDs match your search criteria' : 'No hardware IDs are currently blocked'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HWID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Blocked At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHWIDs.map((hwid) => (
                  <TableRow key={hwid.id}>
                    <TableCell className="font-mono text-xs">{hwid.hwid}</TableCell>
                    <TableCell className="max-w-xs truncate" title={hwid.reason}>
                      {hwid.reason}
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(hwid.category)}>
                        {hwid.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(hwid.severity)}>
                        {hwid.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(hwid.blocked_at).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={hwid.is_active ? 'destructive' : 'secondary'}>
                        {hwid.is_active ? 'Active' : 'Inactive'}
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
                          <DropdownMenuItem onClick={() => onViewDetails(hwid)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {hwid.is_active && canUnblockHWIDs && (
                            <DropdownMenuItem 
                              onClick={() => onUnblockHWID(hwid.id)}
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
