import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Welcome to Agents
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Build powerful AI agents with ease. Manage your projects and agents from the sidebar.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3 mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Fast & Reliable</CardTitle>
            <CardDescription>
              Built with modern technologies for optimal performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Experience lightning-fast response times and reliable service.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secure</CardTitle>
            <CardDescription>
              Your data is protected with industry-standard security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We take security seriously and protect your information.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Easy to Use</CardTitle>
            <CardDescription>
              Intuitive interface designed for everyone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Simple and clean design that makes everything easy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

