export type SchoolRole = 'admin' | 'teacher' | 'student' | 'parent';
export type MembershipStatus = 'active' | 'invited' | 'suspended';

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
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
    };
    Enums: {
      school_role: SchoolRole;
      membership_status: MembershipStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
