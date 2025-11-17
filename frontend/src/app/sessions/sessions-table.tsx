import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { 
  Activity, 
  Clock, 
  User, 
  Monitor, 
  MapPin, 
  Eye, 
  Play, 
  Square 
} from 'lucide-react'
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Session } from '@/entities/session'

interface SessionsTableProps {
  sessions: Session[]
  loading: boolean
  searchTerm: string
  selectedSessions: Set<number>
  pagination: any
  onToggleSessionSelection: (userId: number) => void
  onSelectAllSessions: (sessions: Session[]) => void
  onViewDetails: (userId: number, username: string) => void
  onTerminateSession: (userId: number) => void
  onChangePage: (page: number) => void
}

// Memoized Session Row Component
const SessionRow = React.memo<{
  session: Session;
  isSelected: boolean;
  onToggleSelection: (userId: number) => void;
  onViewDetails: (userId: number, username: string) => void;
  onTerminate: (userId: number) => void;
  formatDate: (dateString: string | null) => string;
}>(({ session, isSelected, onToggleSelection, onViewDetails, onTerminate, formatDate }) => {
  const getStatusBadge = () => {
    const statusType = session.is_active ? 'active' : 'inactive' as StatusType;
    return (
      <span className={getStatusClasses(statusType)}>
        {getStatusText(statusType)}
      </span>
    );
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(session.user_id)}
          className="rounded border-input"
        />
      </td>
      <td className="p-3">
        {getStatusBadge()}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{session.username}</span>
        </div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm">{session.last_ip || 'Unknown'}</span>
        </div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {session.last_city && session.last_country 
              ? `${session.last_city}, ${session.last_country}`
              : session.last_country || 'Unknown'
            }
          </span>
        </div>
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {formatDate(session.last_activity)}
        </div>
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {session.session_duration || 'Unknown'}
        </div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onViewDetails(session.user_id, session.username)}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onTerminate(session.user_id)}
            className="text-red-600 hover:text-red-800 hover:bg-red-50"
            title="Terminate Session"
          >
            Terminate
          </Button>
        </div>
      </td>
    </tr>
  );
});

SessionRow.displayName = 'SessionRow';

export default function SessionsTable({
  sessions,
  loading,
  searchTerm,
  selectedSessions,
  pagination,
  onToggleSessionSelection,
  onSelectAllSessions,
  onViewDetails,
  onTerminateSession,
  onChangePage
}: SessionsTableProps) {
  // Format date
  const formatDate = React.useCallback((dateString: string | null) => {
    if (!dateString) return 'Unknown'
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true, locale: ru })
    } catch {
      return 'Unknown'
    }
  }, [])

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Active Sessions</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              {sessions.length} of {pagination.total} sessions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner message="Loading sessions..." />
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Sessions Found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try changing your search query' : 'No active sessions yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selectedSessions.size === sessions.length && sessions.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectAllSessions(sessions)
                          } else {
                            onSelectAllSessions([])
                          }
                        }}
                        className="rounded border-input"
                      />
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">IP Address</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Last Activity</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <SessionRow
                      key={session.user_id}
                      session={session}
                      isSelected={selectedSessions.has(session.user_id)}
                      onToggleSelection={onToggleSessionSelection}
                      onViewDetails={onViewDetails}
                      onTerminate={onTerminateSession}
                      formatDate={formatDate}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.currentPage - 1) * pagination.perPage) + 1} - {Math.min(pagination.currentPage * pagination.perPage, pagination.total)} of {pagination.total} sessions
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onChangePage(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.currentPage} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onChangePage(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
