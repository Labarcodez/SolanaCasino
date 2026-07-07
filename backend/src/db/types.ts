export type AuthProviderType = "wallet" | "google" | "apple" | "phantom";

export interface UserRow {
  wallet_address: string;
  balance_lamports: number;
  total_wagered_lamports: number;
  total_won_lamports: number;
  display_name: string | null;
  email: string | null;
  auth_provider: AuthProviderType;
  created_at: string;
  updated_at: string;
}
