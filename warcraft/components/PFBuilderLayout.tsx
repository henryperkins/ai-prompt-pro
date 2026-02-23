import * as React from "react";
import { PFButton } from "./PFButton";
import { PFPanel } from "./PFPanel";
import { PFQualityGauge } from "./PFQualityGauge";

export type PFBuilderLayoutProps = {
  runeTileSrc?: string;
};

export function PFBuilderLayout({ runeTileSrc = "/pf/promptforge-rune-texture-tile-1024.png" }: PFBuilderLayoutProps) {
  return (
    <div className="relative min-h-screen">
      {/* Subtle rune texture behind everything */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: `url(${runeTileSrc})`, backgroundSize: "720px 720px" }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-4">
          <PFPanel className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[rgba(230,225,213,.65)]">Forge Menu</div>
                <div className="mt-1 font-extrabold">Prompt Builder</div>
              </div>
              <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] font-bold text-[rgba(230,225,213,.75)]">
                BETA
              </span>
            </div>

            <div className="mt-4 grid gap-2">
              <PFButton variant="primary" className="h-11 w-full">New Artifact</PFButton>
              <PFButton variant="secondary" className="h-11 w-full">Load Template</PFButton>
              <button className="pf-button pf-button-ghost h-11 w-full">Import</button>
            </div>

            <div className="mt-5 pf-divider" />

            <nav className="mt-4 grid gap-2 text-sm">
              <SidebarLink active label="Intent" hint="what you want" />
              <SidebarLink label="Inputs" hint="context + data" />
              <SidebarLink label="Constraints" hint="rules to follow" />
              <SidebarLink label="Output" hint="format + tone" />
              <SidebarLink label="Evaluation" hint="quality + tests" />
            </nav>
          </PFPanel>

          <PFPanel className="p-4">
            <div className="text-xs text-[rgba(230,225,213,.65)]">Quality score</div>
            <div className="mt-3">
              <PFQualityGauge value={78} />
            </div>
          </PFPanel>
        </aside>

        {/* Builder panel */}
        <main>
          <PFPanel className="p-6 md:p-7">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-xs text-[rgba(230,225,213,.65)]">Artifact</div>
                <div className="mt-1 text-2xl font-extrabold">New Prompt</div>
              </div>

              <div className="flex items-center gap-2">
                <button className="pf-button pf-button-ghost h-10 px-4 text-sm">Preview</button>
                <button className="pf-button pf-button-secondary h-10 px-4 text-sm">Save Draft</button>
                <button className="pf-button pf-button-primary h-10 px-4 text-sm">Forge</button>
              </div>
            </div>

            <div className="mt-5 pf-divider" />

            <Section title="Intent" subtitle="The single sentence that defines success.">
              <textarea
                className="pf-input mt-3 w-full resize-none px-4 py-3 text-sm"
                rows={4}
                placeholder="E.g. Generate a concise onboarding flow for a new user, with steps and edge cases..."
              />
            </Section>

            <Section title="Constraints" subtitle="Rules that keep outputs consistent and safe.">
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs text-[rgba(230,225,213,.65)]">Tone</div>
                  <input className="pf-input mt-2 w-full px-4 py-3 text-sm" placeholder="Mythic but professional" />
                </div>
                <div>
                  <div className="text-xs text-[rgba(230,225,213,.65)]">Length</div>
                  <input className="pf-input mt-2 w-full px-4 py-3 text-sm" placeholder="~200 words" />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs text-[rgba(230,225,213,.65)]">Must include</div>
                <input className="pf-input mt-2 w-full px-4 py-3 text-sm" placeholder="Bullets, headings, acceptance criteria" />
              </div>
            </Section>

            <Section title="Output" subtitle="Format & deliverable the model must produce.">
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/25 px-4 py-3">
                  <input type="radio" name="format" defaultChecked />
                  <div>
                    <div className="font-bold">Markdown</div>
                    <div className="text-xs text-[rgba(230,225,213,.65)]">Best for docs and sharing</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/25 px-4 py-3">
                  <input type="radio" name="format" />
                  <div>
                    <div className="font-bold">JSON</div>
                    <div className="text-xs text-[rgba(230,225,213,.65)]">Best for structured pipelines</div>
                  </div>
                </label>
              </div>
            </Section>
          </PFPanel>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ label, hint, active }: { label: string; hint: string; active?: boolean }) {
  return (
    <a
      href="#"
      className={[
        "rounded-2xl border px-3 py-2 transition",
        active
          ? "border-[rgba(18,200,181,.55)] bg-[rgba(18,200,181,.08)] shadow-[0_0_18px_rgba(18,200,181,.15)]"
          : "border-white/10 bg-black/20 hover:border-[rgba(214,166,64,.35)]",
      ].join(" ")}
    >
      <div className="font-bold">{label}</div>
      <div className="text-xs text-[rgba(230,225,213,.65)]">{hint}</div>
    </a>
  );
}

function Section({
  title,
  subtitle,
  children,
}: React.PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <section className="mt-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-lg font-extrabold">{title}</div>
          <div className="text-sm text-[rgba(230,225,213,.65)]">{subtitle}</div>
        </div>
        <div className="hidden sm:block w-36 pf-divider" />
      </div>
      {children}
    </section>
  );
}
