import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { CommunityPost, CommunityProfile } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  toast: vi.fn(),
  loadFeed: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  loadMyRatings: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useCommunityMobileTelemetry", () => ({
  useCommunityMobileTelemetry: () => ({
    trackFirstMeaningfulAction: vi.fn(),
    trackInteraction: vi.fn(),
  }),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock("@/lib/community", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community")>("@/lib/community");
  return {
    ...actual,
    loadFeed: (...args: unknown[]) => mocks.loadFeed(...args),
    loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
    loadPostsByIds: (...args: unknown[]) => mocks.loadPostsByIds(...args),
    loadMyVotes: (...args: unknown[]) => mocks.loadMyVotes(...args),
    loadMyRatings: (...args: unknown[]) => mocks.loadMyRatings(...args),
  };
});

vi.mock("@/lib/community-moderation", () => ({
  blockCommunityUser: vi.fn().mockResolvedValue(undefined),
  loadBlockedUserIds: vi.fn().mockResolvedValue([]),
  submitCommunityReport: vi.fn().mockResolvedValue(undefined),
  unblockCommunityUser: vi.fn().mockResolvedValue(undefined),
}));

function createPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Release checklist",
    enhancedPrompt: "Build a rollout checklist with rollback guardrails.",
    description: "",
    useCase: "Launch checklist",
    category: "general",
    tags: ["ops"],
    targetModel: "gpt-5-mini",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Plan this launch.",
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    upvoteCount: 2,
    verifiedCount: 1,
    remixCount: 1,
    commentCount: 0,
    ratingCount: 0,
    ratingAverage: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function createProfile(overrides: Partial<CommunityProfile> = {}): CommunityProfile {
  return {
    id: "author-1",
    displayName: "Prompt Dev",
    avatarUrl: null,
    ...overrides,
  };
}

async function renderCommunity(initialEntries = ["/community"]) {
  vi.resetModules();
  const { default: Community } = await import("@/pages/Community");
  await act(async () => {
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Community />
      </MemoryRouter>,
    );
  });
}

describe("Community tag filter state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("scrollTo", vi.fn());

    const post = createPost();
    mocks.loadFeed.mockResolvedValue([post]);
    mocks.loadProfilesByIds.mockResolvedValue([createProfile({ id: post.authorId })]);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears any existing text search before applying a tag filter", async () => {
    await renderCommunity();

    await screen.findByText("Release checklist");
    fireEvent.change(screen.getByRole("textbox", { name: "Search community posts" }), {
      target: { value: "launch" },
    });

    await waitFor(() => {
      const searchCall = mocks.loadFeed.mock.calls.at(-1)?.[0] as { search?: string };
      expect(searchCall?.search).toBe("launch");
    });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag ops" }));

    await waitFor(() => {
      expect(mocks.loadFeed.mock.calls.length).toBeGreaterThan(1);
    });

    const filteredCall = mocks.loadFeed.mock.calls.at(-1)?.[0] as { search?: string; tag?: string };
    expect(filteredCall?.tag).toBe("ops");
    expect(filteredCall?.search).toBeUndefined();
    expect(screen.getByRole("textbox", { name: "Search community posts" })).toHaveValue("");
    expect(screen.getByTestId("community-active-tag")).toHaveTextContent("#ops");
  }, 15_000);

  it("does not restore a hidden search term after the tag filter is cleared", async () => {
    await renderCommunity();

    await screen.findByText("Release checklist");
    fireEvent.change(screen.getByRole("textbox", { name: "Search community posts" }), {
      target: { value: "launch" },
    });

    await waitFor(() => {
      const searchCall = mocks.loadFeed.mock.calls.at(-1)?.[0] as { search?: string };
      expect(searchCall?.search).toBe("launch");
    });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag ops" }));
    await waitFor(() => {
      const filteredCall = mocks.loadFeed.mock.calls.at(-1)?.[0] as { search?: string; tag?: string };
      expect(filteredCall?.tag).toBe("ops");
      expect(filteredCall?.search).toBeUndefined();
    });

    fireEvent.click(screen.getByTestId("community-clear-tag-filter"));

    await waitFor(() => {
      const clearedCall = mocks.loadFeed.mock.calls.at(-1)?.[0] as { search?: string; tag?: string };
      expect(clearedCall?.tag).toBeUndefined();
      expect(clearedCall?.search).toBeUndefined();
      expect(screen.queryByTestId("community-active-tag")).toBeNull();
      expect(screen.getByRole("textbox", { name: "Search community posts" })).toHaveValue("");
    });
  }, 15_000);
});
