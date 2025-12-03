import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DriverFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/drivers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? 'Edit Driver' : 'Add Driver'}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? 'Update driver information' : 'Add a new driver to your team'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver Information</CardTitle>
          <CardDescription>
            Enter driver details below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            // Handle form submission
            navigate('/drivers');
          }}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" placeholder="John" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" placeholder="Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="john.doe@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" placeholder="+1-555-0101" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cdl_number">CDL Number</Label>
                <Input id="cdl_number" placeholder="CDL123456" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cdl_expiry">CDL Expiry Date</Label>
                <Input id="cdl_expiry" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medical_expiry">Medical Certificate Expiry</Label>
                <Input id="medical_expiry" type="date" />
              </div>
            </div>
            <div className="flex gap-4">
              <Button type="submit">
                {isEdit ? 'Update Driver' : 'Add Driver'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/drivers">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

