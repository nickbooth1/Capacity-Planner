// Central module configuration
// This should be the single source of truth for available modules

export interface ModuleConfig {
  key: string;
  name: string;
  description: string;
  available: boolean;
}

export const MODULES: ModuleConfig[] = [
  {
    key: 'assets',
    name: 'Assets Module',
    description: 'Manage airport assets including stands, gates, and equipment',
    available: true,
  },
  {
    key: 'work',
    name: 'Work Module',
    description: 'Schedule and track maintenance work and operational tasks',
    available: true,
  },
  {
    key: 'capacity',
    name: 'Capacity Module',
    description: 'Calculate and monitor airport capacity and constraints',
    available: true,
  },
  {
    key: 'planning',
    name: 'Planning Module',
    description: 'Advanced planning tools for resource optimization',
    available: true,
  },
  {
    key: 'monitoring',
    name: 'Monitoring Module',
    description: 'Real-time monitoring and alerting for operations',
    available: true,
  },
];

export const getAvailableModules = () => MODULES.filter((m) => m.available);
