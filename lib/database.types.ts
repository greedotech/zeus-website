// lib/database.types.ts
// Generated from the Zeus Lounge Supabase project. Regenerate with the
// Supabase CLI/MCP whenever the schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bonus_spins: {
        Row: {
          created_at: string
          id: string
          result_kind: string
          result_label: string
          result_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          result_kind: string
          result_label: string
          result_value: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          result_kind?: string
          result_label?: string
          result_value?: number
          user_id?: string
        }
        Relationships: []
      }
      coin_config: {
        Row: { id: string; value: number }
        Insert: { id: string; value: number }
        Update: { id?: string; value?: number }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_spins: {
        Row: {
          created_at: string
          id: string
          label: string
          note: string | null
          reward: number
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          note?: string | null
          reward: number
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          reward?: number
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mission_pool: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string
          is_active: boolean
          reward_max: number
          reward_min: number
          sort_order: number
          title: string
          verification_method: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description: string
          is_active?: boolean
          reward_max?: number
          reward_min?: number
          sort_order?: number
          title: string
          verification_method?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string
          is_active?: boolean
          reward_max?: number
          reward_min?: number
          sort_order?: number
          title?: string
          verification_method?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_tier: string
          birthday_bonus_year: number | null
          created_at: string | null
          dob: string | null
          email: string | null
          favorite_game: string | null
          first_name: string | null
          id: string
          invite_code: string | null
          is_host: boolean
          last_deposit_at: string | null
          last_login_at: string | null
          last_name: string | null
          last_spin_at: string | null
          lifetime_coins: number
          lifetime_coins_spent: number
          points: number
          referral_code: string | null
          referral_source: string | null
          referred_by: string | null
          total_coins_redeemed: number
          total_deposit_amount: number
          total_deposits: number
          total_rewards_redeemed: number
          username: string | null
          welcome_bonus_granted: boolean
          zeus_coins: number
        }
        Insert: {
          account_tier?: string
          birthday_bonus_year?: number | null
          created_at?: string | null
          dob?: string | null
          email?: string | null
          favorite_game?: string | null
          first_name?: string | null
          id: string
          invite_code?: string | null
          is_host?: boolean
          last_deposit_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          last_spin_at?: string | null
          lifetime_coins?: number
          lifetime_coins_spent?: number
          points?: number
          referral_code?: string | null
          referral_source?: string | null
          referred_by?: string | null
          total_coins_redeemed?: number
          total_deposit_amount?: number
          total_deposits?: number
          total_rewards_redeemed?: number
          username?: string | null
          welcome_bonus_granted?: boolean
          zeus_coins?: number
        }
        Update: {
          account_tier?: string
          birthday_bonus_year?: number | null
          created_at?: string | null
          dob?: string | null
          email?: string | null
          favorite_game?: string | null
          first_name?: string | null
          id?: string
          invite_code?: string | null
          is_host?: boolean
          last_deposit_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          last_spin_at?: string | null
          lifetime_coins?: number
          lifetime_coins_spent?: number
          points?: number
          referral_code?: string | null
          referral_source?: string | null
          referred_by?: string | null
          total_coins_redeemed?: number
          total_deposit_amount?: number
          total_deposits?: number
          total_rewards_redeemed?: number
          username?: string | null
          welcome_bonus_granted?: boolean
          zeus_coins?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          cost: number
          created_at: string
          id: string
          reward: string
          user_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          reward: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          reward?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          coins_spent: number
          created_at: string | null
          id: string
          meta: Json | null
          reward_key: string
          reward_label: string
          user_id: string
        }
        Insert: {
          coins_spent: number
          created_at?: string | null
          id?: string
          meta?: Json | null
          reward_key: string
          reward_label: string
          user_id: string
        }
        Update: {
          coins_spent?: number
          created_at?: string | null
          id?: string
          meta?: Json | null
          reward_key?: string
          reward_label?: string
          user_id?: string
        }
        Relationships: []
      }
      user_daily_missions: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          mission_code: string
          mission_date: string
          reward_amount: number | null
          status: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_code: string
          mission_date?: string
          reward_amount?: number | null
          status?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_code?: string
          mission_date?: string
          reward_amount?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_missions_mission_code_fkey"
            columns: ["mission_code"]
            isOneToOne: false
            referencedRelation: "mission_pool"
            referencedColumns: ["code"]
          },
        ]
      }
      user_mission_stats: {
        Row: {
          current_streak: number
          last_claim_date: string | null
          longest_streak: number
          total_missions_claimed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_claim_date?: string | null
          longest_streak?: number
          total_missions_claimed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_claim_date?: string | null
          longest_streak?: number
          total_missions_claimed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zeus_coin_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_mission_reward: {
        Args: { p_mission_code: string }
        Returns: {
          current_streak: number
          new_balance: number
          reward_amount: number
        }[]
      }
      complete_mission: {
        Args: { p_mission_code: string }
        Returns: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          mission_code: string
          mission_date: string
          reward_amount: number | null
          status: string
          user_id: string
        }
      }
      get_or_assign_daily_missions: {
        Args: never
        Returns: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          mission_code: string
          mission_date: string
          reward_amount: number | null
          status: string
          user_id: string
        }[]
      }
      increment_points: {
        Args: { inc: number; uid: string }
        Returns: undefined
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

type DefaultSchema = Database["public"]

export type Tables<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName] extends { Row: infer R } ? R : never
