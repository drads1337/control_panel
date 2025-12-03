import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Users, Edit, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Driver, DriverStatus } from '@/types/fleet';

// Mock data
const mockDrivers: Driver[] = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0101',
    cdl_number: 'CDL123456',
    cdl_expiry: '2026-12-31',
    medical_expiry: '2025-06-30',
    status: 'in_route',
    hos_status: 'driving',
    available_hours: 5.5,
    rating: 4.8,
    total_trips: 125,
    total_miles: 150000,
    created_at: '2023-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+1-555-0102',
    cdl_number: 'CDL789012',
    cdl_expiry: '2025-11-30',
    medical_expiry: '2025-05-31',
    status: 'available',
    hos_status: 'off_duty',
    available_hours: 11,
    rating: 4.9,
    total_trips: 200,
    total_miles: 250000,
    created_at: '2022-06-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
];

const statusColors: Record<DriverStatus, string> = {
  available: 'bg-green-500',
  in_route: 'bg-blue-500',
  off_duty: 'bg-gray-500',
  on_break: 'bg-yellow-500',
  sick_leave: 'bg-red-500',
};

const statusLabels: Record<DriverStatus, string> = {
  available: 'Available',
  in_route: 'In Route',
  off_duty: 'Off Duty',
  on_break: 'On Break',
  sick_leave: 'Sick Leave',
};

export function DriverListPage() {
  const [drivers] = useState<Driver[]>(mockDrivers);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus | 'all'>('all');

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.cdl_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Driver Management</h1>
          <p className="text-muted-foreground">
            Manage your drivers and their information
          </p>
        </div>
        <Button asChild>
          <Link to="/drivers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drivers</CardTitle>
          <CardDescription>
            View and manage all drivers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, CDL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DriverStatus | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_route">In Route</SelectItem>
                <SelectItem value="off_duty">Off Duty</SelectItem>
                <SelectItem value="on_break">On Break</SelectItem>
                <SelectItem value="sick_leave">Sick Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>CDL Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HOS Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No drivers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">
                      {driver.first_name} {driver.last_name}
                    </TableCell>
                    <TableCell>{driver.email}</TableCell>
                    <TableCell>{driver.phone}</TableCell>
                    <TableCell className="font-mono text-sm">{driver.cdl_number}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[driver.status]}>
                        {statusLabels[driver.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {driver.hos_status && (
                        <Badge variant="outline" className="capitalize">
                          {driver.hos_status.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {driver.rating ? (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{driver.rating}</span>
                          <span className="text-muted-foreground">/ 5.0</span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/drivers/${driver.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/drivers/${driver.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
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

