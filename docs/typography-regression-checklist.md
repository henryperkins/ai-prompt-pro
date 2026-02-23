# Typography Regression Checklist

Use this checklist when reviewing typography changes.

## Routes
- `/`
- `/community`
- `/privacy`
- `/terms`

## Viewports
- `390x844` (mobile baseline)
- `1280x900` (desktop baseline)

## Checks
- Body text size is readable (`14px+` mobile, `16px+` desktop).
- Input and textarea text remains `16px` to avoid iOS focus zoom.
- Hero subtitle text is not `text-xs` on mobile.
- UI labels in all-caps are `12px+` with consistent tracking.
- Community helper/meta text is not below `12px`.
- Long-form prose line length stays in readable range on desktop (`~45–75` chars per line).

## Automated Guardrail
- Run `npm run test:mobile -- --grep "Typography guardrails"` to validate core typography thresholds.
