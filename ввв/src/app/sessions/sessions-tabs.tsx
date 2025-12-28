import React, { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, BarChart3 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import SessionsSearch from './sessions-search'
import SessionsTable from './sessions-table'
import type { Session } from '@/entities/session'

// Lazy load chart component to reduce initial bundle size
const SessionStatsCharts = React.lazy(() => 
  import('../dashboard/session-stats-charts').then(module => ({ 
    default: module.SessionStatsCharts 
  }))
)

interface SessionsTabsProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedSessions: Set<number>
  sessions: Session[]
  loading: boolean
  pagination: any
  stats: any
  onToggleSessionSelection: (userId: number) => void
  onSelectAllSessions: (sessions: Session[]) => void
  onViewDetails: (userId: number, username: string) => void
  onTerminateSession: (userId: number) => void
  onBulkTerminate: () => void
  onRefresh: () => void
  onChangePage: (page: number) => void
}

export default function SessionsTabs({
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  selectedSessions,
  sessions,
  loading,
  pagination,
  stats,
  onToggleSessionSelection,
  onSelectAllSessions,
  onViewDetails,
  onTerminateSession,
  onBulkTerminate,
  onRefresh,
  onChangePage
}: SessionsTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-14 bg-muted border border-border rounded-lg mb-6">
        <TabsTrigger 
          value="sessions" 
          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
        >
          <User className="h-4 w-4" />
          <span>Session List</span>
        </TabsTrigger>
        <TabsTrigger 
          value="stats" 
          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
        >
          <BarChart3 className="h-4 w-4" />
          <span>Statistics</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sessions" className="space-y-6">
        <SessionsSearch
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedSessionsCount={selectedSessions.size}
          onBulkTerminate={onBulkTerminate}
          onRefresh={onRefresh}
          loading={loading}
        />

        <SessionsTable
          sessions={sessions}
          loading={loading}
          searchTerm={searchTerm}
          selectedSessions={selectedSessions}
          pagination={pagination}
          onToggleSessionSelection={onToggleSessionSelection}
          onSelectAllSessions={onSelectAllSessions}
          onViewDetails={onViewDetails}
          onTerminateSession={onTerminateSession}
          onChangePage={onChangePage}
        />
      </TabsContent>

      <TabsContent value="stats" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Session Analytics
            </CardTitle>
            <CardDescription>
              Charts and user activity statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="flex items-center justify-center h-[300px]"><Spinner size="lg" message="Loading charts..." /></div>}>
              <SessionStatsCharts stats={stats} />
            </Suspense>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
