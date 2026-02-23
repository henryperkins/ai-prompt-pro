import { Link } from "react-router-dom";
import { PageHero, PageShell } from "@/components/PageShell";
import { Card } from "@/components/base/primitives/card";
import { brandCopy } from "@/lib/brand-copy";

const Terms = () => {
  return (
    <PageShell>
      <PageHero
        eyebrow={brandCopy.brandLine}
        title="Terms of Use"
        subtitle="Basic rules for using PromptForge and community features."
        className="pf-gilded-frame pf-hero-surface"
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="pf-card space-y-4 border-border/80 bg-card/90 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">Last updated: February 20, 2026</p>

          <article className="prose max-w-[68ch] text-foreground dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
            <h2>Using PromptForge responsibly</h2>
            <p>
              By using PromptForge, you agree not to post unlawful, abusive, or harmful content.
            </p>
            <p>
              You are responsible for content you publish, including shared prompts, comments, and remix notes.
            </p>
            <p>
              Community content may be reported, moderated, hidden, or removed to keep the service safe.
            </p>
            <p>
              Repeated misuse may result in restricted access to community features.
            </p>
            <h2>Service availability</h2>
            <p>
              PromptForge is provided "as is" and may change over time as features improve.
            </p>
          </article>
        </Card>

        <Card className="pf-card space-y-2 border-border/80 bg-card/90 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground">Need help?</h2>
          <p className="text-sm text-muted-foreground">
            Visit <Link to="/contact" className="underline">Contact Support</Link> for account, moderation, or policy
            questions.
          </p>
        </Card>
      </div>
    </PageShell>
  );
};

export default Terms;
