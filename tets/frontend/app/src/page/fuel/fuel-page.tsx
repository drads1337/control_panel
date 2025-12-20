import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Fuel, TrendingUp, DollarSign } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { FuelRecord } from '@/types/fleet';

// Mock data
const mockFuelRecords: FuelRecord[] = [
  {
    id: 1,
    vehicle_id: 1,
    driver_id: 1,
    gallons: 100,
    price_per_gallon: 3.50,
    total_cost: 350,
    location: 'Truck Stop #123',
    state: 'NY',
    mileage: 125000,
    fuel_date: '2024-01-20T10:00:00Z',
    created_at: '2024-01-20T10:00:00Z',
  },
  {
    id: 2,
    vehicle_id: 2,
    driver_id: 2,
    gallons: 120,
    price_per_gallon: 3.45,
    total_cost: 414,
    location: 'Gas Station #456',
    state: 'CA',
    mileage: 98000,
    fuel_date: '2024-01-19T14:00:00Z',
    created_at: '2024-01-19T14:00:00Z',
  },
];

const fuelData = [
  { month: 'Jan', gallons: 2500, cost: 8750 },
  { month: 'Feb', gallons: 2800, cost: 9800 },
  { month: 'Mar', gallons: 3000, cost: 10500 },
  { month: 'Apr', gallons: 2900, cost: 10150 },
  { month: 'May', gallons: 3100, cost: 10850 },
  { month: 'Jun', gallons: 2850, cost: 9975 },
];

const totalFuel = mockFuelRecords.reduce((sum, r) => sum + r.gallons, 0);
const totalCost = mockFuelRecords.reduce((sum, r) => sum + r.total_cost, 0);
const avgPrice = totalFuel > 0 ? totalCost / totalFuel : 0;

export function FuelPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Fuel Management</h1>
          <p className="text-muted-foreground">
            Track fuel purchases and consumption
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Fuel Record
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fuel</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFuel.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Gallons this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Price/Gallon</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgPrice.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Average price
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fuel Consumption Trend</CardTitle>
          <CardDescription>Monthly fuel usage and costs</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={fuelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="gallons" stroke="#3b82f6" name="Gallons" />
              <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#ef4444" name="Cost ($)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fuel Records</CardTitle>
          <CardDescription>
            All fuel purchase records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Gallons</TableHead>
                <TableHead>Price/Gallon</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Mileage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockFuelRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No fuel records found
                  </TableCell>
                </TableRow>
              ) : (
                mockFuelRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.fuel_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>Vehicle #{record.vehicle_id}</TableCell>
                    <TableCell>Driver #{record.driver_id}</TableCell>
                    <TableCell>
                      {record.location}, {record.state}
                    </TableCell>
                    <TableCell>{record.gallons}</TableCell>
                    <TableCell>${record.price_per_gallon.toFixed(2)}</TableCell>
                    <TableCell>${record.total_cost.toLocaleString()}</TableCell>
                    <TableCell>{record.mileage.toLocaleString()} mi</TableCell>
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

