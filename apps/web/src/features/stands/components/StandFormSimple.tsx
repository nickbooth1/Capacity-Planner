import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
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
// import { Checkbox } from "@/components/ui/checkbox"
import { standApi } from '../api/stand-api';
import { airportApi } from '@/features/airport/api/airport-api';
import type { Stand } from '../types';

const standFormSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  terminal: z.string().max(50, 'Terminal must be 50 characters or less').optional().nullable(),
  pier: z.string().max(50, 'Pier must be 50 characters or less').optional().nullable(),
  status: z.enum(['operational', 'maintenance', 'closed']).default('operational'),
  capabilities: z
    .object({
      aircraftSize: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
      hasPowerSupply: z.boolean().optional(),
      hasGroundSupport: z.boolean().optional(),
      maxWeight: z.number().positive('Max weight must be positive').optional(),
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

export function StandFormSimple({ organizationId, stand, onSuccess }: StandFormProps) {
  const isEditing = !!stand;
  const [selectedTerminal, setSelectedTerminal] = React.useState<string | null>(
    stand?.terminal || null
  );

  // Fetch airport configuration
  const { data: airportConfig } = useQuery({
    queryKey: ['airport-config'],
    queryFn: () => airportApi.getAirportConfig(),
  });

  const form = useForm<StandFormData>({
    resolver: zodResolver(standFormSchema),
    defaultValues: {
      code: stand?.code || '',
      name: stand?.name || '',
      terminal: stand?.terminal || '',
      pier: stand?.pier || '',
      status: stand?.status || 'operational',
      capabilities: {
        aircraftSize: stand?.capabilities?.aircraftSize || 'C',
        hasPowerSupply: stand?.capabilities?.hasPowerSupply ?? true,
        hasGroundSupport: stand?.capabilities?.hasGroundSupport ?? true,
        maxWeight: stand?.capabilities?.maxWeight || 150,
      },
      latitude: stand?.latitude || 53.365,
      longitude: stand?.longitude || -2.272,
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stand Code</FormLabel>
                <FormControl>
                  <Input placeholder="105" {...field} />
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
                <FormLabel>Stand Name</FormLabel>
                <FormControl>
                  <Input placeholder="Stand 105" {...field} />
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
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedTerminal(value);
                    // Reset pier when terminal changes
                    form.setValue('pier', '');
                  }}
                  value={field.value || undefined}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select terminal" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {airportConfig?.terminals.map((terminal) => (
                      <SelectItem key={terminal.id} value={terminal.code}>
                        {terminal.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Remote">Remote Stand</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pier"
            render={({ field }) => {
              const selectedTerminalData = airportConfig?.terminals.find(
                (t) => t.code === selectedTerminal
              );
              const piers = selectedTerminalData?.piers || [];

              return (
                <FormItem>
                  <FormLabel>Pier</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={
                      !selectedTerminal || selectedTerminal === 'Remote' || piers.length === 0
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={piers.length === 0 ? 'No piers available' : 'Select pier'}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {piers.map((pier) => (
                        <SelectItem key={pier.code} value={pier.code}>
                          {pier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <h4 className="text-sm font-medium">Stand Capabilities</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="capabilities.aircraftSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft Size Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="A">Category A</SelectItem>
                      <SelectItem value="B">Category B</SelectItem>
                      <SelectItem value="C">Category C</SelectItem>
                      <SelectItem value="D">Category D</SelectItem>
                      <SelectItem value="E">Category E</SelectItem>
                      <SelectItem value="F">Category F</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capabilities.maxWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Weight (tons)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="150"
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

          <div className="flex space-x-6">
            <FormField
              control={form.control}
              name="capabilities.hasPowerSupply"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has Power Supply</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capabilities.hasGroundSupport"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has Ground Support</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Location</h4>
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
                      placeholder="53.365"
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
                      placeholder="-2.272"
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

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEditing ? 'Update Stand' : 'Create Stand'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
