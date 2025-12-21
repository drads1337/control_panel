import { cn } from "@/shared/lib/utils/index"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

function Spinner({ 
  className, 
  size = 'md',
  ...props 
}: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-[3px]'
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary border-t-transparent",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
}

export { Spinner }

