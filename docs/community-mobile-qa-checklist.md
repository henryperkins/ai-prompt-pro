# Community Mobile UX QA Checklist

Feature flag: `VITE_COMMUNITY_MOBILE_ENHANCEMENTS=true`

## iOS Safari and Android Chrome

1. Open `/community` at 320, 375, 390, and 428 widths.
2. Confirm critical controls are at least 44x44px (filter trigger, sort buttons, remix CTA, vote buttons, comment thread trigger).
3. Confirm no horizontal overflow on feed and post detail.
4. Open the filter drawer, select a category, and verify the drawer closes and selected category text updates.
5. Open a feed card comment thread from `Comments`; verify drawer opens and can be dismissed.
6. Open a post detail page and open comments thread; verify drawer opens and comment list renders.
7. Verify mobile notifications bell appears in the header for signed-in users.
8. Tap notifications bell once; verify notifications drawer opens and list is interactive.
9. Scroll to page bottom on `/community` and `/community/:id`; verify content is not clipped behind the bottom nav.
10. Rotate device portrait/landscape and repeat steps 4, 6, and 9.

## Rollout Safety

1. Set `VITE_COMMUNITY_MOBILE_ENHANCEMENTS=false`.
2. Verify mobile filter drawer trigger is hidden.
3. Verify mobile notifications bell trigger is hidden.
4. Verify desktop `/community` and `/community/:id` behavior is unchanged.
