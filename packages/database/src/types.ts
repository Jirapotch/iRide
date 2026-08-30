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
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          parent_id: string | null;
          post_id: string;
          reply_to_user_id: string | null;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          parent_id?: string | null;
          post_id: string;
          reply_to_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          parent_id?: string | null;
          post_id?: string;
          reply_to_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_reply_to_user_id_fkey";
            columns: ["reply_to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
      market_products: {
        Row: {
          category: string;
          cover_media_id: string | null;
          created_at: string;
          currency: string;
          deleted_at: string | null;
          id: string;
          name: string;
          owner_id: string;
          price_satang: number;
          updated_at: string;
          vehicle_kinds: Database["public"]["Enums"]["vehicle_kind"][];
        };
        Insert: {
          category: string;
          cover_media_id?: string | null;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          price_satang: number;
          updated_at?: string;
          vehicle_kinds: Database["public"]["Enums"]["vehicle_kind"][];
        };
        Update: {
          category?: string;
          cover_media_id?: string | null;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          price_satang?: number;
          updated_at?: string;
          vehicle_kinds?: Database["public"]["Enums"]["vehicle_kind"][];
        };
        Relationships: [
          {
            foreignKeyName: "market_products_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_products_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      media: {
        Row: {
          bytes: number;
          created_at: string;
          deleted_at: string | null;
          failure_reason: string | null;
          filename: string;
          height: number | null;
          id: string;
          mime_type: string;
          original_object_key: string;
          owner_id: string;
          purpose: Database["public"]["Enums"]["media_purpose"];
          status: Database["public"]["Enums"]["media_status"];
          updated_at: string;
          width: number | null;
        };
        Insert: {
          bytes: number;
          created_at?: string;
          deleted_at?: string | null;
          failure_reason?: string | null;
          filename: string;
          height?: number | null;
          id?: string;
          mime_type: string;
          original_object_key: string;
          owner_id: string;
          purpose: Database["public"]["Enums"]["media_purpose"];
          status?: Database["public"]["Enums"]["media_status"];
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          bytes?: number;
          created_at?: string;
          deleted_at?: string | null;
          failure_reason?: string | null;
          filename?: string;
          height?: number | null;
          id?: string;
          mime_type?: string;
          original_object_key?: string;
          owner_id?: string;
          purpose?: Database["public"]["Enums"]["media_purpose"];
          status?: Database["public"]["Enums"]["media_status"];
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      media_variants: {
        Row: {
          bytes: number;
          created_at: string;
          height: number;
          id: string;
          kind: Database["public"]["Enums"]["media_variant_kind"];
          media_id: string;
          mime_type: string;
          object_key: string;
          width: number;
        };
        Insert: {
          bytes: number;
          created_at?: string;
          height: number;
          id?: string;
          kind: Database["public"]["Enums"]["media_variant_kind"];
          media_id: string;
          mime_type?: string;
          object_key: string;
          width: number;
        };
        Update: {
          bytes?: number;
          created_at?: string;
          height?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["media_variant_kind"];
          media_id?: string;
          mime_type?: string;
          object_key?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "media_variants_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
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
      post_marker_tags: {
        Row: {
          created_at: string;
          event_id: string | null;
          photographer_spot_id: string | null;
          position: number;
          post_id: string;
        };
        Insert: {
          created_at?: string;
          event_id?: string | null;
          photographer_spot_id?: string | null;
          position: number;
          post_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string | null;
          photographer_spot_id?: string | null;
          position?: number;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_marker_tags_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_marker_tags_photographer_spot_id_fkey";
            columns: ["photographer_spot_id"];
            isOneToOne: false;
            referencedRelation: "photographer_spots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_marker_tags_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
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
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_media_fk";
            columns: ["avatar_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_cover_media_fk";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_media: {
        Row: {
          is_cover: boolean;
          media_id: string;
          position: number;
          vehicle_id: string;
        };
        Insert: {
          is_cover?: boolean;
          media_id: string;
          position: number;
          vehicle_id: string;
        };
        Update: {
          is_cover?: boolean;
          media_id?: string;
          position?: number;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_media_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_media_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          archived_at: string | null;
          brand: string;
          created_at: string;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["vehicle_kind"];
          model: string;
          nickname: string | null;
          owner_id: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["vehicle_visibility"];
          year: number | null;
        };
        Insert: {
          archived_at?: string | null;
          brand: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["vehicle_kind"];
          model: string;
          nickname?: string | null;
          owner_id: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["vehicle_visibility"];
          year?: number | null;
        };
        Update: {
          archived_at?: string | null;
          brand?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["vehicle_kind"];
          model?: string;
          nickname?: string | null;
          owner_id?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["vehicle_visibility"];
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      complete_media_upload: {
        Args: {
          expected_owner_id: string;
          message: Json;
          target_media_id: string;
        };
        Returns: number;
      };
      delete_vehicle_permanently: {
        Args: { target_vehicle_id: string };
        Returns: string;
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
      finish_media_processing: {
        Args: {
          source_height: number;
          source_width: number;
          target_media_id: string;
          variants: Json;
        };
        Returns: undefined;
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
      save_post_with_markers: {
        Args: { marker_tags: Json; post_body: string; target_post_id: string };
        Returns: string;
      };
      save_vehicle_with_media: {
        Args: {
          media_ids: string[];
          target_vehicle_id: string;
          vehicle_input: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      event_kind: "meeting" | "event" | "trip";
      media_purpose: "avatar" | "cover" | "vehicle" | "market";
      media_status: "uploading" | "processing" | "ready" | "failed" | "deleted";
      media_variant_kind: "thumbnail" | "preview";
      profile_visibility: "public" | "followers" | "private";
      vehicle_kind: "car" | "motorcycle" | "bicycle";
      vehicle_visibility: "public" | "private";
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
      media_purpose: ["avatar", "cover", "vehicle", "market"],
      media_status: ["uploading", "processing", "ready", "failed", "deleted"],
      media_variant_kind: ["thumbnail", "preview"],
      profile_visibility: ["public", "followers", "private"],
      vehicle_kind: ["car", "motorcycle", "bicycle"],
      vehicle_visibility: ["public", "private"],
    },
  },
} as const;
