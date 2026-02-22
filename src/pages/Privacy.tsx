import { Link } from "react-router-dom";
import { PageHero, PageShell } from "@/components/PageShell";
import { Card } from "@/components/base/primitives/card";
import { brandCopy } from "@/lib/brand-copy";

const Privacy = () => {
  return (
    <PageShell>
      <PageHero
        eyebrow={brandCopy.brandLine}
        title="Privacy Policy"
        subtitle="How PromptForge handles account, usage, and community data."
        className="pf-gilded-frame pf-hero-surface"
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="pf-card space-y-4 border-border/80 bg-card/90 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">Last updated: February 20, 2026</p>
          <article className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
            <p>
              We collect only the information needed to provide account access, saved prompts, and community features.
              We do not sell your personal data.
            </p>
            <h2>Data we collect</h2>
            <ul>
              <li>
                <strong>Account data:</strong> email address, authentication metadata, and profile details you choose
                to provide.
              </li>
              <li>
                <strong>Product data:</strong> saved prompts, drafts, versions, and community actions (shares, votes,
                comments, reports, and user blocks).
              </li>
            </ul>
            <h2>Security and controls</h2>
            <ul>
              <li>
                <strong>Security:</strong> we apply access controls and row-level permissions to protect
                account-scoped data.
              </li>
              <li>
                <strong>Your controls:</strong> you can update profile fields, remove shared content, and delete your
                account in-app.
              </li>
            </ul>
          </article>
        </Card>

        <Card className="pf-card space-y-2 border-border/80 bg-card/90 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p className="text-sm text-muted-foreground">
            For privacy requests or questions, visit <Link to="/contact" className="underline">Contact Support</Link>.
          </p>
        </Card>
      </div>
    </PageShell>
  );
};

export default Privacy;
