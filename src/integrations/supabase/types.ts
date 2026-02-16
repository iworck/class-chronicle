export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academic_matrices: {
        Row: {
          code: string
          course_id: string
          created_at: string
          id: string
          instructions: string | null
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          code: string
          course_id: string
          created_at?: string
          id?: string
          instructions?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          code?: string
          course_id?: string
          created_at?: string
          id?: string
          instructions?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "academic_matrices_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_adjustments: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          changed_by_role: Database["public"]["Enums"]["app_role"]
          changed_by_user_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["attendance_status"]
          id: string
          justification: string
          record_id: string
          to_status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          changed_by_role: Database["public"]["Enums"]["app_role"]
          changed_by_user_id: string
          created_at?: string
          from_status: Database["public"]["Enums"]["attendance_status"]
          id?: string
          justification: string
          record_id: string
          to_status: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          changed_by_role?: Database["public"]["Enums"]["app_role"]
          changed_by_user_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["attendance_status"]
          id?: string
          justification?: string
          record_id?: string
          to_status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_adjustments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string
          final_status: Database["public"]["Enums"]["attendance_status"]
          geo_lat: number | null
          geo_lng: number | null
          geo_ok: boolean | null
          id: string
          ip_address: string | null
          protocol: string
          registered_at: string | null
          selfie_path: string | null
          session_id: string
          signature_path: string | null
          source: Database["public"]["Enums"]["attendance_source"] | null
          student_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          final_status?: Database["public"]["Enums"]["attendance_status"]
          geo_lat?: number | null
          geo_lng?: number | null
          geo_ok?: boolean | null
          id?: string
          ip_address?: string | null
          protocol?: string
          registered_at?: string | null
          selfie_path?: string | null
          session_id: string
          signature_path?: string | null
          source?: Database["public"]["Enums"]["attendance_source"] | null
          student_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          final_status?: Database["public"]["Enums"]["attendance_status"]
          geo_lat?: number | null
          geo_lng?: number | null
          geo_ok?: boolean | null
          id?: string
          ip_address?: string | null
          protocol?: string
          registered_at?: string | null
          selfie_path?: string | null
          session_id?: string
          signature_path?: string | null
          source?: Database["public"]["Enums"]["attendance_source"] | null
          student_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          audit_deadline_at: string | null
          class_id: string
          closed_at: string | null
          created_at: string
          entry_code_hash: string
          geo_lat: number | null
          geo_lng: number | null
          geo_radius_m: number | null
          id: string
          opened_at: string
          professor_user_id: string
          public_token: string
          require_geo: boolean
          status: Database["public"]["Enums"]["session_status"]
          subject_id: string
        }
        Insert: {
          audit_deadline_at?: string | null
          class_id: string
          closed_at?: string | null
          created_at?: string
          entry_code_hash: string
          geo_lat?: number | null
          geo_lng?: number | null
          geo_radius_m?: number | null
          id?: string
          opened_at?: string
          professor_user_id: string
          public_token?: string
          require_geo?: boolean
          status?: Database["public"]["Enums"]["session_status"]
          subject_id: string
        }
        Update: {
          audit_deadline_at?: string | null
          class_id?: string
          closed_at?: string | null
          created_at?: string
          entry_code_hash?: string
          geo_lat?: number | null
          geo_lng?: number | null
          geo_radius_m?: number | null
          id?: string
          opened_at?: string
          professor_user_id?: string
          public_token?: string
          require_geo?: boolean
          status?: Database["public"]["Enums"]["session_status"]
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          city: string | null
          created_at: string
          director_user_id: string | null
          id: string
          institution_id: string
          name: string
          state: string | null
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          city?: string | null
          created_at?: string
          director_user_id?: string | null
          id?: string
          institution_id: string
          name: string
          state?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          city?: string | null
          created_at?: string
          director_user_id?: string | null
          id?: string
          institution_id?: string
          name?: string
          state?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "campuses_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          decision_note: string | null
          id: string
          justification: string
          record_id: string
          requested_by_role: Database["public"]["Enums"]["app_role"]
          requested_by_user_id: string
          requested_to_status: Database["public"]["Enums"]["attendance_status"]
          status: Database["public"]["Enums"]["change_request_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          id?: string
          justification: string
          record_id: string
          requested_by_role: Database["public"]["Enums"]["app_role"]
          requested_by_user_id: string
          requested_to_status: Database["public"]["Enums"]["attendance_status"]
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          id?: string
          justification?: string
          record_id?: string
          requested_by_role?: Database["public"]["Enums"]["app_role"]
          requested_by_user_id?: string
          requested_to_status?: Database["public"]["Enums"]["attendance_status"]
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      class_students: {
        Row: {
          class_id: string
          end_date: string | null
          id: string
          start_date: string
          status: Database["public"]["Enums"]["entity_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          end_date?: string | null
          id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["entity_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          end_date?: string | null
          id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["entity_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          grades_closed: boolean
          id: string
          professor_user_id: string
          status: Database["public"]["Enums"]["entity_status"]
          subject_id: string
        }
        Insert: {
          class_id: string
          grades_closed?: boolean
          id?: string
          professor_user_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          subject_id: string
        }
        Update: {
          class_id?: string
          grades_closed?: boolean
          id?: string
          professor_user_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          code: string
          course_id: string
          created_at: string
          id: string
          period: string
          semester_id: string | null
          shift: string | null
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          code: string
          course_id: string
          created_at?: string
          id?: string
          period: string
          semester_id?: string | null
          shift?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          code?: string
          course_id?: string
          created_at?: string
          id?: string
          period?: string
          semester_id?: string | null
          shift?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          coordinator_user_id: string | null
          created_at: string
          director_user_id: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          unit_id: string | null
        }
        Insert: {
          coordinator_user_id?: string | null
          created_at?: string
          director_user_id?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          unit_id?: string | null
        }
        Update: {
          coordinator_user_id?: string | null
          created_at?: string
          director_user_id?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      email_message_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          institution_id: string | null
          message_type: string
          recipient_email: string
          recipient_name: string | null
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          institution_id?: string | null
          message_type?: string
          recipient_email: string
          recipient_name?: string | null
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          institution_id?: string | null
          message_type?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_message_logs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          id: string
          institution_id: string
          is_active: boolean
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_user: string
          updated_at: string
          use_tls: boolean
        }
        Insert: {
          created_at?: string
          from_email: string
          from_name?: string
          id?: string
          institution_id: string
          is_active?: boolean
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_user: string
          updated_at?: string
          use_tls?: boolean
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          id?: string
          institution_id?: string
          is_active?: boolean
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_user?: string
          updated_at?: string
          use_tls?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_suggestions: {
        Row: {
          class_id: string
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          id: string
          justification: string
          status: Database["public"]["Enums"]["change_request_status"]
          student_enrollment: string
          suggested_by_user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          justification: string
          status?: Database["public"]["Enums"]["change_request_status"]
          student_enrollment: string
          suggested_by_user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          justification?: string
          status?: Database["public"]["Enums"]["change_request_status"]
          student_enrollment?: string
          suggested_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_suggestions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_change_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by_user_id: string
          enrollment_id: string
          grade_type: string
          id: string
          ip_address: string | null
          new_value: number
          old_value: number | null
        }
        Insert: {
          action?: string
          changed_at?: string
          changed_by_user_id: string
          enrollment_id: string
          grade_type: string
          id?: string
          ip_address?: string | null
          new_value: number
          old_value?: number | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by_user_id?: string
          enrollment_id?: string
          grade_type?: string
          id?: string
          ip_address?: string | null
          new_value?: number
          old_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_change_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_subject_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_template_items: {
        Row: {
          category: string
          class_subject_id: string
          counts_in_final: boolean
          created_at: string
          id: string
          name: string
          order_index: number
          parent_item_id: string | null
          weight: number
        }
        Insert: {
          category?: string
          class_subject_id: string
          counts_in_final?: boolean
          created_at?: string
          id?: string
          name: string
          order_index?: number
          parent_item_id?: string | null
          weight?: number
        }
        Update: {
          category?: string
          class_subject_id?: string
          counts_in_final?: boolean
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          parent_item_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_template_items_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_template_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "grade_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: []
      }
      matrix_subjects: {
        Row: {
          created_at: string
          id: string
          matrix_id: string
          semester: number
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          matrix_id: string
          semester?: number
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          matrix_id?: string
          semester?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matrix_subjects_matrix_id_fkey"
            columns: ["matrix_id"]
            isOneToOne: false
            referencedRelation: "academic_matrices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matrix_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          institution_id: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          institution_id?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          institution_id?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          course_id: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          course_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          course_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "semesters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      student_course_requests: {
        Row: {
          created_at: string
          current_course_id: string
          decided_at: string | null
          decided_by_user_id: string | null
          decision_note: string | null
          id: string
          justification: string
          request_type: string
          status: Database["public"]["Enums"]["change_request_status"]
          student_id: string
          target_course_id: string | null
        }
        Insert: {
          created_at?: string
          current_course_id: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          id?: string
          justification: string
          request_type: string
          status?: Database["public"]["Enums"]["change_request_status"]
          student_id: string
          target_course_id?: string | null
        }
        Update: {
          created_at?: string
          current_course_id?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          id?: string
          justification?: string
          request_type?: string
          status?: Database["public"]["Enums"]["change_request_status"]
          student_id?: string
          target_course_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_course_requests_current_course_id_fkey"
            columns: ["current_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_requests_target_course_id_fkey"
            columns: ["target_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      student_details: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          enrollment_status: Database["public"]["Enums"]["enrollment_status"]
          id: string
          phone: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          enrollment_status?: Database["public"]["Enums"]["enrollment_status"]
          id?: string
          phone?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          enrollment_status?: Database["public"]["Enums"]["enrollment_status"]
          id?: string
          phone?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          id: string
          student_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          id?: string
          student_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          id?: string
          student_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_grades: {
        Row: {
          counts_in_final: boolean
          created_at: string
          enrollment_id: string
          grade_category: string
          grade_type: string
          grade_value: number
          id: string
          observations: string | null
          professor_user_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          counts_in_final?: boolean
          created_at?: string
          enrollment_id: string
          grade_category?: string
          grade_type: string
          grade_value: number
          id?: string
          observations?: string | null
          professor_user_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          counts_in_final?: boolean
          created_at?: string
          enrollment_id?: string
          grade_category?: string
          grade_type?: string
          grade_value?: number
          id?: string
          observations?: string | null
          professor_user_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_grades_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_subject_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subject_enrollments: {
        Row: {
          created_at: string
          enrolled_at: string
          id: string
          matrix_id: string
          semester: number
          status: Database["public"]["Enums"]["enrollment_subject_status"]
          student_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrolled_at?: string
          id?: string
          matrix_id: string
          semester?: number
          status?: Database["public"]["Enums"]["enrollment_subject_status"]
          student_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrolled_at?: string
          id?: string
          matrix_id?: string
          semester?: number
          status?: Database["public"]["Enums"]["enrollment_subject_status"]
          student_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subject_enrollments_matrix_id_fkey"
            columns: ["matrix_id"]
            isOneToOne: false
            referencedRelation: "academic_matrices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          course_id: string | null
          created_at: string
          enrollment: string
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          enrollment: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          course_id?: string | null
          created_at?: string
          enrollment?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          course_id: string | null
          created_at: string
          id: string
          lesson_plan: string | null
          min_attendance_pct: number
          min_grade: number
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          workload_hours: number
        }
        Insert: {
          code: string
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_plan?: string | null
          min_attendance_pct?: number
          min_grade?: number
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          workload_hours?: number
        }
        Update: {
          code?: string
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_plan?: string | null
          min_attendance_pct?: number
          min_grade?: number
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          workload_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          campus_id: string
          created_at: string
          id: string
          manager_user_id: string | null
          name: string
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          campus_id: string
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          campus_id?: string
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "units_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_campuses: {
        Row: {
          campus_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_campuses_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_units: {
        Row: {
          created_at: string
          id: string
          unit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_list_id: string | null
          created_at: string
          error_message: string | null
          id: string
          name: string | null
          phone: string
          sent_at: string | null
          status: string
          variables: Json | null
        }
        Insert: {
          campaign_id: string
          contact_list_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name?: string | null
          phone: string
          sent_at?: string | null
          status?: string
          variables?: Json | null
        }
        Update: {
          campaign_id?: string
          contact_list_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string
          sent_at?: string | null
          status?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_contact_list_id_fkey"
            columns: ["contact_list_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          delivered_count: number | null
          failed_count: number | null
          id: string
          institution_id: string | null
          name: string
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string
          template_id: string
          total_contacts: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          institution_id?: string | null
          name: string
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          template_id: string
          total_contacts?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          institution_id?: string | null
          name?: string
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          template_id?: string
          total_contacts?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contact_list_members: {
        Row: {
          created_at: string
          id: string
          list_id: string
          name: string
          phone: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          name: string
          phone: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          phone?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contact_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contact_lists: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          institution_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          institution_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contact_lists_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_logs: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          institution_id: string | null
          message_content: string
          message_type: string
          recipient_name: string | null
          recipient_phone: string
          sent_by: string | null
          status: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          institution_id?: string | null
          message_content: string
          message_type?: string
          recipient_name?: string | null
          recipient_phone: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          institution_id?: string | null
          message_content?: string
          message_type?: string
          recipient_name?: string | null
          recipient_phone?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          api_token: string
          api_url: string
          created_at: string
          default_connection_id: string | null
          id: string
          institution_id: string
          is_active: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          api_token: string
          api_url: string
          created_at?: string
          default_connection_id?: string | null
          id?: string
          institution_id: string
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Update: {
          api_token?: string
          api_url?: string
          created_at?: string
          default_connection_id?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          institution_id: string | null
          name: string
          status: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          institution_id?: string | null
          name: string
          status?: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          institution_id?: string | null
          name?: string
          status?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_institution_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "diretor"
        | "coordenador"
        | "professor"
        | "super_admin"
        | "gerente"
        | "aluno"
      attendance_source: "AUTO_ALUNO" | "MANUAL_PROF" | "MANUAL_COORD"
      attendance_status: "PRESENTE" | "FALTA" | "JUSTIFICADO"
      change_request_status: "PENDENTE" | "APROVADO" | "REPROVADO"
      enrollment_status:
        | "MATRICULADO"
        | "TRANCADO"
        | "CANCELADO"
        | "TRANSFERIDO"
      enrollment_subject_status:
        | "CURSANDO"
        | "APROVADO"
        | "REPROVADO"
        | "TRANCADO"
      entity_status: "ATIVO" | "INATIVO"
      session_status:
        | "ABERTA"
        | "ENCERRADA"
        | "AUDITORIA_FINALIZADA"
        | "BLOQUEADA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "diretor",
        "coordenador",
        "professor",
        "super_admin",
        "gerente",
        "aluno",
      ],
      attendance_source: ["AUTO_ALUNO", "MANUAL_PROF", "MANUAL_COORD"],
      attendance_status: ["PRESENTE", "FALTA", "JUSTIFICADO"],
      change_request_status: ["PENDENTE", "APROVADO", "REPROVADO"],
      enrollment_status: [
        "MATRICULADO",
        "TRANCADO",
        "CANCELADO",
        "TRANSFERIDO",
      ],
      enrollment_subject_status: [
        "CURSANDO",
        "APROVADO",
        "REPROVADO",
        "TRANCADO",
      ],
      entity_status: ["ATIVO", "INATIVO"],
      session_status: [
        "ABERTA",
        "ENCERRADA",
        "AUDITORIA_FINALIZADA",
        "BLOQUEADA",
      ],
    },
  },
} as const
