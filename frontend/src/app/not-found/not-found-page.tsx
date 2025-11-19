import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="space-y-6 max-w-md">
        <div className="space-y-2">
          <Typography variant="h1" className="text-6xl font-bold text-primary">
            404
          </Typography>
          <Typography variant="h2" className="text-2xl font-semibold">
            Page Not Found
          </Typography>
          <Typography variant="muted" className="text-base">
            The page you're looking for doesn't exist or has been moved.
          </Typography>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={() => navigate('/dashboard')}
            variant="default"
            size="lg"
          >
            Go to Dashboard
          </Button>
          <Button 
            onClick={() => navigate(-1)}
            variant="outline"
            size="lg"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

