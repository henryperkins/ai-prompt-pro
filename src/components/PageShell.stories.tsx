import { useEffect, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { PageHero, PageShell } from "@/components/PageShell";
import { AuthContext } from "@/hooks/auth-context";
import type { AuthContextValue } from "@/hooks/auth-provider-cf";
import { ThemeContext } from "@/hooks/theme-context";
import type { ThemePreference } from "@/lib/user-preferences";

const authValue: AuthContextValue = {
  user: null,
  session: null,
  loading: false,
  signUp: async () => ({ error: null, session: null, user: null }),
  signIn: async () => ({ error: null, session: null, user: null }),
  signInWithOAuth: async () => ({ error: null, session: null }),
  requestPasswordReset: async () => ({ error: null }),
  signOut: async () => {},
  updateDisplayName: async () => ({ error: null, user: null }),
  deleteAccount: async () => ({ error: null }),
};

function ShellStoryFrame({
  children,
  theme = "default",
}: {
  children: ReactNode;
  theme?: ThemePreference;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    root.dataset.theme = theme;

    return () => {
      if (previousTheme) {
        root.dataset.theme = previousTheme;
        return;
      }
      delete root.dataset.theme;
    };
  }, [theme]);

  return (
    <MemoryRouter initialEntries={["/components-showcase"]}>
      <AuthContext.Provider value={authValue}>
        <ThemeContext.Provider value={{ theme, isMidnight: theme === "midnight", toggleTheme: () => {} }}>
          {children}
        </ThemeContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

const meta = {
  title: "Design System/Branded/PageShell",
  component: PageShell,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StandardChrome: Story = {
  render: () => (
    <ShellStoryFrame>
      <PageShell>
        <PageHero
          eyebrow="PromptForge Shell"
          title="Prompt-first page chrome"
          subtitle="Use this wrapper to validate the product wordmark, gilded hero surface, and footer chrome before route-level shell changes ship."
        />
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          <div className="pf-card rounded-xl border border-border/70 bg-background/60 p-5">
            <p className="ui-section-label text-primary">Primary shell</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Default route layout</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirms the shell backdrop, main container rhythm, and footer treatment used across product routes.
            </p>
          </div>
          <div className="pf-card rounded-xl border border-border/70 bg-background/60 p-5">
            <p className="ui-section-label text-primary">Review note</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Check alongside the showcase route</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep this story aligned with `src/pages/ComponentsShowcase.tsx` whenever `pf-shell-*` or `pf-hero-surface` classes change.
            </p>
          </div>
        </div>
      </PageShell>
    </ShellStoryFrame>
  ),
};

export const MidnightCommunityChrome: Story = {
  render: () => (
    <ShellStoryFrame theme="midnight">
      <PageShell mainClassName="pf-community-page">
        <PageHero
          eyebrow="Community Wrapper"
          title="Midnight shell variant"
          subtitle="Verifies the deeper theme, community page spacing, and shell chrome without leaving Storybook."
        />
        <div className="mx-auto max-w-5xl">
          <div className="pf-card rounded-xl border border-border/70 bg-background/55 p-5">
            <h2 className="text-lg font-semibold text-foreground">Community route framing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use this variant when adjusting community-specific shell spacing, backdrop contrast, or mobile footer overlap.
            </p>
          </div>
        </div>
      </PageShell>
    </ShellStoryFrame>
  ),
};

export const UtilityRecoveryChrome: Story = {
  render: () => (
    <ShellStoryFrame>
      <PageShell mainClassName="flex min-h-[70vh] items-center justify-center py-10">
        <div className="w-full max-w-2xl space-y-4">
          <PageHero
            pattern="utility"
            eyebrow="Utility Route"
            title="Focused recovery state"
            subtitle="Use the utility hero for legal, support, redirect, and not-found pages that need a clear next step without the full collection wordmark treatment."
          />
          <div className="pf-card rounded-xl border border-border/70 bg-background/60 p-5">
            <p className="ui-section-label text-primary">Pattern intent</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Keep the route calm</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pair the quieter utility hero with one primary recovery action and one softer alternate path.
            </p>
          </div>
        </div>
      </PageShell>
    </ShellStoryFrame>
  ),
};
