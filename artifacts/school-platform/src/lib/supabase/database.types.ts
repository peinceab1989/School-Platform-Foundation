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