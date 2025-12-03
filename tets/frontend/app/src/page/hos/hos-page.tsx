import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Users } from 'lucide-react';
import type { HOSRecord, Driver } from '@/types/fleet';

// Mock data
const mockDrivers: Driver[] = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0101',
    cdl_number: 'CDL123456',
    status: 'in_route',
    hos_status: 'driving',
    available_hours: 5.5,
    created_at: '2023-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
];

const hosStatusColors: Record<string, string> = {
  on_duty: 'bg-blue-500',
  driving: 'bg-indigo-500',
  off_duty: 'bg-gray-500',
  sleeper_berth: 'bg-purple-500',
};

export function HOSPage() {
  const drivers = mockDrivers;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">HOS / ELD Monitoring</h1>
        <p className="text-muted-foreground">
          Hours of Service tracking and Electronic Logging Device integration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently on duty
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HOS Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Available Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {drivers.length > 0 
                ? (drivers.reduce((sum, d) => sum + (d.available_hours || 0), 0) / drivers.length).toFixed(1)
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Hours remaining
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver HOS Status</CardTitle>
          <CardDescription>
            Current Hours of Service status for all drivers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>HOS Status</TableHead>
                <TableHead>Available Hours</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead>CDL Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No drivers found
                  </TableCell>
                </TableRow>
              ) : (
                drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">
                      {driver.first_name} {driver.last_name}
                    </TableCell>
                    <TableCell>
                      {driver.hos_status && (
                        <Badge className={hosStatusColors[driver.hos_status] || 'bg-gray-500'}>
                          {driver.hos_status.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {driver.available_hours ? `${driver.available_hours.toFixed(1)} hrs` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{driver.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{driver.cdl_number}</TableCell>
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

