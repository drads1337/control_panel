import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { ComplianceDocument } from '@/types/fleet';

// Mock data
const mockDocuments: ComplianceDocument[] = [
  {
    id: 1,
    type: 'cdl',
    entity_type: 'driver',
    entity_id: 1,
    document_number: 'CDL123456',
    expiry_date: '2026-12-31',
    issue_date: '2021-12-31',
    status: 'valid',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    type: 'registration',
    entity_type: 'vehicle',
    entity_id: 1,
    document_number: 'REG789012',
    expiry_date: '2025-12-31',
    issue_date: '2023-12-31',
    status: 'valid',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 3,
    type: 'insurance',
    entity_type: 'vehicle',
    entity_id: 2,
    document_number: 'INS345678',
    expiry_date: '2024-06-30',
    issue_date: '2023-06-30',
    status: 'expiring_soon',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
];

const statusColors: Record<string, string> = {
  valid: 'bg-green-500',
  expiring_soon: 'bg-yellow-500',
  expired: 'bg-red-500',
};

const statusIcons: Record<string, typeof CheckCircle> = {
  valid: CheckCircle,
  expiring_soon: AlertTriangle,
  expired: XCircle,
};

export function CompliancePage() {
  const documents = mockDocuments;
  const expiringSoon = documents.filter(d => d.status === 'expiring_soon').length;
  const expired = documents.filter(d => d.status === 'expired').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Compliance & Documentation</h1>
        <p className="text-muted-foreground">
          Track compliance documents and expiration dates
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Documents</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter(d => d.status === 'valid').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently valid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              Next 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expired}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Documents</CardTitle>
          <CardDescription>
            All compliance documents and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Document Number</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No documents found
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => {
                  const StatusIcon = statusIcons[doc.status] || CheckCircle;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="capitalize">{doc.type}</TableCell>
                      <TableCell className="capitalize">
                        {doc.entity_type} #{doc.entity_id}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{doc.document_number}</TableCell>
                      <TableCell>
                        {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[doc.status] || 'bg-gray-500'}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {doc.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

