import { BaseEntity, UserRole } from '@capacity-planner/shared-kernel';

// Services
export { WorkRequestService } from './services/work-request.service';
export { StandIntegrationService } from './services/stand-integration.service';
export { WorkRequestCacheService } from './services/cache.service';
export { ApprovalWorkflowService } from './services/approval-workflow.service';
export { NotificationService } from './services/notification.service';
export { ValidationEngineService } from './services/validation-engine.service';
export { FileUploadService } from './services/file-upload.service';
export { VirusScannerService } from './services/virus-scanner.service';
export { FileEncryptionService } from './services/file-encryption.service';
export { AuditTrailService } from './services/audit-trail.service';
export { WorkRequestRepositoryService } from './services/work-request-repository.service';
export { ReportingService } from './services/reporting.service';
export { ReportTemplateService } from './services/report-template.service';
export { ScheduledReportService } from './services/scheduled-report.service';
export { ChartDataService } from './services/chart-data.service';
export type {
  SortOptions,
  BulkOperationResult,
  DashboardStats,
  SavedView,
  ExportOptions,
} from './services/work-request-repository.service';
export type {
  ReportPeriod,
  PerformanceMetrics,
  KPIMetric,
  TrendData,
  ForecastData,
  ReportTemplate,
  ReportSection,
  ReportSchedule,
  GeneratedReport,
} from './services/reporting.service';
export type { ReportTemplateDefinition } from './services/report-template.service';
export type {
  ScheduledReport,
  ReportRecipient,
  ReportExecution,
} from './services/scheduled-report.service';
export type {
  ChartDataPoint,
  ChartSeries,
  ChartConfiguration,
  ChartData,
} from './services/chart-data.service';
export type {
  StandSummaryForWorkRequest,
  StandDetailForWorkRequest,
  StandFiltersForWorkRequest,
  StandAvailabilityResponse,
  AvailabilitySlot,
  AvailabilityRecommendation,
} from './services/stand-integration.service';

// Core Work Request Interface
export interface WorkRequest extends BaseEntity {
  organizationId: string;

  // Asset Integration
  assetId: string;
  assetType: AssetType;
  assetSchema: string;
  assetCode: string;
  assetName: string;
  assetLocation?: string;
  assetMetadata: Record<string, any>;

  // Request Classification
  workType: WorkType;
  category: WorkCategory;
  priority: Priority;
  urgency: Urgency;
  impactLevel: ImpactLevel;

  // Request Details
  title: string;
  description: string;
  locationDetails?: string;
  safetyConsiderations?: string;

  // Scheduling
  requestedStartDate: Date;
  requestedEndDate?: Date;
  estimatedDurationMinutes?: number;
  deadline?: Date;
  preferredTimeWindows: TimeWindow[];
  blackoutPeriods: BlackoutPeriod[];
  seasonalConstraints: SeasonalConstraints;

  // Resource Requirements
  estimatedPersonnelCount?: number;
  requiredSkills: string[];
  requiredEquipment: string[];
  estimatedMaterialsCost?: number;

  // Budget and Cost
  budgetCode?: string;
  estimatedTotalCost?: number;
  costCenter?: string;
  purchaseOrderNumber?: string;
  vendorInformation: VendorInformation;

  // Stakeholder Information
  requestedBy: string;
  requestorName: string;
  requestorEmail: string;
  requestorPhone?: string;
  department?: string;
  primaryContactId?: string;
  secondaryContactId?: string;

  // Approval and Workflow
  approvalRequired: boolean;
  approvalLevel: ApprovalLevel;
  currentApproverId?: string;
  approvalDeadline?: Date;

  // Status and Lifecycle
  status: WorkRequestStatus;
  statusReason?: string;
  submissionDate?: Date;
  reviewStartedDate?: Date;
  approvedDate?: Date;
  completedDate?: Date;

  // Regulatory and Compliance
  regulatoryApprovalRequired: boolean;
  regulatoryReference?: string;
  complianceNotes?: string;

  // Attachments and Documentation
  attachments: AttachmentMetadata[];
  relatedDocuments: DocumentReference[];

  // Metadata and Versioning
  version: number;
  isTemplate: boolean;
  templateId?: string;
  metadata: Record<string, any>;

  // Relations
  statusHistory?: WorkRequestStatusHistory[];
  comments?: WorkRequestComment[];
  notifications?: WorkRequestNotification[];
  approvals?: WorkRequestApproval[];
  attachmentFiles?: WorkRequestAttachment[];
  standAssociations?: WorkRequestStandAssociation[];
  assetAssociations?: WorkRequestAssetAssociation[];
}

// Enums
export enum WorkRequestStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum WorkType {
  MAINTENANCE = 'maintenance',
  INSPECTION = 'inspection',
  REPAIR = 'repair',
  MODIFICATION = 'modification',
  EMERGENCY = 'emergency',
}

