import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ErrorStateProps {
  error: string
  onRetry: () => void
  className?: string
}

export function ErrorState({ error, onRetry, className = "" }: ErrorStateProps) {
  const navigate = useNavigate()
  
  const isAuthError = error.includes('Authentication') || error.includes('Session expired')
  
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Dashboard</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <div className="flex gap-2 justify-center">
          {isAuthError ? (
            <Button onClick={() => navigate('/login')}>
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </Button>
          ) : (
            <Button onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
