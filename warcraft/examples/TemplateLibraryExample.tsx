import * as React from "react";
import { PFTemplateCard } from "../components/PFTemplateCard";

export function TemplateLibraryExample() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="pf-text-display text-4xl">Template Library</h1>
        <p className="mt-2 text-[rgba(230,225,213,.70)]">
          Rarity frames map perfectly to quality tiers — Common → gray, Rare → arcane teal, Epic → ember, Legendary → gold.
        </p>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PFTemplateCard
            title="Daily Standup Summarizer"
            description="Turns raw meeting notes into crisp bullets, action items, and owners."
            rarity="common"
            tags={["Workflows", "Meetings"]}
          />
          <PFTemplateCard
            title="Product Spec Crafter"
            description="Generates a structured PRD with scope, constraints, risks, and acceptance criteria."
            rarity="rare"
            tags={["Product", "PRD", "Structure"]}
          />
          <PFTemplateCard
            title="Adversarial QA Spellbook"
            description="Finds edge cases and failure modes; produces tests and evaluation prompts."
            rarity="epic"
            tags={["QA", "Safety", "Evaluation"]}
          />
          <PFTemplateCard
            title="Legendary Launch Narrative"
            description="A cinematic yet business-safe launch story with positioning, key messages, and objections."
            rarity="legendary"
            tags={["Marketing", "Messaging"]}
          />
        </div>
      </div>
    </div>
  );
}
