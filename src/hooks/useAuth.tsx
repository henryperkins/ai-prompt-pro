import { useContext } from "react";
import { AuthContext } from "@/hooks/auth-context";

export type { AuthOAuthProvider, AuthSession, AuthUser } from "@/hooks/auth-provider-cf";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
