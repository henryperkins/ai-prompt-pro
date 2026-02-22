import { PFButton } from "@/components/fantasy/PFButton";
import { PFPanel } from "@/components/fantasy/PFPanel";
import { PFQualityGauge } from "@/components/fantasy/PFQualityGauge";

export function PFBuilderLayout() {
    return (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-4">
                <PFPanel className="p-4">
                    <h3 className="pf-text-display text-lg text-[rgba(230,225,213,.96)]">Forge Settings</h3>
                    <p className="mt-1 text-xs text-[rgba(230,225,213,.68)]">Tune your artifact before final smithing.</p>

                    <div className="mt-4 space-y-3">
                        <label className="block text-xs font-semibold text-[rgba(230,225,213,.75)]">Role</label>
                        <input className="pf-input h-11 w-full px-3 text-sm" placeholder="e.g., Senior Technical PM" />

                        <label className="block text-xs font-semibold text-[rgba(230,225,213,.75)]">Constraints</label>
                        <textarea
                            className="pf-input min-h-24 w-full resize-y px-3 py-2 text-sm"
                            placeholder="Include acceptance criteria, edge cases, and non-goals"
                        />
                    </div>
                </PFPanel>

                <PFPanel className="p-4">
                    <h4 className="text-sm font-bold text-[rgba(230,225,213,.95)]">Quality Signal</h4>
                    <p className="mt-1 text-xs text-[rgba(230,225,213,.7)]">Rarity unlocks as structure and clarity improve.</p>
                    <div className="mt-3">
                        <PFQualityGauge value={78} size={112} />
                    </div>
                </PFPanel>
            </aside>

            <main>
                <PFPanel gilded className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="pf-text-display text-2xl text-[rgba(230,225,213,.95)]">Prompt Builder</h2>
                        <div className="flex items-center gap-2">
                            <PFButton variant="secondary">Preview</PFButton>
                            <PFButton variant="primary">Enhance</PFButton>
                        </div>
                    </div>

                    <div className="mt-3 pf-divider" />

                    <div className="mt-4 grid gap-3">
                        <textarea
                            className="pf-input min-h-52.5 w-full resize-y px-4 py-3 text-sm leading-relaxed"
                            placeholder="Paste or draft your rough prompt here..."
                        />

                        <div className="grid gap-3 sm:grid-cols-3">
                            <input className="pf-input h-11 px-3 text-sm" placeholder="Tone" />
                            <input className="pf-input h-11 px-3 text-sm" placeholder="Format" />
                            <input className="pf-input h-11 px-3 text-sm" placeholder="Audience" />
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <PFButton variant="ghost">Arcane</PFButton>
                        <PFButton variant="ghost">Rare</PFButton>
                        <PFButton variant="ghost">Ember</PFButton>
                    </div>
                </PFPanel>
            </main>
        </div>
    );
}