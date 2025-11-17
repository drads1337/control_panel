import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  User as UserIcon, 
  MapPin, 
  Monitor, 
  Clock, 
  Activity, 
  Globe,
  Calendar,
  Info,
  Eye,
  X
} from 'lucide-react'
import { getSessionDetails } from '@/entities/session'
import { formatDistanceToNow, format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { Spinner } from '@/components/ui/spinner'
import type { User } from '@/entities/user';
import type { SessionDetails, Session } from '@/entities/session';

interface SessionDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  userId: number
  username: string
  token: string
}

export function SessionDetailsDialog({ 
  isOpen, 
  onClose, 
  userId, 
  username, 
  token 
}: SessionDetailsDialogProps) {
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && userId && token) {
      fetchSessionDetails()
    }
  }, [isOpen, userId, token])

  const fetchSessionDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const details = await getSessionDetails(userId)
      setSessionDetails(details)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session details')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown'
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true, locale: enUS })
    } catch {
      return 'Unknown'
    }
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Unknown'
    try {
      const date = new Date(dateString)
      return format(date, 'MM/dd/yyyy HH:mm:ss', { locale: enUS })
    } catch {
      return 'Unknown'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return <UserIcon className="h-4 w-4 text-green-600" />
      case 'logout':
        return <X className="h-4 w-4 text-red-600" />
      case 'generate_key':
        return <Activity className="h-4 w-4 text-blue-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return 'bg-green-100 text-green-800'
      case 'logout':
        return 'bg-red-100 text-red-800'
      case 'generate_key':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Session details for user {username}
          </DialogTitle>
          <DialogDescription>
            Detailed information about user session and activity
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Spinner message="Loading details..." />
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <X className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchSessionDetails}
              className="mt-2"
            >
              Try again
            </Button>
          </div>
        ) : sessionDetails ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-14 bg-muted border border-border rounded-lg">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
              >
                <Eye className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="activities" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
              >
                <Activity className="h-4 w-4" />
                <span>Activity</span>
              </TabsTrigger>
              <TabsTrigger 
                value="details" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
              >
                <Info className="h-4 w-4" />
                <span>Details</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* User Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    User Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">User ID</label>
                      <p className="text-sm">{sessionDetails.user.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Username</label>
                      <p className="text-sm font-medium">{sessionDetails.user.username}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last IP</label>
                      <p className="text-sm font-mono">{sessionDetails.user.last_ip || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Location</label>
                      <p className="text-sm">
                        {sessionDetails.user.last_city && sessionDetails.user.last_country 
                          ? `${sessionDetails.user.last_city}, ${sessionDetails.user.last_country}`
                          : sessionDetails.user.last_country || 'Unknown'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Session Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Session Start</label>
                      <p className="text-sm">
                        {sessionDetails.session.start 
                          ? formatDateTime(sessionDetails.session.start)
                          : 'Unknown'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Session End</label>
                      <p className="text-sm">
                        {sessionDetails.session.end 
                          ? formatDateTime(sessionDetails.session.end)
                          : 'Unknown'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Duration</label>
                      <p className="text-sm font-medium">{sessionDetails.session.duration}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Activity Count</label>
                      <p className="text-sm">{sessionDetails.session.activity_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Activity History ({sessionDetails.activities.length})
                  </CardTitle>
                  <CardDescription>
                    All user actions within this session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sessionDetails.activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="flex-shrink-0 mt-1">
                          {getActionIcon(activity.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getActionColor(activity.action)}>
                              {activity.action}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {formatDate(activity.created_at)}
                            </span>
                          </div>
                          {activity.details && (
                            <p className="text-sm text-gray-700 mb-2">{activity.details}</p>
                          )}
                          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                            <div>
                              <span className="font-medium">IP:</span> {activity.ip_address || 'Unknown'}
                            </div>
                            <div>
                              <span className="font-medium">Location:</span> {
                                activity.city && activity.country 
                                  ? `${activity.city}, ${activity.country}`
                                  : activity.country || 'Unknown'
                              }
                            </div>
                            {activity.user_agent && (
                              <div className="col-span-2">
                                <span className="font-medium">User Agent:</span> {activity.user_agent}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Technical Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Last Login</h4>
                      <p className="text-sm text-gray-600">
                        {sessionDetails.user.last_login 
                          ? formatDateTime(sessionDetails.user.last_login)
                          : 'Unknown'
                        }
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Network Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">IP Address:</span>
                          <p className="text-gray-600 font-mono">{sessionDetails.user.last_ip || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium">Country:</span>
                          <p className="text-gray-600">{sessionDetails.user.last_country || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="font-medium">City:</span>
                          <p className="text-gray-600">{sessionDetails.user.last_city || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Session Statistics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Activities:</span>
                          <p className="text-gray-600">{sessionDetails.session.activity_count}</p>
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span>
                          <p className="text-gray-600">{sessionDetails.session.duration}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={fetchSessionDetails} disabled={loading}>
            Refresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}