export enum WorkCategory {
  ROUTINE = 'routine',
  CORRECTIVE = 'corrective',
  PREVENTIVE = 'preventive',
  EMERGENCY = 'emergency',
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum Urgency {
  IMMEDIATE = 'immediate',
  SCHEDULED = 'scheduled',
  ROUTINE = 'routine',
}

export enum ImpactLevel {
  FULL_CLOSURE = 'full_closure',
  PARTIAL_RESTRICTION = 'partial_restriction',
  NO_IMPACT = 'no_impact',
}

export enum AssetType {
  STAND = 'stand',
  AIRFIELD = 'airfield',
  BAGGAGE = 'baggage',
  TERMINAL = 'terminal',
  GATE = 'gate',
  RUNWAY = 'runway',
  TAXIWAY = 'taxiway',
}

export enum ApprovalLevel {
  STANDARD = 'standard',
  ELEVATED = 'elevated',
  EXECUTIVE = 'executive',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELEGATED = 'delegated',
}

export enum CommentType {
  GENERAL = 'general',
  APPROVAL = 'approval',
  TECHNICAL = 'technical',
  INTERNAL = 'internal',
}

export enum NotificationType {
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMMENT_ADDED = 'comment_added',
  STATUS_CHANGED = 'status_changed',
  APPROVAL_REQUEST = 'approval_request',
  APPROVAL_TIMEOUT = 'approval_timeout',
  DEADLINE_REMINDER = 'deadline_reminder',
  OVERDUE_ALERT = 'overdue_alert',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export enum VirusScanStatus {
  PENDING = 'pending',
  CLEAN = 'clean',
  INFECTED = 'infected',
  ERROR = 'error',
}

export enum AssociationType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  AFFECTED = 'affected',
}

export enum NotificationPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// Supporting Interfaces
export interface TimeWindow {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  days: string[]; // Array of day names
  timezone: string;
}

export interface BlackoutPeriod {
  startDate: Date;
  endDate: Date;
  reason: string;
  isRecurring: boolean;
  recurrencePattern?: string;
}

export interface SeasonalConstraints {
  weatherRestrictions: string[];
  temperatureRange?: {
    min: number;
    max: number;
  };
  windSpeedLimit?: number;
  precipitationRestrictions: string[];
}

export interface VendorInformation {
  preferredVendors: string[];
  requiredVendors: string[];
  contactInfo: Record<string, any>;
  contractReferences: string[];
}

export interface AttachmentMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: string;
  description?: string;
}

export interface DocumentReference {
  id: string;
  title: string;
  type: string;
  url: string;
  version?: string;
}

// Related Entity Interfaces
export interface WorkRequestStatusHistory extends BaseEntity {
  workRequestId: string;
  fromStatus?: WorkRequestStatus;
  toStatus: WorkRequestStatus;
  reason?: string;
  comments?: string;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  metadata: Record<string, any>;
}

export interface WorkRequestComment extends BaseEntity {
  workRequestId: string;
  parentCommentId?: string;
  commentText: string;
  commentType: CommentType;
  isInternal: boolean;
  isSystemGenerated: boolean;
  mentionedUsers: string[];
  attachments: string[];
  commentedBy: string;
  commenterName: string;
  commentedAt: Date;
  editedAt?: Date;
  editedBy?: string;
}

export interface WorkRequestNotification extends BaseEntity {
  workRequestId: string;
  recipientId: string;
  recipientEmail: string;
  notificationType: NotificationType;
  subject: string;
  body: string;
  priority: Priority;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  retryCount: number;
  errorMessage?: string;
  channel: NotificationChannel;
  templateId?: string;
  variables: Record<string, any>;
}

export interface WorkRequestApproval extends BaseEntity {
  workRequestId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  approvalLevel: ApprovalLevel;
  sequenceOrder: number;
  status: ApprovalStatus;
  decisionDate?: Date;
  comments?: string;
  conditions?: string;
  delegatedTo?: string;
  isRequired: boolean;
  timeoutDate?: Date;
}

