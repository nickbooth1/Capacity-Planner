import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { standApi } from '../api/stand-api';
import type { Stand } from '../types';

const standFormSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  terminal: z.string().max(50, 'Terminal must be 50 characters or less').optional(),
  status: z.enum(['operational', 'maintenance', 'closed']).default('operational'),
  dimensions: z
    .object({
      length: z.number().positive('Length must be positive').optional(),
      width: z.number().positive('Width must be positive').optional(),
      height: z.number().positive('Height must be positive').optional(),
    })
    .optional(),
  aircraftCompatibility: z
    .object({
      maxWingspan: z.number().positive('Max wingspan must be positive').optional(),
      maxLength: z.number().positive('Max length must be positive').optional(),
      maxWeight: z.number().positive('Max weight must be positive').optional(),
      compatibleCategories: z.array(z.enum(['A', 'B', 'C', 'D', 'E', 'F'])).optional(),
    })
    .optional(),
  groundSupport: z
    .object({
      hasPowerSupply: z.boolean().optional(),
      hasGroundAir: z.boolean().optional(),
      hasFuelHydrant: z.boolean().optional(),
    })
    .optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

type StandFormData = z.infer<typeof standFormSchema>;

interface StandFormProps {
  organizationId: string;
  stand?: Stand;
  onSuccess?: () => void;
}

export function StandForm({ organizationId, stand, onSuccess }: StandFormProps) {
  const isEditing = !!stand;

  const form = useForm<StandFormData>({
    resolver: zodResolver(standFormSchema),
    defaultValues: {
      code: stand?.code || '',
      name: stand?.name || '',
      terminal: stand?.terminal || '',
      status: stand?.status || 'operational',
      dimensions: stand?.dimensions || {},
      aircraftCompatibility: stand?.aircraftCompatibility || {},
      groundSupport: stand?.groundSupport || {},
      latitude: stand?.latitude || undefined,
      longitude: stand?.longitude || undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: StandFormData) => standApi.createStand(organizationId, data),
    onSuccess: () => {
      onSuccess?.();
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: StandFormData) => {
      if (!stand) throw new Error('Stand is required for update');
      return standApi.updateStand(stand.id, organizationId, {
        ...data,
        version: stand.version,
      });
    },
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const onSubmit = (data: StandFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input placeholder="A1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Stand A1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="terminal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Terminal</FormLabel>
                <FormControl>
                  <Input placeholder="Terminal 1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Dimensions</h3>
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="dimensions.length"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Length (m)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="60"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dimensions.width"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Width (m)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="30"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dimensions.height"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Height (m)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="15"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Aircraft Compatibility</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="aircraftCompatibility.maxWingspan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Wingspan (m)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="80"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aircraftCompatibility.maxLength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Length (m)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="75"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="aircraftCompatibility.maxWeight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Weight (kg)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1000"
                    placeholder="560000"
                    {...field}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Location</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="latitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="51.4700"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="longitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="-0.4543"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEditing ? 'Update Stand' : 'Create Stand'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
