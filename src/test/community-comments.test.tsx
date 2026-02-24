import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { CommunityComment, CommunityProfile } from "@/lib/community";
import { CommunityComments } from "@/components/community/CommunityComments";

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "user@example.com",
    user_metadata: {
      display_name: "Test User",
      avatar_url: null,
    },
  } as {
    id: string;
    email: string;
    user_metadata: {
      display_name: string;
      avatar_url: string | null;
    };
  } | null,
  toast: vi.fn(),
  loadComments: vi.fn(),
  loadProfilesByIds: vi.fn(),
  addComment: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/community", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community")>("@/lib/community");
  return {
    ...actual,
    loadComments: (...args: unknown[]) => mocks.loadComments(...args),
    loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
    addComment: (...args: unknown[]) => mocks.addComment(...args),
  };
});

function buildComment(id: string, body: string): CommunityComment {
  const now = Date.now();
  return {
    id,
    postId: "post-1",
    userId: "author-1",
    body,
    createdAt: now,
    updatedAt: now,
  };
}

describe("community comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.user = {
      id: "user-1",
      email: "user@example.com",
      user_metadata: {
        display_name: "Test User",
        avatar_url: null,
      },
    };

    const comments = Array.from({ length: 8 }, (_, index) =>
      buildComment(`comment-${index + 1}`, `Comment ${index + 1}`),
    );
    const profiles: CommunityProfile[] = [
      {
        id: "author-1",
        displayName: "Prompt Dev",
        avatarUrl: null,
      },
    ];

    mocks.loadComments.mockResolvedValue(comments);
    mocks.loadProfilesByIds.mockResolvedValue(profiles);
    mocks.addComment.mockResolvedValue(buildComment("comment-created", "New comment"));
  });

  it("keeps desktop comment threads scrollable so composer actions stay visible", async () => {
    render(
      <MemoryRouter>
        <CommunityComments postId="post-1" totalCount={8} />
      </MemoryRouter>,
    );

    await screen.findByText("Comment 1");

    const commentsList = screen.getByTestId("community-comments-list");
    expect(commentsList.className).toContain("sm:max-h-[52vh]");
    expect(commentsList.className).not.toContain("sm:max-h-none");
    expect(screen.getByTestId("community-comment-submit")).toBeInTheDocument();
  });

  it("shows a sign-in action when the user is signed out", async () => {
    mocks.user = null;

    render(
      <MemoryRouter>
        <CommunityComments postId="post-1" totalCount={8} />
      </MemoryRouter>,
    );

    await screen.findByText("Comment 1");

    const signInLink = screen.getByTestId("community-comment-submit");
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveTextContent("Sign in to comment");
    expect(signInLink).toHaveAttribute("href", "/");
    expect(screen.getByText("Sign in to join the conversation")).toBeInTheDocument();
  });
});
