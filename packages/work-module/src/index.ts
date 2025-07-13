import { BaseEntity, UserRole } from '@capacity-planner/shared-kernel';

export interface WorkRequest extends BaseEntity {
  organizationId: string;
  assetId: string; // ID of the stand or other asset
  assetType: 'stand' | 'gate' | 'airfield'; // Will expand later
  requestedBy: string; // User ID
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: WorkRequestStatus;
  impact?: string;
  attachments?: Attachment[];
  approvalHistory?: ApprovalAction[];
}

export enum WorkRequestStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_REVIEW = 'in_review',
  INFO_REQUIRED = 'info_required',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface ApprovalAction {
  id: string;
  userId: string;
  action: 'approve' | 'reject' | 'request_info';
  comments?: string;
  timestamp: Date;
}

export interface WorkSchedulingService {
  // Request operations
  createRequest(request: Omit<WorkRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkRequest>;
  updateRequest(id: string, updates: Partial<WorkRequest>): Promise<WorkRequest>;
  deleteRequest(id: string): Promise<void>;
  getRequest(id: string): Promise<WorkRequest | null>;
  listRequests(organizationId: string, filters?: RequestFilters): Promise<WorkRequest[]>;
  
  // Approval operations
  approveRequest(requestId: string, userId: string, comments?: string): Promise<WorkRequest>;
  rejectRequest(requestId: string, userId: string, comments?: string): Promise<WorkRequest>;
  requestMoreInfo(requestId: string, userId: string, comments: string): Promise<WorkRequest>;
  
  // Calendar operations
  getCalendarView(organizationId: string, startDate: Date, endDate: Date): Promise<CalendarEntry[]>;
}

export interface RequestFilters {
  status?: WorkRequestStatus | WorkRequestStatus[];
  assetId?: string;
  requestedBy?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CalendarEntry {
  date: Date;
  requests: WorkRequest[];
}