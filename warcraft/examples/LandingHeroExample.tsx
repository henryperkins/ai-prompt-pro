import * as React from "react";
import { PFHeroNavbar } from "../components/PFHeroNavbar";

export function LandingHeroExample() {
  return (
    <div>
      <PFHeroNavbar />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="pf-text-display text-3xl">Featured Artifacts</h2>
        <p className="mt-2 text-[rgba(230,225,213,.72)]">
          Drop this hero into your <code>Index.tsx</code> header area to sell the vibe immediately.
        </p>
      </main>
    </div>
  );
}
