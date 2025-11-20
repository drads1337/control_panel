import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { enhancedApi, getErrorMessage } from '@/shared/api/enhanced-client';
import { createUser } from '@/entities/user/api/user';
import { getGames } from '@/entities/game/api/game';
import { type Game } from '@/entities/game';
import { toast } from 'sonner';
import { createUserSchema, type CreateUserInput } from '@/lib/validations/user';
import { measurePerformance } from '@/lib/sentry-config';

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  is_system_role: boolean;
  user_count: number;
  created_at: string;
  updated_at?: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      token_balance: 0,
      work_duration_days: 7,
      selected_games: [],
      selected_rbac_role: undefined,
    },
  });

  const [loading, setLoading] = useState(false);
  const [rbacLoading, setRbacLoading] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);

  const [rbacError, setRbacError] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const loadRoles = useCallback(async () => {
    try {
      setRbacLoading(true);
      setRbacError(null);

      const response = await enhancedApi.get('/api/rbac/roles');
      setRoles(response.data.roles || []);
    } catch (error) {

      const errorMessage = getErrorMessage(error);
      setRbacError(errorMessage);
    } finally {
      setRbacLoading(false);
    }
  }, []);

  const loadGames = useCallback(async () => {
    try {
      setGamesLoading(true);
      setGamesError(null);

      // Use universal API function - it uses /api/products endpoint
      const response = await getGames('all');
      setGames(response.games || response.products || []);
    } catch (error) {

      const errorMessage = getErrorMessage(error);
      setGamesError(errorMessage);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadRoles();
      loadGames();
    }
  }, [open, loadRoles, loadGames]);

  useEffect(() => {
    if (!open) {
      form.reset({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        token_balance: 0,
        work_duration_days: 7,
        selected_games: [],
        selected_rbac_role: undefined,
      });
      setRbacError(null);
      setGamesError(null);
    }
  }, [open, form]);

  const handleCreate = form.handleSubmit(async (data) => {
    try {
      setLoading(true);

      const userData = {
        username: data.username,
        password: data.password,
        first_name: data.first_name || undefined,
        last_name: data.last_name || undefined,
        email: data.email || undefined,
        token_balance: data.token_balance,
        work_duration_days: data.work_duration_days,
        game_ids: data.selected_games,
        rbac_role_ids: data.selected_rbac_role ? [data.selected_rbac_role] : []
      };

      await measurePerformance(
        'user_creation',
        () => createUser(userData),
        {
          has_email: !!data.email,
          has_games: data.selected_games.length > 0,
          has_role: !!data.selected_rbac_role,
          token_balance: data.token_balance,
        }
      );

      toast.success('Employee created successfully');
      onOpenChange(false);
      onSuccess();
    } catch (error) {

      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Employee</DialogTitle>
          <DialogDescription>
            Create a new employee in the system (not for clients)
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter username"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password *</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter password (minimum 8 characters)"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter first name"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter last name"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter email"
                      disabled={loading}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="token_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token Balance</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      disabled={loading}
                      {...field}
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="work_duration_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Duration (days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      disabled={loading}
                      {...field}
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    How long the employee will work (when their access expires)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="selected_rbac_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RBAC Role *</FormLabel>
                  {rbacLoading ? (
                    <div className="text-sm text-muted-foreground">Loading roles...</div>
                  ) : rbacError ? (
                    <div className="text-sm text-red-500">Error loading roles: {rbacError}</div>
                  ) : (
                    <Select
                      value={field.value?.toString() || ""}
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      disabled={loading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles
                          .filter(role => role.name !== 'client')
                          .map((role) => (
                            <SelectItem key={role.id} value={role.id.toString()}>
                              {role.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="selected_games"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application Access</FormLabel>
                  {gamesLoading ? (
                    <div className="text-sm text-muted-foreground">Loading games...</div>
                  ) : gamesError ? (
                    <div className="text-sm text-red-500">Error loading games: {gamesError}</div>
                  ) : (
                    <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-2">
                      {games.map((game) => (
                        <div key={game.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`game-${game.id}`}
                            checked={field.value?.includes(game.id) || false}
                            onCheckedChange={(checked) => {
                              const currentGames = field.value || [];
                              if (checked) {
                                field.onChange([...currentGames, game.id]);
                              } else {
                                field.onChange(currentGames.filter(id => id !== game.id));
                              }
                            }}
                            disabled={loading}
                          />
                          <Label htmlFor={`game-${game.id}`} className="text-sm">
                            <div>
                              <div className="font-medium">{game.name}</div>
                              <div className="text-xs text-muted-foreground">{game.description || 'No description'}</div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Employee'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;
