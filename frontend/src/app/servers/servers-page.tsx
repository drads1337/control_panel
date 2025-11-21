import { useAuthContext } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Server } from 'lucide-react'

export default function ServersPage() {
  const { user } = useAuthContext()

  return (
    <div>
          {}
          <div className="flex items-center justify-center min-h-full">
            <Card className="w-full max-w-md text-center">
              <CardHeader>
                <div className="mx-auto mb-4">
                  <Server className="h-16 w-16 text-gray-400" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  SOON
                </CardTitle>
                <CardDescription>
                  Server management functionality is under development
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Here will be an interface for monitoring performance, 
                  managing settings and controlling the state of product servers.
                </p>
              </CardContent>
            </Card>
          </div>
    </div>
  )
} 