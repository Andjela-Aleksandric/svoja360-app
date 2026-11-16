// Row shapes used by the UI. Generated database types can replace these later
// (`supabase gen types typescript`), the names match the tables.

export type ClientStatus = "active" | "inactive" | "archived";
export type PlanStatus = "draft" | "active" | "completed" | "archived";
export type SubmissionStatus = "draft" | "submitted" | "reviewed";

export interface ClientRow {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  phone_e164: string | null;
  birth_date: string | null;
  height_cm: number | null;
  start_date: string;
  status: ClientStatus;
  goal: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface MeasurementRow {
  id: string;
  client_id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  thigh_cm: number | null;
  arm_cm: number | null;
  body_fat_pct: number | null;
  source: "manual" | "checkin" | "initial";
  notes: string | null;
}

export interface SubmissionRow {
  id: string;
  client_id: string;
  kind: "initial" | "checkin";
  status: SubmissionStatus;
  period_start: string | null;
  period_end: string | null;
  current_step: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  client_id: string;
  submission_id: string | null;
  body: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramSummary {
  id: string;
  client_id: string | null;
  name: string;
  status: PlanStatus;
  start_date: string | null;
}
