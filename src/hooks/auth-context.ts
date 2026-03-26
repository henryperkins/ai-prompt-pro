import { createContext } from "react";
import type { AuthContextValue } from "@/hooks/auth-provider-cf";

export const AuthContext = createContext<AuthContextValue | null>(null);
