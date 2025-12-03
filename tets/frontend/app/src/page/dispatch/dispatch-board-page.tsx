import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ClipboardList, Truck, Users, MapPin, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Trip, TripStatus } from '@/types/fleet';

// Mock data
const mockTrips: Trip[] = [
  {
    id: 1,
    trip_number: 'TR-001',
    load_type: 'general_freight',
    pickup_location: {
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    },
    delivery_location: {
      address: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    },
    pickup_date: '2024-01-20T08:00:00Z',
    delivery_date: '2024-01-22T18:00:00Z',
    status: 'in_transit',
    driver_id: 1,
    vehicle_id: 1,
    customer_name: 'ABC Logistics',
    revenue: 3500,
    distance: 2800,
    weight: 25000,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
  },
  {
    id: 2,
    trip_number: 'TR-002',
    load_type: 'refrigerated',
    pickup_location: {
      address: '789 Pine St',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
    },
    delivery_location: {
      address: '321 Elm St',
      city: 'Miami',
      state: 'FL',
      zip: '33101',
    },
    pickup_date: '2024-01-21T10:00:00Z',
    delivery_date: '2024-01-23T20:00:00Z',
    status: 'assigned',
    driver_id: 2,
    vehicle_id: 2,
    customer_name: 'XYZ Shipping',
    revenue: 4200,
    distance: 1200,
    weight: 18000,
    created_at: '2024-01-16T10:00:00Z',
    updated_at: '2024-01-21T10:00:00Z',
  },
];

const statusColors: Record<TripStatus, string> = {
  pending: 'bg-gray-500',
  assigned: 'bg-yellow-500',
  dispatched: 'bg-blue-500',
  in_transit: 'bg-indigo-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
  on_hold: 'bg-orange-500',
};

const statusLabels: Record<TripStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
};

export function DispatchBoardPage() {
  const [trips] = useState<Trip[]>(mockTrips);
  const [statusFilter, setStatusFilter] = useState<TripStatus | 'all'>('all');

  const filteredTrips = trips.filter((trip) => {
    return statusFilter === 'all' || trip.status === statusFilter;
  });

  const groupedTrips = filteredTrips.reduce((acc, trip) => {
    if (!acc[trip.status]) {
      acc[trip.status] = [];
    }
    acc[trip.status].push(trip);
    return acc;
  }, {} as Record<TripStatus, Trip[]>);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Dispatch Board</h1>
          <p className="text-muted-foreground">
            Manage and monitor all trips
          </p>
        </div>
        <Button asChild>
          <Link to="/trips/new">
            <Plus className="mr-2 h-4 w-4" />
            New Trip
          </Link>
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TripStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(statusLabels).map(([status, label]) => {
          const tripsInStatus = groupedTrips[status as TripStatus] || [];
          return (
            <Card key={status}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{label}</CardTitle>
                  <Badge className={statusColors[status as TripStatus]}>
                    {tripsInStatus.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {tripsInStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No trips
                  </p>
                ) : (
                  tripsInStatus.map((trip) => (
                    <Card key={trip.id} className="cursor-pointer hover:bg-accent">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{trip.trip_number}</span>
                            <Badge variant="outline" className="text-xs">
                              {trip.load_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">From:</span>
                              <span>{trip.pickup_location.city}, {trip.pickup_location.state}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">To:</span>
                              <span>{trip.delivery_location.city}, {trip.delivery_location.state}</span>
                            </div>
                            {trip.driver_id && (
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Driver:</span>
                                <span>Driver #{trip.driver_id}</span>
                              </div>
                            )}
                            {trip.vehicle_id && (
                              <div className="flex items-center gap-2">
                                <Truck className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Vehicle:</span>
                                <span>Vehicle #{trip.vehicle_id}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Pickup:</span>
                              <span>{new Date(trip.pickup_date).toLocaleDateString()}</span>
                            </div>
                            {trip.revenue && (
                              <div className="font-medium text-green-600">
                                ${trip.revenue.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

