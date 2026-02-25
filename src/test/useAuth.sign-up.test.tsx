import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
      onAuthStateChange: (...args: unknown[]) => mocks.onAuthStateChange(...args),
      signUp: (...args: unknown[]) => mocks.signUp(...args),
      signInWithPassword: (...args: unknown[]) => mocks.signInWithPassword(...args),
      signInWithOAuth: (...args: unknown[]) => mocks.signInWithOAuth(...args),
      signOut: (...args: unknown[]) => mocks.signOut(...args),
      updateUser: (...args: unknown[]) => mocks.updateUser(...args),
    },
    from: (...args: unknown[]) => mocks.from(...args),
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("sends a non-empty name derived from email when display name is missing", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.signUp("jane.doe@example.com", "Passw0rd!");

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "jane.doe@example.com",
      password: "Passw0rd!",
      options: {
        data: {
          displayName: "jane.doe",
          name: "jane.doe",
        },
      },
    });
  });

  it("prefers provided display name when signing up", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.signUp("jane.doe@example.com", "Passw0rd!", "  Jane Doe  ");

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "jane.doe@example.com",
      password: "Passw0rd!",
      options: {
        data: {
          displayName: "Jane Doe",
          name: "Jane Doe",
        },
      },
    });
  });

  it("clears local session even when remote sign-out fails", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "token",
          expires_at: nowSeconds + 3600,
          user: {
            id: "user-1",
            email: "user-1@example.com",
          },
        },
      },
      error: null,
    });
    mocks.signOut.mockRejectedValueOnce(new Error("neon auth unavailable"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("user-1");

    await act(async () => {
      await expect(result.current.signOut()).resolves.toBeUndefined();
    });

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  it("keeps delete account successful when remote sign-out fails", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "token",
          expires_at: nowSeconds + 3600,
          user: {
            id: "user-1",
            email: "user-1@example.com",
          },
        },
      },
      error: null,
    });
    mocks.signOut.mockRejectedValueOnce(new Error("neon auth unavailable"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let deleteResult: { error: string | null } | null = null;
    await act(async () => {
      deleteResult = await result.current.deleteAccount();
    });

    expect(deleteResult).toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_my_account");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });
});
