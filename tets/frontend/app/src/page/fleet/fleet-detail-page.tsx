import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Truck, MapPin, Calendar, FileText } from 'lucide-react';
import type { Vehicle } from '@/types/fleet';

// Mock data
const mockVehicle: Vehicle = {
  id: 1,
  vin: '1HGBH41JXMN109186',
  license_plate: 'ABC-1234',
  make: 'Freightliner',
  model: 'Cascadia',
  year: 2022,
  type: 'truck',
  status: 'in_route',
  mileage: 125000,
  registration_expiry: '2025-12-31',
  insurance_expiry: '2025-06-30',
  current_location: {
    lat: 40.7128,
    lng: -74.0060,
  },
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

const statusColors: Record<string, string> = {
  available: 'bg-green-500',
  in_route: 'bg-blue-500',
  maintenance: 'bg-yellow-500',
  out_of_service: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  available: 'Available',
  in_route: 'In Route',
  maintenance: 'Maintenance',
  out_of_service: 'Out of Service',
};

export function FleetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vehicle = mockVehicle; // В реальном приложении загружать по id

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fleet">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {vehicle.make} {vehicle.model}
            </h1>
            <p className="text-muted-foreground">{vehicle.license_plate}</p>
          </div>
        </div>
        <Button asChild>
          <Link to={`/fleet/${id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Vehicle
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={statusColors[vehicle.status]}>
              {statusLabels[vehicle.status]}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mileage</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicle.mileage.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">miles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registration</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicle.registration_expiry ? new Date(vehicle.registration_expiry).toLocaleDateString() : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Expiry date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Insurance</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicle.insurance_expiry ? new Date(vehicle.insurance_expiry).toLocaleDateString() : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Expiry date</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="trips">Trip History</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Information</CardTitle>
              <CardDescription>Basic vehicle details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">VIN</p>
                  <p className="text-sm font-mono">{vehicle.vin}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">License Plate</p>
                  <p className="text-sm">{vehicle.license_plate}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Make</p>
                  <p className="text-sm">{vehicle.make}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Model</p>
                  <p className="text-sm">{vehicle.model}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Year</p>
                  <p className="text-sm">{vehicle.year}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type</p>
                  <p className="text-sm capitalize">{vehicle.type}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trip History</CardTitle>
              <CardDescription>All trips for this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No trips found</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Records</CardTitle>
              <CardDescription>Service and repair history</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No maintenance records found</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Vehicle documents and certificates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No documents found</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

