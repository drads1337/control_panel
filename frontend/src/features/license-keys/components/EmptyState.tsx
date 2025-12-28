import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title = 'No License Keys Found',
  description = 'Create your first license key to get started'
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Card className="border-dashed border-2 border-muted-foreground/25">
        <CardContent className="p-6 sm:p-12">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

