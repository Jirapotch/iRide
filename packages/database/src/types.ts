export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          destination_label: string | null;
          destination_latitude: number | null;
          destination_location: unknown;
          destination_longitude: number | null;
          ends_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["event_kind"];
          latitude: number;
          location: unknown;
          location_label: string;
          longitude: number;
          organizer_id: string;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at: string;
          vehicle_kinds: Database["public"]["Enums"]["vehicle_kind"][];
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          destination_label?: string | null;
          destination_latitude?: number | null;
          destination_location?: unknown;
          destination_longitude?: number | null;
          ends_at?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["event_kind"];
          latitude: number;
          location?: unknown;
          location_label: string;
          longitude: number;
          organizer_id: string;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at?: string;
          vehicle_kinds: Database["public"]["Enums"]["vehicle_kind"][];
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          destination_label?: string | null;
          destination_latitude?: number | null;
          destination_location?: unknown;
          destination_longitude?: number | null;
          ends_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["event_kind"];
          latitude?: number;
          location?: unknown;
          location_label?: string;
          longitude?: number;
          organizer_id?: string;
          starts_at?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
          vehicle_kinds?: Database["public"]["Enums"]["vehicle_kind"][];
        };
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      photographer_spots: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          ends_at: string;
          id: string;
          latitude: number;
          location: unknown;
          location_label: string;
          longitude: number;
          owner_id: string;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          ends_at: string;
          id?: string;
          latitude: number;
          location?: unknown;
          location_label: string;
          longitude: number;
          owner_id: string;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          ends_at?: string;
          id?: string;
          latitude?: number;
          location?: unknown;
          location_label?: string;
          longitude?: number;
          owner_id?: string;
          starts_at?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photographer_spots_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_media_id: string | null;
          bio: string | null;
          cover_media_id: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          updated_at: string;
          username: string | null;
          username_changed_at: string | null;
          visibility: Database["public"]["Enums"]["profile_visibility"];
        };
        Insert: {
          avatar_media_id?: string | null;
          bio?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          updated_at?: string;
          username?: string | null;
          username_changed_at?: string | null;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
        };
        Update: {
          avatar_media_id?: string | null;
          bio?: string | null;
          cover_media_id?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          updated_at?: string;
          username?: string | null;
          username_changed_at?: string | null;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      archive_job: {
        Args: { message_id: number; queue_name: string };
        Returns: boolean;
      };
      enqueue_job: {
        Args: { delay_seconds?: number; message: Json; queue_name: string };
        Returns: number;
      };
      explore_content: {
        Args: {
          east: number;
          layers: string[];
          north: number;
          south: number;
          west: number;
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          author_username: string;
          ends_at: string;
          id: string;
          kind: string;
          latitude: number;
          longitude: number;
          starts_at: string;
          subtitle: string;
          title: string;
        }[];
      };
      read_jobs: {
        Args: {
          batch_size?: number;
          queue_name: string;
          visibility_timeout_seconds?: number;
        };
        Returns: {
          enqueued_at: string;
          headers: Json;
          message: Json;
          msg_id: number;
          read_ct: number;
          vt: string;
        }[];
      };
    };
    Enums: {
      event_kind: "meeting" | "event" | "trip";
      profile_visibility: "public" | "followers" | "private";
      vehicle_kind: "car" | "motorcycle" | "bicycle";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      event_kind: ["meeting", "event", "trip"],
      profile_visibility: ["public", "followers", "private"],
      vehicle_kind: ["car", "motorcycle", "bicycle"],
    },
  },
} as const;