export interface WorkRequestAttachment extends BaseEntity {
  workRequestId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  fileHash: string;
  isSecure: boolean;
  encryptionKeyId?: string;
  virusScanStatus: VirusScanStatus;
  virusScanDate?: Date;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface WorkRequestStandAssociation extends BaseEntity {
  workRequestId: string;
  standId: string;
  standCode: string;
  associationType: AssociationType;
  impactLevel: ImpactLevel;
  specificAreas: string[];
  constraints: Record<string, any>;
  createdBy: string;
}

export interface WorkRequestAssetAssociation extends BaseEntity {
  workRequestId: string;
  assetId: string;
  assetType: AssetType;
  assetSchema: string;
  assetCode: string;
  assetName: string;
  associationType: AssociationType;
  impactLevel: ImpactLevel;
  specificAreas: string[];
  constraints: Record<string, any>;
  createdBy: string;
}

export interface WorkRequestTemplate extends BaseEntity {
  organizationId: string;
  name: string;
  description?: string;
  category: string;
  workType: WorkType;
  templateData: Record<string, any>;
  defaultValues: Record<string, any>;
  requiredFields: string[];
  conditionalLogic: Record<string, any>;
  isActive: boolean;
  isPublic: boolean;
  usageCount: number;
  createdBy: string;
  allowedRoles: string[];
  updatedBy: string;
}

export interface AssetTypeConfiguration extends BaseEntity {
  organizationId: string;
  assetType: AssetType;
  assetSchema: string;
  assetTable: string;
  displayName: string;
  description?: string;
  formConfig: Record<string, any>;
  validationRules: Record<string, any>;
  workflowConfig: Record<string, any>;
  apiEndpoints: Record<string, any>;
  permissions: string[];
  isActive: boolean;
  sortOrder: number;
  metadata: Record<string, any>;
  createdBy: string;
  updatedBy: string;
}

// Request/Response Types for API
export interface CreateWorkRequestRequest {
  assetId: string;
  assetType?: AssetType;
  workType: WorkType;
  category: WorkCategory;
  priority: Priority;
  urgency: Urgency;
  impactLevel: ImpactLevel;
  title: string;
  description: string;
  locationDetails?: string;
  safetyConsiderations?: string;
  requestedStartDate: Date;
  requestedEndDate?: Date;
  estimatedDurationMinutes?: number;
  deadline?: Date;
  preferredTimeWindows?: TimeWindow[];
  blackoutPeriods?: BlackoutPeriod[];
  seasonalConstraints?: SeasonalConstraints;
  estimatedPersonnelCount?: number;
  requiredSkills?: string[];
  requiredEquipment?: string[];
  estimatedMaterialsCost?: number;
  budgetCode?: string;
  estimatedTotalCost?: number;
  costCenter?: string;
  purchaseOrderNumber?: string;
  vendorInformation?: VendorInformation;
  primaryContactId?: string;
  secondaryContactId?: string;
  regulatoryApprovalRequired?: boolean;
  regulatoryReference?: string;
  complianceNotes?: string;
  templateId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateWorkRequestRequest extends Partial<CreateWorkRequestRequest> {
  version: number;
  statusReason?: string;
}

export interface WorkRequestFilters {
  status?: WorkRequestStatus[];
  priority?: Priority[];
  urgency?: Urgency[];
  workType?: WorkType[];
  assetType?: AssetType[];
  assetId?: string;
  assetCode?: string;
  assetSearch?: string;
  requestedBy?: string;
  currentApprover?: string;
  department?: string;
  submissionDateStart?: Date;
  submissionDateEnd?: Date;
  requestedStartDateStart?: Date;
  requestedStartDateEnd?: Date;
  deadlineStart?: Date;
  deadlineEnd?: Date;
  budgetCode?: string;
  costCenter?: string;
  minCost?: number;
  maxCost?: number;
  search?: string;
  includeStats?: boolean;
}

export interface WorkRequestSummary {
  id: string;
  title: string;
  status: WorkRequestStatus;
  priority: Priority;
  urgency: Urgency;
  workType: WorkType;
  assetType: AssetType;
  assetCode: string;
  assetName: string;
  assetLocation?: string;
  requestedStartDate: Date;
  estimatedTotalCost?: number;
  requestorName: string;
  department?: string;
  submissionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GetWorkRequestsResponse {
  success: boolean;
  data: {
    requests: WorkRequestSummary[];
    pagination: PaginationInfo;
    summary?: {
      totalRequests: number;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      byAssetType: Record<string, number>;
      totalEstimatedCost: number;
    };
  };
}

// Validation Types
export interface ValidationResult {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

export interface ValidationResponse {
  isValid: boolean;
  validationResults: ValidationResult[];
  warnings: ValidationResult[];
  suggestions: ValidationResult[];
  context?: any;
}

// Approval Workflow Types
export interface ApprovalEntry {
  id: string;
  workRequestId: string;
  workRequestTitle: string;
  workRequestPriority: string;
  workRequestType: string;
  assetCode: string;
  requestorName: string;
  submissionDate?: Date;
  estimatedCost?: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  approvalLevel: ApprovalLevel;
  sequenceOrder: number;
  status: ApprovalStatus;
  isRequired: boolean;
  timeoutDate?: Date;
  createdAt: Date;
}

export interface ApprovalChainEntry {
  id: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  approvalLevel: ApprovalLevel;
  sequenceOrder: number;
  status: ApprovalStatus;
  decisionDate?: Date;
  comments?: string;
  conditions?: string;
  delegatedTo?: string;
  isRequired: boolean;
  timeoutDate?: Date;
}

export interface ApproverInfo {
  id: string;
  name: string;
  role: string;
  email: string;
  department: string;
}

// Legacy support - will be deprecated
export interface ApprovalAction {
  id: string;
  action: 'approve' | 'reject' | 'request_info';
  approver: string;
  timestamp: Date;
  comments?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}
