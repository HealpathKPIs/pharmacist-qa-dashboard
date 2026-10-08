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
      profiles: {
        Row: {
          accessible_modules: ("clinical" | "non_medical" | "doctors")[];
          active: boolean;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          last_login: string | null;
          role: "admin" | "manager";
          updated_at: string;
        };
        Insert: {
          accessible_modules?: ("clinical" | "non_medical" | "doctors")[];
          active?: boolean;
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          last_login?: string | null;
          role: "admin" | "manager";
          updated_at?: string;
        };
        Update: {
          accessible_modules?: ("clinical" | "non_medical" | "doctors")[];
          active?: boolean;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          last_login?: string | null;
          role?: "admin" | "manager";
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_patients: {
        Row: {
          audit_type: "clinical" | "non_medical" | "doctors";
          id: number;
          day: string;
          patient_count: number;
          source_file: string | null;
          uploaded_at: string | null;
        };
        Insert: {
          audit_type: "clinical" | "non_medical" | "doctors";
          id?: never;
          day: string;
          patient_count: number;
          source_file?: string | null;
          uploaded_at?: string | null;
        };
        Update: {
          audit_type?: "clinical" | "non_medical" | "doctors";
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
          audit_type: "clinical" | "non_medical" | "doctors";
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
          audit_type: "clinical" | "non_medical" | "doctors";
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
          audit_type?: "clinical" | "non_medical" | "doctors";
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
          audit_type: "clinical" | "non_medical" | "doctors";
          id: number;
          file_name: string;
          source_file: string;
          inserted_daily_patients: number;
          inserted_qa_errors: number;
          inserted_workload_rows: number;
          rows_patients_inserted: number | null;
          rows_errors_inserted: number | null;
          skipped_rows: number;
          failed_rows: number;
          upload_kind: "qa_audit" | "reconciliation_workload" | "calls_workload" | "processing_time";
          uploaded_at: string | null;
          status: string | null;
        };
        Insert: {
          audit_type: "clinical" | "non_medical" | "doctors";
          id?: never;
          file_name: string;
          source_file: string;
          inserted_daily_patients?: number;
          inserted_qa_errors?: number;
          inserted_workload_rows?: number;
          rows_patients_inserted?: number | null;
          rows_errors_inserted?: number | null;
          skipped_rows?: number;
          failed_rows?: number;
          upload_kind?: "qa_audit" | "reconciliation_workload" | "calls_workload" | "processing_time";
          uploaded_at?: string | null;
          status?: string | null;
        };
        Update: {
          audit_type?: "clinical" | "non_medical" | "doctors";
          id?: never;
          file_name?: string;
          source_file?: string;
          inserted_daily_patients?: number;
          inserted_qa_errors?: number;
          inserted_workload_rows?: number;
          rows_patients_inserted?: number | null;
          rows_errors_inserted?: number | null;
          skipped_rows?: number;
          failed_rows?: number;
          upload_kind?: "qa_audit" | "reconciliation_workload" | "calls_workload" | "processing_time";
          uploaded_at?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      clinical_pharmacists: {
        Row: {
          active: boolean;
          created_at: string;
          display_name: string;
          id: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_name: string;
          id?: never;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_name?: string;
          id?: never;
          updated_at?: string;
        };
        Relationships: [];
      };
      clinical_pharmacist_aliases: {
        Row: {
          alias: string;
          alias_key: string;
          created_at: string;
          id: number;
          pharmacist_id: number;
        };
        Insert: {
          alias: string;
          alias_key?: never;
          created_at?: string;
          id?: never;
          pharmacist_id: number;
        };
        Update: {
          alias?: string;
          alias_key?: never;
          created_at?: string;
          id?: never;
          pharmacist_id?: number;
        };
        Relationships: [];
      };
      pharmacist_workload: {
        Row: {
          day: string;
          id: number;
          item_count: number;
          pharmacist_id: number;
          pharmacist_name_raw: string;
          source_file: string | null;
          task_label: string;
          upload_batch_id: number | null;
          uploaded_at: string;
          workload_type: "medication_reconciliation" | "clinical_calls";
        };
        Insert: {
          day: string;
          id?: never;
          item_count: number;
          pharmacist_id: number;
          pharmacist_name_raw: string;
          source_file?: string | null;
          task_label?: string;
          upload_batch_id?: number | null;
          uploaded_at?: string;
          workload_type?: "medication_reconciliation" | "clinical_calls";
        };
        Update: {
          day?: string;
          id?: never;
          item_count?: number;
          pharmacist_id?: number;
          pharmacist_name_raw?: string;
          source_file?: string | null;
          task_label?: string;
          upload_batch_id?: number | null;
          uploaded_at?: string;
          workload_type?: "medication_reconciliation" | "clinical_calls";
        };
        Relationships: [];
      };
      clinical_processing_tasks: {
        Row: {
          actual_minutes: number;
          day: string;
          id: number;
          items_completed: number;
          pharmacist_id: number;
          pharmacist_name_raw: string;
          sla_minutes: number;
          sla_per_item: number;
          source_file: string | null;
          source_row: number | null;
          task_reference: string;
          task_type: string;
          upload_batch_id: number | null;
          uploaded_at: string;
        };
        Insert: {
          actual_minutes: number;
          day: string;
          id?: never;
          items_completed: number;
          pharmacist_id: number;
          pharmacist_name_raw: string;
          sla_minutes: number;
          sla_per_item: number;
          source_file?: string | null;
          source_row?: number | null;
          task_reference?: string;
          task_type: string;
          upload_batch_id?: number | null;
          uploaded_at?: string;
        };
        Update: {
          actual_minutes?: number;
          day?: string;
          id?: never;
          items_completed?: number;
          pharmacist_id?: number;
          pharmacist_name_raw?: string;
          sla_minutes?: number;
          sla_per_item?: number;
          source_file?: string | null;
          source_row?: number | null;
          task_reference?: string;
          task_type?: string;
          upload_batch_id?: number | null;
          uploaded_at?: string;
        };
        Relationships: [];
      };
      non_medical_agents: {
        Row: {
          active: boolean;
          created_at: string;
          display_name: string;
          id: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_name: string;
          id?: never;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_name?: string;
          id?: never;
          updated_at?: string;
        };
        Relationships: [];
      };
      non_medical_agent_aliases: {
        Row: {
          agent_id: number;
          alias: string;
          alias_key: string;
          created_at: string;
          id: number;
        };
        Insert: {
          agent_id: number;
          alias: string;
          alias_key?: never;
          created_at?: string;
          id?: never;
        };
        Update: {
          agent_id?: number;
          alias?: string;
          alias_key?: never;
          created_at?: string;
          id?: never;
        };
        Relationships: [];
      };
    };
    Views: {
      clinical_qa_errors_resolved: {
        Row: {
          audit_type: "clinical" | "non_medical" | "doctors";
          day: string;
          id: number;
          issue_details: string | null;
          issue_type: string;
          patient_id: string;
          pharmacist_active: boolean;
          pharmacist_id: number;
          pharmacist_name: string;
          pharmacist_name_raw: string | null;
          score: number;
          source_file: string | null;
          stored_pharmacist_name: string;
          uploaded_at: string | null;
        };
        Relationships: [];
      };
      clinical_workload_resolved: {
        Row: {
          day: string;
          id: number;
          item_count: number;
          pharmacist_active: boolean;
          pharmacist_id: number;
          pharmacist_name: string;
          pharmacist_name_raw: string;
          source_file: string | null;
          task_label: string;
          upload_batch_id: number | null;
          uploaded_at: string;
          workload_type: "medication_reconciliation" | "clinical_calls";
        };
        Relationships: [];
      };
      clinical_processing_tasks_resolved: {
        Row: {
          actual_minutes: number;
          day: string;
          id: number;
          items_completed: number;
          pharmacist_active: boolean;
          pharmacist_id: number;
          pharmacist_name: string;
          pharmacist_name_raw: string;
          sla_minutes: number;
          sla_per_item: number;
          source_file: string | null;
          source_row: number | null;
          task_reference: string;
          task_type: string;
          upload_batch_id: number | null;
          uploaded_at: string;
        };
        Relationships: [];
      };
      clinical_unmatched_names: {
        Row: {
          first_day: string;
          last_day: string;
          pharmacist_name: string;
          records: number;
        };
        Relationships: [];
      };
      clinical_alias_usage: {
        Row: {
          alias: string;
          alias_id: number;
          alias_key: string;
          created_at: string;
          pharmacist_id: number;
          qa_error_records: number;
        };
        Relationships: [];
      };
      // Same columns as clinical_qa_errors_resolved; pharmacist_* is the agent.
      non_medical_qa_errors_resolved: {
        Row: {
          audit_type: "clinical" | "non_medical" | "doctors";
          day: string;
          id: number;
          issue_details: string | null;
          issue_type: string;
          patient_id: string;
          pharmacist_active: boolean;
          pharmacist_id: number;
          pharmacist_name: string;
          pharmacist_name_raw: string | null;
          score: number;
          source_file: string | null;
          stored_pharmacist_name: string;
          uploaded_at: string | null;
        };
        Relationships: [];
      };
      non_medical_unmatched_names: {
        Row: {
          first_day: string;
          last_day: string;
          pharmacist_name: string;
          records: number;
        };
        Relationships: [];
      };
      non_medical_alias_usage: {
        Row: {
          agent_id: number;
          alias: string;
          alias_id: number;
          alias_key: string;
          created_at: string;
          first_day: string | null;
          last_day: string | null;
          qa_error_records: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      qa_replace_processing_month: {
        Args: {
          p_batch_id: number;
          p_month: string;
          p_rows: Json;
        };
        Returns: Array<{ deleted_rows: number; inserted_rows: number }>;
      };
      qa_non_medical_merge_agents: {
        Args: {
          keep_agent_id: number;
          merge_agent_id: number;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
