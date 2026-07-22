export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_patients: {
        Row: {
          audit_type: "clinical" | "non_medical";
          id: number;
          day: string;
          patient_count: number;
          source_file: string | null;
          uploaded_at: string | null;
        };
        Insert: {
          audit_type: "clinical" | "non_medical";
          id?: never;
          day: string;
          patient_count: number;
          source_file?: string | null;
          uploaded_at?: string | null;
        };
        Update: {
          audit_type?: "clinical" | "non_medical";
          id?: never;
          day?: string;
          patient_count?: number;
          source_file?: string | null;
          uploaded_at?: string | null;
        };
        Relationships: [];
      };
      qa_errors: {
        Row: {
          audit_type: "clinical" | "non_medical";
          id: number;
          pharmacist_name: string;
          pharmacist_name_raw: string | null;
          day: string;
          patient_id: string;
          issue_type: string;
          score: number;
          issue_details: string | null;
          source_file: string | null;
          uploaded_at: string | null;
        };
        Insert: {
          audit_type: "clinical" | "non_medical";
          id?: never;
          pharmacist_name: string;
          pharmacist_name_raw?: string | null;
          day: string;
          patient_id: string;
          issue_type: string;
          score: number;
          issue_details?: string | null;
          source_file?: string | null;
          uploaded_at?: string | null;
        };
        Update: {
          audit_type?: "clinical" | "non_medical";
          id?: never;
          pharmacist_name?: string;
          pharmacist_name_raw?: string | null;
          day?: string;
          patient_id?: string;
          issue_type?: string;
          score?: number;
          issue_details?: string | null;
          source_file?: string | null;
          uploaded_at?: string | null;
        };
        Relationships: [];
      };
      upload_batches: {
        Row: {
          audit_type: "clinical" | "non_medical";
          id: number;
          file_name: string;
          source_file: string;
          inserted_daily_patients: number;
          inserted_qa_errors: number;
          rows_patients_inserted: number | null;
          rows_errors_inserted: number | null;
          skipped_rows: number;
          failed_rows: number;
          uploaded_at: string | null;
          status: string | null;
        };
        Insert: {
          audit_type: "clinical" | "non_medical";
          id?: never;
          file_name: string;
          source_file: string;
          inserted_daily_patients?: number;
          inserted_qa_errors?: number;
          rows_patients_inserted?: number | null;
          rows_errors_inserted?: number | null;
          skipped_rows?: number;
          failed_rows?: number;
          uploaded_at?: string | null;
          status?: string | null;
        };
        Update: {
          audit_type?: "clinical" | "non_medical";
          id?: never;
          file_name?: string;
          source_file?: string;
          inserted_daily_patients?: number;
          inserted_qa_errors?: number;
          rows_patients_inserted?: number | null;
          rows_errors_inserted?: number | null;
          skipped_rows?: number;
          failed_rows?: number;
          uploaded_at?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
