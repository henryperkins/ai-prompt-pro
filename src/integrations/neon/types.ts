export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      community_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          category: string
          comment_count: number
          created_at: string
          description: string
          enhanced_prompt: string
          id: string
          is_public: boolean
          public_config: Json
          rating_avg: number
          rating_count: number
          remix_count: number
          remix_diff: Json | null
          remix_note: string
          remixed_from: string | null
          saved_prompt_id: string
          starter_prompt: string
          tags: string[]
          target_model: string
          title: string
          updated_at: string
          upvote_count: number
          use_case: string
          verified_count: number
        }
        Insert: {
          author_id: string
          category?: string
          comment_count?: number
          created_at?: string
          description?: string
          enhanced_prompt: string
          id?: string
          is_public?: boolean
          public_config?: Json
          rating_avg?: number
          rating_count?: number
          remix_count?: number
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          saved_prompt_id: string
          starter_prompt?: string
          tags?: string[]
          target_model?: string
          title: string
          updated_at?: string
          upvote_count?: number
          use_case?: string
          verified_count?: number
        }
        Update: {
          author_id?: string
          category?: string
          comment_count?: number
          created_at?: string
          description?: string
          enhanced_prompt?: string
          id?: string
          is_public?: boolean
          public_config?: Json
          rating_avg?: number
          rating_count?: number
          remix_count?: number
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          saved_prompt_id?: string
          starter_prompt?: string
          tags?: string[]
          target_model?: string
          title?: string
          updated_at?: string
          upvote_count?: number
          use_case?: string
          verified_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_remixed_from_fkey"
            columns: ["remixed_from"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_saved_prompt_id_fkey"
            columns: ["saved_prompt_id"]
            isOneToOne: true
            referencedRelation: "saved_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_prompt_ratings: {
        Row: {
          created_at: string
          id: string
          post_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_prompt_ratings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          details: string
          id: string
          post_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
          target_type: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          details?: string
          id?: string
          post_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
          target_type: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          details?: string
          id?: string
          post_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      community_user_follows: {
        Row: {
          created_at: string
          followed_user_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          followed_user_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          followed_user_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
      support_reviewers: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          message: string
          phone_country: string
          phone_number: string
          privacy_consent: boolean
          requester_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          message: string
          phone_country?: string
          phone_number?: string
          privacy_consent: boolean
          requester_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string
          phone_country?: string
          phone_number?: string
          privacy_consent?: boolean
          requester_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          config: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          created_at: string
          id: string
          name: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_prompts: {
        Row: {
          built_prompt: string
          category: string
          config: Json
          created_at: string
          description: string
          enhanced_prompt: string
          fingerprint: string | null
          id: string
          is_shared: boolean
          remix_diff: Json | null
          remix_note: string
          remixed_from: string | null
          revision: number
          tags: string[]
          target_model: string
          title: string
          updated_at: string
          use_case: string
          user_id: string
        }
        Insert: {
          built_prompt?: string
          category?: string
          config?: Json
          created_at?: string
          description?: string
          enhanced_prompt?: string
          fingerprint?: string | null
          id?: string
          is_shared?: boolean
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          revision?: number
          tags?: string[]
          target_model?: string
          title: string
          updated_at?: string
          use_case?: string
          user_id: string
        }
        Update: {
          built_prompt?: string
          category?: string
          config?: Json
          created_at?: string
          description?: string
          enhanced_prompt?: string
          fingerprint?: string | null
          id?: string
          is_shared?: boolean
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          revision?: number
          tags?: string[]
          target_model?: string
          title?: string
          updated_at?: string
          use_case?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_prompts_remixed_from_fkey"
            columns: ["remixed_from"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          config: Json
          created_at: string
          description: string
          fingerprint: string | null
          id: string
          name: string
          revision: number
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string
          fingerprint?: string | null
          id?: string
          name: string
          revision?: number
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string
          fingerprint?: string | null
          id?: string
          name?: string
          revision?: number
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      community_posts_search_tsv: {
        Args: {
          p_description: string
          p_tags: string[]
          p_title: string
          p_use_case: string
        }
        Returns: unknown
      }
      community_profiles_by_ids: {
        Args: { input_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      delete_my_account: {
        Args: never
        Returns: boolean
      }
      dearmor: { Args: { "": string }; Returns: string }
      gen_random_uuid: { Args: never; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      refresh_community_post_metrics: {
        Args: { target_post_id: string }
        Returns: undefined
      }
      show_db_tree: {
        Args: never
        Returns: {
          tree_structure: string
        }[]
      }
      strip_sensitive_prompt_config: {
        Args: { input_config: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
