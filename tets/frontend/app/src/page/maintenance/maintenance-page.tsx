import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Wrench, AlertTriangle, Calendar } from 'lucide-react';
import type { MaintenanceRecord } from '@/types/fleet';

// Mock data
const mockMaintenance: MaintenanceRecord[] = [
  {
    id: 1,
    vehicle_id: 1,
    type: 'scheduled',
    description: 'Oil change and filter replacement',
    cost: 150,
    mileage: 120000,
    service_date: '2024-01-15T10:00:00Z',
    next_service_date: '2024-04-15T10:00:00Z',
    vendor: 'ABC Auto Service',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    vehicle_id: 2,
    type: 'repair',
    description: 'Brake pad replacement',
    cost: 450,
    mileage: 95000,
    service_date: '2024-01-10T10:00:00Z',
    vendor: 'XYZ Repair Shop',
    created_at: '2024-01-10T10:00:00Z',
  },
];

const typeColors: Record<string, string> = {
  scheduled: 'bg-blue-500',
  repair: 'bg-red-500',
  inspection: 'bg-yellow-500',
};

export function MaintenancePage() {
  const maintenance = mockMaintenance;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Maintenance Management</h1>
          <p className="text-muted-foreground">
            Track and manage vehicle maintenance
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Maintenance
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Services</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              Next 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Maintenance Cost</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${maintenance.reduce((sum, m) => sum + m.cost, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehicles in Service</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Currently in maintenance
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Records</CardTitle>
          <CardDescription>
            All maintenance and service records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Service Date</TableHead>
                <TableHead>Next Service</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Vendor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No maintenance records found
                  </TableCell>
                </TableRow>
              ) : (
                maintenance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>Vehicle #{record.vehicle_id}</TableCell>
                    <TableCell>
                      <Badge className={typeColors[record.type] || 'bg-gray-500'}>
                        {record.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.description}</TableCell>
                    <TableCell>
                      {new Date(record.service_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {record.next_service_date 
                        ? new Date(record.next_service_date).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>${record.cost.toLocaleString()}</TableCell>
                    <TableCell>{record.vendor || 'N/A'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

