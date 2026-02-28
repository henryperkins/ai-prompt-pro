import { describe, expect, it } from "vitest";
import type { PromptTemplate } from "@/lib/templates";
import {
  filterPresetTemplates,
  getPresetCategories,
  hasActivePresetFilters,
  rankPresetTemplates,
  splitPresetSections,
} from "@/lib/preset-catalog";

const templates: PromptTemplate[] = [
  {
    id: "beta",
    name: "Beta",
    category: "general",
    description: "General writing helper",
    starterPrompt: "Draft an email",
    role: "Writer",
    task: "Write content",
    context: "Marketing",
    format: ["Markdown"],
    lengthPreference: "standard",
    tone: "Professional",
    complexity: "Moderate",
    constraints: [],
    examples: "",
  },
  {
    id: "alpha",
    name: "Alpha",
    category: "testing",
    description: "Testing helper",
    starterPrompt: "Review flaky tests",
    role: "QA Engineer",
    task: "Review tests",
    context: "CI",
    format: ["Bullet points"],
    lengthPreference: "brief",
    tone: "Technical",
    complexity: "Advanced",
    constraints: [],
    examples: "",
  },
  {
    id: "gamma",
    name: "Gamma",
    category: "docs",
    description: "Docs helper",
    starterPrompt: "Write release notes",
    role: "Docs writer",
    task: "Write docs",
    context: "Release",
    format: ["Paragraph form"],
    lengthPreference: "standard",
    tone: "Casual",
    complexity: "Simple",
    constraints: [],
    examples: "",
  },
];

describe("preset-catalog helpers", () => {
  it("returns only used categories with all first", () => {
    expect(getPresetCategories(templates)).toEqual(["all", "general", "testing", "docs"]);
  });

  it("detects active filters", () => {
    expect(hasActivePresetFilters("all", "")).toBe(false);
    expect(hasActivePresetFilters("testing", "")).toBe(true);
    expect(hasActivePresetFilters("all", "release")).toBe(true);
  });

  it("filters by category and query across searchable fields", () => {
    const byCategory = filterPresetTemplates({
      items: templates,
      activeCategory: "testing",
      query: "",
    });
    expect(byCategory.map((item) => item.id)).toEqual(["alpha"]);

    const byTone = filterPresetTemplates({
      items: templates,
      activeCategory: "all",
      query: "technical",
    });
    expect(byTone.map((item) => item.id)).toEqual(["alpha"]);
  });

  it("ranks favorites first, then recents, then alphabetically", () => {
    const ranked = rankPresetTemplates({
      items: templates,
      favoritePresetIds: ["gamma"],
      recentlyUsedPresetIds: ["beta"],
    });
    expect(ranked.map((item) => item.id)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("splits sections without duplication", () => {
    const ranked = rankPresetTemplates({
      items: templates,
      favoritePresetIds: ["gamma", "alpha"],
      recentlyUsedPresetIds: ["alpha"],
    });
    const sections = splitPresetSections({
      items: ranked,
      favoritePresetIds: ["gamma", "alpha"],
      recentlyUsedPresetIds: ["alpha"],
      hasActiveFilters: false,
    });

    expect(sections.recent.map((item) => item.id)).toEqual(["alpha"]);
    expect(sections.favorites.map((item) => item.id)).toEqual(["gamma"]);
    expect(sections.all.map((item) => item.id)).toEqual(["beta"]);
  });

  it("returns only all section when filters are active", () => {
    const sections = splitPresetSections({
      items: templates,
      favoritePresetIds: ["gamma"],
      recentlyUsedPresetIds: ["alpha"],
      hasActiveFilters: true,
    });

    expect(sections.recent).toEqual([]);
    expect(sections.favorites).toEqual([]);
    expect(sections.all.map((item) => item.id)).toEqual(["beta", "alpha", "gamma"]);
  });
});

