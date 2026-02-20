import { Link } from "react-router-dom";
import { PageHero, PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { brandCopy } from "@/lib/brand-copy";

const Privacy = () => {
  return (
    <PageShell>
      <PageHero
        eyebrow={brandCopy.brandLine}
        title="Privacy Policy"
        subtitle="How PromptForge handles account, usage, and community data."
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="space-y-3 border-border/80 bg-card/90 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Last updated: February 20, 2026</p>
          <p className="text-sm text-foreground">
            We collect only the information needed to provide account access, saved prompts, and community features.
            We do not sell your personal data.
          </p>

          <div className="space-y-2 text-sm text-foreground">
            <p>
              <span className="font-semibold">Account data:</span> email address, authentication metadata, and profile
              details you choose to provide.
            </p>
            <p>
              <span className="font-semibold">Product data:</span> saved prompts, drafts, versions, and community
              actions (shares, votes, comments, reports, and user blocks).
            </p>
            <p>
              <span className="font-semibold">Security:</span> we apply access controls and row-level permissions to
              protect account-scoped data.
            </p>
            <p>
              <span className="font-semibold">Your controls:</span> you can update profile fields, remove shared
              content, and delete your account in-app.
            </p>
          </div>
        </Card>

        <Card className="space-y-2 border-border/80 bg-card/90 p-4 sm:p-5">
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
