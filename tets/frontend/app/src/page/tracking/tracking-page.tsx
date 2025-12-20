import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, MapPin, Clock, Truck } from 'lucide-react';
import type { Trip } from '@/types/fleet';

// Mock data
const mockActiveTrips: Trip[] = [
  {
    id: 1,
    trip_number: 'TR-001',
    load_type: 'general_freight',
    pickup_location: {
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      lat: 40.7128,
      lng: -74.0060,
    },
    delivery_location: {
      address: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      lat: 34.0522,
      lng: -118.2437,
    },
    pickup_date: '2024-01-20T08:00:00Z',
    delivery_date: '2024-01-22T18:00:00Z',
    status: 'in_transit',
    driver_id: 1,
    vehicle_id: 1,
    customer_name: 'ABC Logistics',
    revenue: 3500,
    distance: 2800,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
  },
];

export function TrackingPage() {
  const activeTrips = mockActiveTrips;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">GPS Tracking</h1>
        <p className="text-muted-foreground">
          Real-time tracking of all active trips
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTrips.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently in transit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehicles Tracked</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTrips.length}</div>
            <p className="text-xs text-muted-foreground">
              With GPS enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Speed</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">65 mph</div>
            <p className="text-xs text-muted-foreground">
              Average speed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Map</CardTitle>
          <CardDescription>
            Real-time location of all active vehicles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Map integration would go here
              </p>
              <p className="text-sm text-muted-foreground">
                (Google Maps, Mapbox, or other mapping service)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Trips</CardTitle>
          <CardDescription>
            Currently tracked trips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeTrips.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No active trips
              </p>
            ) : (
              activeTrips.map((trip) => (
                <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{trip.trip_number}</span>
                      <Badge variant="outline">{trip.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {trip.pickup_location.city}, {trip.pickup_location.state} → {trip.delivery_location.city}, {trip.delivery_location.state}
                    </div>
                    {trip.driver_id && (
                      <div className="text-sm text-muted-foreground">
                        Driver #{trip.driver_id} • Vehicle #{trip.vehicle_id}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {trip.distance ? `${trip.distance} mi` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ETA: {new Date(trip.delivery_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

