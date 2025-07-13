// Core type definitions

export interface Organization {
  id: string;
  name: string;
  code: string; // IATA code
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN_SUPPORT = 'admin_support',
  CLIENT_ADMIN = 'client_admin',
  ASSET_OWNER = 'asset_owner',
  AIRPORT_PLANNER = 'airport_planner',
  KEY_STAKEHOLDER = 'key_stakeholder',
  THIRD_PARTY_CONTRACTOR = 'third_party_contractor',
  REQUESTER = 'requester',
}

export enum ModuleKey {
  ASSETS = 'assets',
  WORK = 'work',
  CAPACITY = 'capacity',
  PLANNING = 'planning',
  MONITORING = 'monitoring',
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}