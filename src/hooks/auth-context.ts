import { createContext } from "react";
import type { AuthContextValue } from "@/hooks/auth-provider";

export const AuthContext = createContext<AuthContextValue | null>(null);
