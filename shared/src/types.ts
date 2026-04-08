'use strict';

// ===== Enum types =====

export type FormType =
  | 'contact'
  | 'job-application'
  | 'complaint'
  | 'event-registration'
  | 'product-inquiry'
  | 'warranty-claim'
  | 'newsletter'
  | 'feedback'
  | 'partnership'
  | 'incident-report';

export type SubmissionStatus = 'pending' | 'dispatching' | 'complete' | 'failed';

export type UserRole = 'admin' | 'operator' | 'viewer';

export type WebhookEvent = 'submission.created' | 'submission.completed' | 'submission.failed';

// ===== Database models =====

export interface Submission {
  id: string;
  form_type: FormType;
  data: string; // JSON string
  status: SubmissionStatus;
  submitted_at: number; // epoch ms
  dispatched_at: number | null;
  completed_at: number | null;
  retry_count: number;
  last_error: string | null;
  idempotency_key: string | null;
}

export interface SubmissionFile {
  id: string;
  submission_id: string;
  field_name: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  uploaded_at: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: UserRole;
  is_active: number;
  created_at: number;
  last_login_at: number | null;
  created_by: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  ip: string | null;
  user_agent: string | null;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string; // JSON array string
  form_types: string | null; // JSON array string or null = all
  is_active: number;
  created_at: number;
  created_by: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  submission_id: string;
  status: 'pending' | 'success' | 'failed';
  response_code: number | null;
  response_body: string | null;
  attempt_count: number;
  delivered_at: number | null;
  created_at: number;
}

// ===== Queue message types =====

export interface FileMetadata {
  id: string;
  field_name: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
}

export interface IntakeMessage {
  submission_id: string;
  form_type: FormType;
  data: Record<string, string | string[]>;
  files: FileMetadata[];
  idempotency_key: string;
  submitted_at: number;
}

export interface DispatchMessage {
  submission_id: string;
}

export interface WebhookMessage {
  webhook_id: string;
  event_type: WebhookEvent;
  submission_id: string;
  delivery_id: string;
  attempt: number;
}

// ===== Form field config =====

export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'number' | 'file';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  min?: number;
  max?: number;
  rows?: number;
  placeholder?: string;
}

// ===== Queue config per form type =====

export interface QueueStageConfig {
  maxBatchSize: number;
  maxBatchTimeout: number; // seconds
  maxConcurrency: number;
  maxRetries: number;
}

export interface FormQueueConfig {
  intakeBinding: string;   // env binding name เช่น INTAKE_CONTACT
  dispatchBinding: string; // env binding name เช่น DISPATCH_CONTACT
  intakeConfig: QueueStageConfig;
  dispatchConfig: QueueStageConfig;
}

export interface FormConfig {
  type: FormType;
  title: string;
  description: string;
  fields: FieldConfig[];
  hasFileUpload: boolean;
  queue: FormQueueConfig;
}
