import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Route, MapPin, Clock, DollarSign } from 'lucide-react';

export function RoutesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Route Optimization</h1>
        <p className="text-muted-foreground">
          Plan and optimize routes for maximum efficiency
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Route Planning</CardTitle>
          <CardDescription>
            Create and optimize multi-stop routes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <Route className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Route optimization interface would go here
                </p>
                <p className="text-sm text-muted-foreground">
                  (Integration with Google Maps, Mapbox, or routing API)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimized Routes</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distance Saved</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,250 mi</div>
            <p className="text-xs text-muted-foreground">
              Through optimization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45 hrs</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

