export type SchoolRole = 'admin' | 'teacher' | 'student' | 'parent';
export type MembershipStatus = 'active' | 'invited' | 'suspended';

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      school_memberships: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          role: SchoolRole;
          status: MembershipStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          role: SchoolRole;
          status?: MembershipStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string;
          role?: SchoolRole;
          status?: MembershipStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'school_memberships_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };

      people: {
        Row: {
          id: string;
          school_id: string;
          user_id: string | null;
          first_name: string;
          middle_name: string | null;
          last_name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          date_of_birth: string | null;
          gender: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id?: string | null;
          first_name: string;
          middle_name?: string | null;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string | null;
          first_name?: string;
          middle_name?: string | null;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      students: {
        Row: {
          id: string;
          school_id: string;
          person_id: string;
          admission_number: string;
          admission_date: string | null;
          status: string;
          created_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          person_id: string;
          admission_number: string;
          admission_date?: string | null;
          status?: string;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          person_id?: string;
          admission_number?: string;
          admission_date?: string | null;
          status?: string;
          created_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };

      staff: {
        Row: {
          id: string;
          school_id: string;
          person_id: string;
          staff_number: string | null;
          job_title: string | null;
          department: string | null;
          status: string;
          created_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          person_id: string;
          staff_number?: string | null;
          job_title?: string | null;
          department?: string | null;
          status?: string;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          person_id?: string;
          staff_number?: string | null;
          job_title?: string | null;
          department?: string | null;
          status?: string;
          created_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };

      announcements: {
        Row: { id: string; school_id: string; title: string; content: string; announcement_type: string; is_published: boolean; published_at: string | null; expires_at: string | null; created_at: string };
        Insert: { id?: string; school_id: string; title: string; content: string; announcement_type?: string; is_published?: boolean; published_at?: string | null; expires_at?: string | null; created_at?: string };
        Update: { id?: string; school_id?: string; title?: string; content?: string; announcement_type?: string; is_published?: boolean; published_at?: string | null; expires_at?: string | null; created_at?: string };
        Relationships: [];
      };

      school_classes: {
        Row: { id: string; school_id: string; name: string; level: string | null; created_at: string };
        Insert: { id?: string; school_id: string; name: string; level?: string | null; created_at?: string };
        Update: { id?: string; school_id?: string; name?: string; level?: string | null; created_at?: string };
        Relationships: [];
      };

      school_subjects: {
        Row: { id: string; school_id: string; class_id: string; name: string; created_at: string };
        Insert: { id?: string; school_id: string; class_id: string; name: string; created_at?: string };
        Update: { id?: string; school_id?: string; class_id?: string; name?: string; created_at?: string };
        Relationships: [];
      };

      academic_sessions: {
        Row: { id: string; school_id: string; name: string; start_date: string; end_date: string; is_current: boolean; created_at: string };
        Insert: { id?: string; school_id: string; name: string; start_date: string; end_date: string; is_current?: boolean; created_at?: string };
        Update: { id?: string; school_id?: string; name?: string; start_date?: string; end_date?: string; is_current?: boolean; created_at?: string };
        Relationships: [];
      };

      academic_terms: {
        Row: { id: string; school_id: string; academic_session_id: string; name: string; term_number: number; start_date: string | null; end_date: string | null; is_current: boolean; created_at: string };
        Insert: { id?: string; school_id: string; academic_session_id: string; name: string; term_number: number; start_date?: string | null; end_date?: string | null; is_current?: boolean; created_at?: string };
        Update: { id?: string; school_id?: string; academic_session_id?: string; name?: string; term_number?: number; start_date?: string | null; end_date?: string | null; is_current?: boolean; created_at?: string };
        Relationships: [];
      };

      student_enrollments: {
        Row: { id: string; school_id: string; student_id: string; academic_session_id: string; class_id: string; enrollment_date: string; status: string; created_at: string };
        Insert: { id?: string; school_id: string; student_id: string; academic_session_id: string; class_id: string; enrollment_date: string; status?: string; created_at?: string };
        Update: { id?: string; school_id?: string; student_id?: string; academic_session_id?: string; class_id?: string; enrollment_date?: string; status?: string; created_at?: string };
        Relationships: [];
      };

      student_attendance: {
        Row: { id: string; school_id: string; student_id: string; academic_session_id: string; class_id: string; attendance_date: string; status: string; remarks: string | null; created_at: string; biometric_event_id: string | null; check_in_at: string | null; check_out_at: string | null; check_in_event_id: string | null; check_out_event_id: string | null };
        Insert: { id?: string; school_id: string; student_id: string; academic_session_id: string; class_id: string; attendance_date: string; status: string; remarks?: string | null; created_at?: string; biometric_event_id?: string | null; check_in_at?: string | null; check_out_at?: string | null; check_in_event_id?: string | null; check_out_event_id?: string | null };
        Update: { id?: string; school_id?: string; student_id?: string; academic_session_id?: string; class_id?: string; attendance_date?: string; status?: string; remarks?: string | null; created_at?: string; biometric_event_id?: string | null; check_in_at?: string | null; check_out_at?: string | null; check_in_event_id?: string | null; check_out_event_id?: string | null };
        Relationships: [];
      };

      online_exams: {
        Row: { id: string; school_id: string; academic_session_id: string; class_id: string; subject_id: string; title: string; instructions: string | null; duration_minutes: number | null; total_marks: number; start_at: string | null; end_at: string | null; status: string; created_by: string | null; created_at: string };
        Insert: { id?: string; school_id: string; academic_session_id: string; class_id: string; subject_id: string; title: string; instructions?: string | null; duration_minutes?: number | null; total_marks?: number; start_at?: string | null; end_at?: string | null; status?: string; created_by?: string | null; created_at?: string };
        Update: { id?: string; school_id?: string; academic_session_id?: string; class_id?: string; subject_id?: string; title?: string; instructions?: string | null; duration_minutes?: number | null; total_marks?: number; start_at?: string | null; end_at?: string | null; status?: string; created_by?: string | null; created_at?: string };
        Relationships: [];
      };

      online_exam_questions: {
        Row: { id: string; school_id: string; exam_id: string; question_text: string; question_type: string; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null; correct_answer: string | null; marks: number; sort_order: number; created_at: string };
        Insert: { id?: string; school_id: string; exam_id: string; question_text: string; question_type?: string; option_a?: string | null; option_b?: string | null; option_c?: string | null; option_d?: string | null; correct_answer?: string | null; marks?: number; sort_order?: number; created_at?: string };
        Update: { id?: string; school_id?: string; exam_id?: string; question_text?: string; question_type?: string; option_a?: string | null; option_b?: string | null; option_c?: string | null; option_d?: string | null; correct_answer?: string | null; marks?: number; sort_order?: number; created_at?: string };
        Relationships: [];
      };

      school_settings: {
        Row: { id: string; school_id: string; motto: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; logo_url: string | null; current_academic_session_id: string | null; current_term_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; school_id: string; motto?: string | null; address?: string | null; phone?: string | null; email?: string | null; website?: string | null; logo_url?: string | null; current_academic_session_id?: string | null; current_term_id?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; school_id?: string; motto?: string | null; address?: string | null; phone?: string | null; email?: string | null; website?: string | null; logo_url?: string | null; current_academic_session_id?: string | null; current_term_id?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };

      nexus_module_controls: {
        Row: {
          id: string;
          module_key: string;
          display_name: string;
          is_enabled: boolean;
          settings: Record<string, unknown>;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_key: string;
          display_name: string;
          is_enabled?: boolean;
          settings?: Record<string, unknown>;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          module_key?: string;
          display_name?: string;
          is_enabled?: boolean;
          settings?: Record<string, unknown>;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      nexus_audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          details: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          details?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          details?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      parents_guardians: {
        Row: { id: string; school_id: string; person_id: string; relationship: string | null; created_at: string; occupation: string | null; portal_enabled: boolean };
        Insert: { id?: string; school_id: string; person_id: string; relationship?: string | null; created_at?: string; occupation?: string | null; portal_enabled?: boolean };
        Update: { id?: string; school_id?: string; person_id?: string; relationship?: string | null; created_at?: string; occupation?: string | null; portal_enabled?: boolean };
        Relationships: [];
      };
      parent_portal_accounts: {
        Row: { id: string; school_id: string; parent_guardian_id: string; user_id: string; is_active: boolean; created_at: string };
        Insert: { id?: string; school_id: string; parent_guardian_id: string; user_id: string; is_active?: boolean; created_at?: string };
        Update: { id?: string; school_id?: string; parent_guardian_id?: string; user_id?: string; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      cctv_cameras: {
        Row: { id: string; school_id: string; camera_name: string; location: string; notes: string; is_enabled: boolean; created_by: string; created_at: string; updated_at: string };
        Insert: { id?: string; school_id: string; camera_name: string; location: string; notes?: string; is_enabled?: boolean; created_by?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; school_id?: string; camera_name?: string; location?: string; notes?: string; is_enabled?: boolean; created_by?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      cctv_parent_camera_access: {
        Row: { id: string; school_id: string; camera_id: string; parent_guardian_id: string; is_active: boolean; granted_by: string; granted_at: string; revoked_at: string | null };
        Insert: { id?: string; school_id: string; camera_id: string; parent_guardian_id: string; is_active?: boolean; granted_by?: string; granted_at?: string; revoked_at?: string | null };
        Update: { id?: string; school_id?: string; camera_id?: string; parent_guardian_id?: string; is_active?: boolean; granted_by?: string; granted_at?: string; revoked_at?: string | null };
        Relationships: [];
      };
      assignments: {
        Row: { id: string; school_id: string; academic_session_id: string; class_id: string; subject_id: string; staff_id: string | null; title: string; description: string | null; instructions: string | null; due_date: string | null; max_score: number; attachment_url: string | null; status: string; created_at: string };
        Insert: { id?: string; school_id: string; academic_session_id: string; class_id: string; subject_id: string; staff_id?: string | null; title: string; description?: string | null; instructions?: string | null; due_date?: string | null; max_score?: number; attachment_url?: string | null; status?: string; created_at?: string };
        Update: { id?: string; school_id?: string; academic_session_id?: string; class_id?: string; subject_id?: string; staff_id?: string | null; title?: string; description?: string | null; instructions?: string | null; due_date?: string | null; max_score?: number; attachment_url?: string | null; status?: string; created_at?: string };
        Relationships: [];
      };
      assignment_submissions: {
        Row: { id: string; school_id: string; assignment_id: string; student_id: string; submission_text: string | null; attachment_url: string | null; submitted_at: string | null; score: number | null; feedback: string | null; status: string; graded_by: string | null; graded_at: string | null; created_at: string };
        Insert: { id?: string; school_id: string; assignment_id: string; student_id: string; submission_text?: string | null; attachment_url?: string | null; submitted_at?: string | null; score?: number | null; feedback?: string | null; status?: string; graded_by?: string | null; graded_at?: string | null; created_at?: string };
        Update: { id?: string; school_id?: string; assignment_id?: string; student_id?: string; submission_text?: string | null; attachment_url?: string | null; submitted_at?: string | null; score?: number | null; feedback?: string | null; status?: string; graded_by?: string | null; graded_at?: string | null; created_at?: string };
        Relationships: [];
      };
      staff_document_permissions: {
        Row: { id: string; school_id: string; staff_id: string; document_type: string; can_print: boolean; granted_by: string | null; granted_at: string | null; updated_at: string };
        Insert: { id?: string; school_id: string; staff_id: string; document_type: string; can_print?: boolean; granted_by?: string | null; granted_at?: string | null; updated_at?: string };
        Update: { id?: string; school_id?: string; staff_id?: string; document_type?: string; can_print?: boolean; granted_by?: string | null; granted_at?: string | null; updated_at?: string };
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      has_school_role: {
        Args: {
          p_school_id: string;
          p_roles?: SchoolRole[] | null;
        };
        Returns: boolean;
      };

      get_resa_website_content: {
        Args: {
          p_content_type?: string | null;
        };
        Returns: {
          id: string;
          content_type: string;
          title: string;
          slug: string;
          summary: string;
          body: string;
          image_url: string;
          image_alt: string;
          published_at: string;
          sort_order: number;
        }[];
      };

      approve_invited_staff: {
        Args: {
          p_school_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };

      suspend_school_teacher: {
        Args: {
          p_school_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };

      unsuspend_school_teacher: {
        Args: {
          p_school_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };

      is_nexus_owner: {
        Args: Record<string, never>;
        Returns: boolean;
      };

      nexus_set_module_enabled: {
        Args: {
          p_module_key: string;
          p_is_enabled: boolean;
        };
        Returns: boolean;
      };
    };

    Enums: {
      school_role: SchoolRole;
      membership_status: MembershipStatus;
    };

    CompositeTypes: Record<string, never>;
  };
}