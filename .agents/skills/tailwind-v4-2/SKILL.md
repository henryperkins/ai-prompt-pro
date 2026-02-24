---
name: tailwind-v4-2
description: Production guidance for Tailwind CSS v4 + shadcn/ui in Vite React projects. Use when setting up Tailwind v4, configuring shadcn, implementing dark mode, or fixing CSS variable and theme token issues.
---

# Tailwind v4 + shadcn Setup

Use this skill when the task involves:
- Initializing Tailwind CSS v4 in a React + Vite app
- Integrating shadcn/ui with Tailwind v4
- Configuring theme tokens and dark mode
- Fixing broken color variables or missing utility classes

## Workflow

1. Verify project uses `@tailwindcss/vite` and Tailwind v4-compatible setup.
2. Confirm CSS variable tokens are defined in `:root` and `.dark`.
3. Ensure `@theme inline` maps variables to utility tokens (for `bg-*`, `text-*`, etc.).
4. Validate shadcn configuration points to the correct CSS entry file.
5. Test theme toggle behavior and responsive styles on desktop and mobile.

## Guardrails

- Prefer CSS variables for semantic design tokens.
- Keep dark mode token definitions parallel to light mode tokens.
- Do not reintroduce Tailwind v3-only config patterns unless migration requires them.
- Preserve existing design system conventions when working in established codebases.
