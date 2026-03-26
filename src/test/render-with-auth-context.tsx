import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { AuthContext } from "@/hooks/auth-context";
import type { AuthContextValue } from "@/hooks/auth-provider-cf";

const defaultAuthContextValue: AuthContextValue = {
  user: null,
  session: null,
  loading: false,
  signUp: async () => ({ error: null, session: null, user: null }),
  signIn: async () => ({ error: null, session: null, user: null }),
  signInWithOAuth: async () => ({ error: null, session: null }),
  requestPasswordReset: async () => ({ error: null }),
  signOut: async () => undefined,
  updateDisplayName: async () => ({ error: null, user: null }),
  deleteAccount: async () => ({ error: null }),
};

export function renderWithAuthContext(
  ui: ReactElement,
  authOverrides: Partial<AuthContextValue> = {},
  renderOptions?: Omit<RenderOptions, "wrapper">,
) {
  const authValue: AuthContextValue = {
    ...defaultAuthContextValue,
    ...authOverrides,
  };

  return render(
    <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>,
    renderOptions,
  );
}
