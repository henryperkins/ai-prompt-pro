import { PageHero, PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { brandCopy } from "@/lib/brand-copy";

const SUPPORT_EMAIL = "support@lakefrontdigital.io";

const Contact = () => {
  return (
    <PageShell>
      <PageHero
        eyebrow={brandCopy.brandLine}
        title="Contact Support"
        subtitle="Questions, moderation concerns, or account help."
      />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="space-y-3 border-border/80 bg-card/90 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground">How to reach us</h2>
          <p className="text-sm text-foreground">
            Email: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p className="text-sm text-muted-foreground">Typical response time: within 2 business days.</p>
        </Card>

        <Card className="space-y-2 border-border/80 bg-card/90 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground">Include when reporting abuse</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Link to the post or comment</li>
            <li>Short description of what happened</li>
            <li>Any safety concern that needs urgent attention</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
};

export default Contact;
