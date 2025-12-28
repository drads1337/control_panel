import { Spinner } from '@/components/ui/spinner'

interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = "Loading...", className = "" }: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <Spinner message={message} />
    </div>
  )
}
