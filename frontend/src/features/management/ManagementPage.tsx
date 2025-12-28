import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ManagementPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <Card className="mx-4 lg:mx-6">
            <CardHeader>
              <CardTitle>Management</CardTitle>
              <CardDescription>
                Manage your project settings and configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Management features will be available here soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

