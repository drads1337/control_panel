import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] sm:min-h-[70vh] text-center px-4 sm:px-6">
      <div className="space-y-4 sm:space-y-6 max-w-md w-full">
        <div className="space-y-2 sm:space-y-3">
          <Typography variant="h1" className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl font-bold text-primary">
            404
          </Typography>
          <Typography variant="h2" className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-semibold">
            Page Not Found
          </Typography>
          <Typography variant="muted" className="text-sm xs:text-base sm:text-base md:text-lg px-2 sm:px-0">
            The page you're looking for doesn't exist or has been moved.
          </Typography>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center pt-2 sm:pt-0">
          <Button 
            onClick={() => navigate('/dashboard')}
            variant="default"
            size="lg"
            className="w-full sm:w-auto text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5"
          >
            Go to Dashboard
          </Button>
          <Button 
            onClick={() => navigate(-1)}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

