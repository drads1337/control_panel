import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw } from 'lucide-react'

interface SessionsSearchProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedSessionsCount: number
  onBulkTerminate: () => void
  onRefresh: () => void
  loading: boolean
}

export default function SessionsSearch({
  searchTerm,
  setSearchTerm,
  selectedSessionsCount,
  onBulkTerminate,
  onRefresh,
  loading
}: SessionsSearchProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by user, IP or location..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {selectedSessionsCount > 0 && (
            <Button 
              variant="destructive" 
              onClick={onBulkTerminate}
              className="flex items-center gap-2"
            >
              Terminate Selected ({selectedSessionsCount})
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
