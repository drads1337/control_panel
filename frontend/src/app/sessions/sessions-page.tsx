import { useAuthContext } from '@/contexts/auth-context'
import { useSessionsQuery } from '@/hooks/use-sessions-query'
import { useDebounce } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { SessionDetailsDialog } from './session-details-dialog'
import SessionStatsCards from './session-stats-cards'
import SessionsTabs from './sessions-tabs'

export default function Sessions() {
  const { user, token } = useAuthContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSessions, setSelectedSessions] = useState<Set<number>>(new Set())
  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState<{ userId: number; username: string } | null>(null)
  const [activeTab, setActiveTab] = useState('sessions')
  
  const {
    sessions,
    stats,
    loading,
    error,
    pagination,
    terminateUserSession,
    terminateMultipleSessions,
    changePage,
    changePerPage,
    refresh,
    clearError
  } = useSessionsQuery({
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds
  })

  // Debug logging
  useEffect(() => {
    console.log('Sessions component debug:', {
      token: token ? 'present' : 'missing',
      user: user ? 'present' : 'missing',
      sessionsCount: sessions.length,
      loading,
      error,
      pagination
    })
  }, [token, user, sessions, loading, error, pagination])

  // Debounce search to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Filter sessions based on search term - MEMOIZED with debounced search
  const filteredSessions = useMemo(() => {
    if (!debouncedSearchTerm) return sessions
    
    const searchLower = debouncedSearchTerm.toLowerCase()
    return sessions.filter(session =>
      session.username.toLowerCase().includes(searchLower) ||
      (session.last_ip && session.last_ip.includes(debouncedSearchTerm)) ||
      (session.last_country && session.last_country.toLowerCase().includes(searchLower)) ||
      (session.last_city && session.last_city.toLowerCase().includes(searchLower))
    )
  }, [sessions, debouncedSearchTerm])

  // Handle session selection - MEMOIZED
  const toggleSessionSelection = useCallback((userId: number) => {
    setSelectedSessions(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(userId)) {
        newSelected.delete(userId)
      } else {
        newSelected.add(userId)
      }
      return newSelected
    })
  }, [])

  // Handle select all sessions - MEMOIZED
  const handleSelectAllSessions = useCallback((sessions: any[]) => {
    setSelectedSessions(new Set(sessions.map(s => s.user_id)))
  }, [])

  // Handle bulk termination - MEMOIZED
  const handleBulkTerminate = useCallback(async () => {
    if (selectedSessions.size === 0) return
    
    const result = await terminateMultipleSessions(Array.from(selectedSessions))
    if (result.success) {
      setSelectedSessions(new Set())
    }
  }, [selectedSessions, terminateMultipleSessions])

  // Handle single session termination - MEMOIZED
  const handleTerminateSession = useCallback(async (userId: number) => {
    await terminateUserSession(userId)
  }, [terminateUserSession])

  // Handle viewing session details - MEMOIZED
  const handleViewDetails = useCallback((userId: number, username: string) => {
    setSelectedSessionForDetails({ userId, username })
  }, [])

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError()
    }
  }, [clearError])

  if (!token) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
          <p className="text-gray-600">Please log in to view sessions</p>
        </div>
      </div>
    )
  }

  return (
    <div>
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Session Management
            </h2>
            <p className="text-muted-foreground">
              Monitor and manage active user gaming sessions
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-800">{error}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearError}
                  className="ml-auto text-red-600 hover:text-red-800"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}



          {/* Stats Cards */}
          <SessionStatsCards stats={stats} loading={loading} />

          {/* Tabs */}
          <SessionsTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedSessions={selectedSessions}
            sessions={filteredSessions}
            loading={loading}
            pagination={pagination}
            stats={stats}
            onToggleSessionSelection={toggleSessionSelection}
            onSelectAllSessions={handleSelectAllSessions}
            onViewDetails={handleViewDetails}
            onTerminateSession={handleTerminateSession}
            onBulkTerminate={handleBulkTerminate}
            onRefresh={refresh}
            onChangePage={changePage}
          />

      {/* Session Details Dialog */}
      {selectedSessionForDetails && token && (
        <SessionDetailsDialog
          isOpen={!!selectedSessionForDetails}
          onClose={() => setSelectedSessionForDetails(null)}
          userId={selectedSessionForDetails.userId}
          username={selectedSessionForDetails.username}
          token={token}
        />
      )}
    </div>
  )
}