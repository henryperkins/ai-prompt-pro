# Design System State Matrix Template

Last updated: 2026-03-06

Use this template to verify state coverage before merging primitive/component changes. Treat each row as a required evidence checkpoint (Storybook story, test assertion, screenshot, or QA recording).

## Scope

Apply this template to core primitives and any app-level wrapper that introduces variant, density, or interaction behavior.

## Core State Matrix

| Component | Variant/Tone coverage | Size/Density coverage | Rest | Hover | Focus-visible | Active/Pressed | Disabled | Loading/Busy | Error/Invalid | Read-only | Reduced motion behavior | Mobile touch target >=44px | Evidence links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Button |  |  |  |  |  |  |  |  | n/a | n/a |  |  |  |
| Input |  |  |  |  |  | n/a |  | n/a |  |  | n/a |  |  |
| Select |  |  |  |  |  |  |  | n/a |  | n/a | n/a |  |  |
| Checkbox |  |  |  |  |  |  |  | n/a | n/a | n/a | n/a |  |  |
| Textarea |  |  |  |  |  | n/a |  | n/a |  |  | n/a |  |  |
| Dialog/Drawer triggers |  |  |  |  |  |  |  | n/a | n/a | n/a |  |  |  |
| Tabs |  |  |  |  |  |  |  | n/a | n/a | n/a | n/a |  |  |
| Table actions (header/cell controls) |  |  |  |  |  |  |  | n/a | n/a | n/a | n/a |  |  |

## Content and Accessibility Checks

| Checkpoint | Pass/Fail | Notes |
| --- | --- | --- |
| Non-color cues exist for error/success/warning states (iconography/text/shape). |  |  |
| Focus indicator meets contrast and is not visually clipped. |  |  |
| Disabled state communicates reason where user action is blocked. |  |  |
| Keyboard order and semantics are valid for all interactive states. |  |  |
| Screen-reader labels and descriptions remain stable across state transitions. |  |  |
| Visual state changes avoid layout shift for primary controls. |  |  |

## Required Verification Artifacts

| Artifact | Location | Complete |
| --- | --- | --- |
| Storybook stories covering each row in the Core State Matrix |  |  |
| Unit/integration tests for focus, invalid, and disabled behavior |  |  |
| Mobile Playwright evidence for touch target and overflow behavior |  |  |
| Dark + standard theme screenshots for critical components |  |  |

## Sign-off

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Design Systems |  |  |  |
| Accessibility |  |  |  |
| Frontend |  |  |  |
