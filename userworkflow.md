I traced the implemented journey end-to-end, and the short version is: the workflow is strong for serious iteration, but it turns into expert mode a bit too fast.

Big-picture read
The actual user flow is a two-lane loop:

Left side: compose and shape the prompt
Right side: preview, enhance, inspect, and iterate
In product terms, PromptForge is not behaving like a simple “paste text, get better text” enhancer. It’s behaving like a prompt workbench.

That’s an important distinction, because the workflow is excellent if the goal is control + transparency, and a bit heavy if the goal is simplicity + speed.

The current workflow, as a user experiences it
1. Start with a rough prompt
The journey begins in BuilderHeroInput in BuilderHeroInput.tsx:

a big primary textarea
character count
clear/reset actions
optional detected-intent chips
optional “Smart suggestions”
This is good. It gives the user a very obvious first move: type what you want.

2. Optionally accept AI help before enhancing
Still in the hero area, the user can:

accept smart suggestion chips
override detected intent
reset AI-inferred details
This is useful, but it introduces decision-making before the user has seen the core payoff. For experienced users, great. For first-timers, slightly “wait, do I need to configure this already?”

3. Optionally reveal advanced controls
BuilderAdjustDetails in BuilderAdjustDetails.tsx is progressive disclosure done reasonably well:

role and voice
output shape
constraints
examples
This is a good design choice. The workflow does not force all structure upfront.

4. Preview exists before the first enhance
This is one of the better workflow choices.

OutputPanel in OutputPanel.tsx can show a built prompt before the user has enhanced anything. The tests in output-panel-phase2.test.tsx and index-ux-friction-improvements.test.tsx confirm that:

preview is available from builder fields
copy/save tools unlock once there’s useful preview content
the onboarding card disappears once the user starts writing
That means the workflow avoids a dead-end “nothing useful happens until AI runs” state. Nice.

5. The user gets a quality signal before committing
On desktop, Index.tsx shows a Quality signal card above the output area.

This creates a pre-enhancement feedback loop:

“My prompt is currently weak/strong”
“Here’s which dimensions are thin”
“I could fix this before enhancing”
That is a smart workflow idea.

6. Enhance with explicit settings
The actual enhance action lives in OutputPanelEnhanceControls in OutputPanelEnhanceControls.tsx and includes:

web lookup
enhancement depth
rewrite strictness
ambiguity mode
enhance button
This is a very power-user-friendly step. It gives the user control over how invasive the enhancer should be.

7. Post-enhancement becomes a review workflow
After enhancement, the right rail expands into several review layers:

OutputPanelHeader — copy/save/compare/dev tools
OutputPanelEnhancementSummary — detected context, changes, watch-outs, suggestions, variants
EnhancementClarificationCard — ambiguity questions
EnhancementInspector — structured breakdown and apply-back actions
At this point, the workflow changes from:

“Help me improve my prompt”

to:

“Help me inspect, validate, and operationalize the AI’s reasoning.”

That’s powerful, but it’s a mode shift.

8. Iterate or reintegrate
The user can then:

use shorter/more detailed versions
compare changes
mark “too much changed”
apply pieces back to the builder
add questions to the prompt
add content to session context
save/share/version the result
This is the strongest part of the workflow for advanced users. It supports real iteration rather than just one-shot generation.

What works really well
Strong feedback loop
The workflow gives feedback at multiple stages:

pre-enhance preview
quality signal
streaming status
compare view
change summary
clarification questions
structured breakdown
That builds trust.

Good progressive disclosure on the left
The core input is simple, and advanced shaping is hidden until needed. That’s a healthy workflow foundation.

Great iteration tools after enhance
The post-enhance workflow is not a black box. Users can:

inspect what changed
choose variants
push structure back into the builder
preserve session context
save versions
That’s unusually mature.

The product respects uncertainty
The clarification card in EnhancementClarificationCard.tsx is a strong workflow choice. It says, essentially:

“This output is provisional until you answer these questions.”

That is much better than overconfident guessing.

Where the workflow gets shaky
The first-run experience is heavier than it looks
The left side starts simple, but once the user enhances, the workflow becomes dense very quickly.

A first-time user suddenly has to parse:

summary
watch-outs
open questions
assumptions
variants
structured breakdown
session context actions
builder apply-back actions
That’s a lot of UX surface area after one click.

The right rail mixes too many time horizons
The same rail contains:

current result
explanation of what just happened
settings for the next run
tools for editing the builder
session/history workflow
That creates a “what part of the process am I in?” problem.

Action scopes are not naturally obvious
This is the biggest workflow ambiguity.

Different actions affect different destinations:

Use shorter → changes visible output
Apply to builder → changes left-side fields
Add questions to prompt → changes prompt content
Add to session context → changes Codex carry-forward state
Those are four different scopes. The workflow supports them, but the mental model is expensive.

The quality signal is easy to misread
This is a subtle but important workflow issue.

The top score in Index.tsx is based on the builder’s score model, while enhancement metadata also has its own concept of quality in enhance-metadata.ts.

A user could easily assume the score means:

“the AI thinks this enhanced prompt is high quality”

when it more likely means:

“the builder currently looks structurally healthy”

Workflow-wise, that muddies the meaning of the signal.

Some secondary workflow elements are a bit too prominent
Things like:

session drawer state
reset enhancement preferences
history reminders
are useful, but they are not core to the main happy path:
write → enhance → review → iterate/save.

They add capability, but also add noise.

Desktop vs mobile workflow
Desktop
Desktop is the stronger implementation.

The side-by-side layout in Index.tsx supports a nice loop:

edit on the left
inspect on the right
iterate quickly
That’s a good productivity workflow.

Mobile
Mobile simplifies the flow by moving the output to a drawer and settings to a sheet.

That helps reduce clutter, but it also makes the workflow more modal:

open preview drawer
close drawer
open settings sheet
go back
enhance again
So mobile is workable, but less fluid for deep iteration.

My scorecard
Here’s my blunt UX grading for the workflow as implemented:

Dimension	Score	Read
Learnability	6.5/10	Good starting point, but post-enhance complexity ramps up fast
Feedback & trust	8.5/10	Excellent transparency and review surfaces
User control	9/10	Very strong; lots of intentionality
Cognitive load	5.5/10	High once metadata/inspector actions appear
Iteration speed	8/10	Strong on desktop, especially for returning users
First-time friendliness	6/10	Adequate, but the second half feels expert-oriented
Power-user fit	9/10	This is where the workflow shines
Overall verdict
This is a very good power-user workflow and a moderately heavy mainstream workflow.

If the product goal is:

transparent, inspectable, high-control prompt engineering
the workflow is strong
If the product goal is:

fast, simple, mostly one-click enhancement
the workflow is currently too dense after enhancement
The best one-line summary is:

The workflow starts like a simple enhancer, but resolves into a professional review-and-iteration tool.