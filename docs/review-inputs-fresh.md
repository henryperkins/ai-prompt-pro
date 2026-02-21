# PromptForge - Route and Flow Context

This document provides routing, feature, and interaction context for design/UX review. It describes the application's route structure, core user flows, and key features as implemented in the current codebase.

## Route Map

The application uses React Router with lazy-loaded routes:

| Route | Component | Purpose | Auth Required |
|-------|-----------|---------|---------------|
| `/` | Index.tsx | Main prompt builder interface | No (degraded mode for guests) |
| `/community` | Community.tsx | Public feed of shared prompts | No (read-only for guests) |
| `/community/:postId` | CommunityPost.tsx | Individual post detail with comments | No (read-only for guests) |
| `/library` | Library.tsx | User's saved prompt library | Yes (or localStorage for guests) |
| `/library/bulk-edit` | BulkEdit.tsx | Bulk edit interface for multiple saved prompts | Yes |
| `/presets` | Presets.tsx | Browse and load starter templates | No |
| `/history` | History.tsx | Version history for saved prompts | Yes |
| `/privacy` | Privacy.tsx | Privacy policy | No |
| `/terms` | Terms.tsx | Terms of service | No |
| `/contact` | Contact.tsx | Contact page | No |
| `*` | NotFound.tsx | Catch-all 404 handler | No |

All routes use Suspense fallbacks with "Loading..." text during lazy load.

## Core User Flows

### 1. Builder Flow (Primary Creation Path)

**Entry Points:**
- Direct load: navigate to `/`
- From preset: `/?preset=:id`
- From remix: `/?remix=:postId`
- From library load: navigate to `/` with template loaded

**Flow Phases:**

#### A) Initial State
- Hero section with headline and subheading
- Empty builder form with accordion sections (desktop) or stacked sections (mobile)
- No output displayed until first enhance or build
- Optional remix banner if loaded from community

#### B) Prompt Input
- User enters text in "Original Prompt" textarea
- Suggestion chips appear after typing (Phase 3 redesign feature)
- Real-time quality scoring updates
- Section health badges update: Empty → In Progress → Complete

#### C) Builder Configuration (Optional)
**Accordion sections (desktop) / Stacked sections (mobile):**

1. **Builder Section:**
   - Role selection (dropdown + custom text)
   - Task details (textarea)
   - Output format (multi-select chips + custom)
   - Constraints (chip selection + custom)
   - Examples (textarea)

2. **Context & Sources Section:**
   - Add context sources (URL, uploaded text)
   - Database connection configuration
   - RAG parameters
   - Structured context forms
   - Interview-style context collection
   - Project notes

3. **Tone & Style Section:**
   - Tone dropdown (Professional, Casual, Technical, Creative, Academic, Friendly)
   - Complexity slider (Beginner, Intermediate, Advanced, Expert)

4. **Quality Score Section:**
   - Real-time score 0-100
   - Component breakdown (role clarity, task specificity, etc.)
   - Health tips and suggestions

#### D) Enhancement (Optional)
- Click "Enhance" button (sticky bottom bar on mobile, output panel on desktop)
- Optional web search toggle (persisted in preferences)
- Streams AI enhancement via SSE or WebSocket
- Progress phases: starting → streaming → settling → done
- Shows reasoning summary separately
- Error recovery with graceful fallback

#### E) Output Review
**Desktop:** Split view with builder on left, output panel on right (sticky)
**Mobile:** Drawer-based output preview from bottom sticky bar

**Output Tabs:**
- Built Prompt: constructed from config fields
- Enhanced Prompt: AI-improved version (if enhancement run)
- Text Diff: visual comparison of built vs enhanced

**Output Actions:**
- Copy to clipboard
- Save version to library (requires auth or uses localStorage)
- Share to community (requires auth + use case field)

#### F) Save & Persist
- Auto-save draft state (localStorage for guests, cloud for authenticated)
- Named version save to library
- Version history tracking
- Template snapshot creation

**Exit Points:**
- Navigate to Library to view saved prompts
- Navigate to Community to browse related prompts
- Share to community and view public post

### 2. Library Flow (Personal Management)

**Entry:** Navigate to `/library`

**Features:**

#### A) List View
- Card grid display (responsive columns)
- Each card shows:
  - Prompt name, category, revision number
  - Private/Shared/Remixed badge
  - Owner avatar and name
  - Date updated
  - Description and starter prompt preview
  - Tags (first 5 displayed)
  - Context source count, database count

#### B) Search & Filter
- Search bar: searches name, tag, category, content
- Category filter dropdown
- Sort options: Most Recent, Name (A-Z), Revision (High)
- Real-time filtering with debounce

#### C) Bulk Operations
- Checkbox selection per card
- "Select All Filtered" option
- Bulk actions:
  - Edit tags, category (navigates to `/library/bulk-edit`)
  - Delete selected prompts

#### D) Individual Actions (Per Card)
- Load to Builder (navigates to `/`)
- Share to community (if use case present, requires auth)
- Unshare from community
- Delete prompt
- Disabled state with tooltip for actions requiring auth or missing fields

#### E) Performance
- Virtual list rendering for 50+ prompts
- Cached version summaries
- Optimistic UI updates

**Exit Points:**
- Load prompt → navigate to Builder
- Share prompt → creates community post, navigate to Community
- Navigate to History for version timeline

### 3. Community Flow (Discovery & Sharing)

**Entry:** Navigate to `/community`

**Features:**

#### A) Feed View
- Card grid of community posts (20 per page)
- Infinite scroll or "Load More" button
- Each card shows:
  - Post title (use case)
  - Author avatar, name, timestamp
  - Category badge with color
  - Upvote/downvote counts, verified badge
  - Tag chips
  - Prompt preview
  - Remix count

#### B) Discovery Controls
**Sort Options:**
- Trending (default)
- Newest
- Most Remixed
- Verified

**Filter:**
- Category filter (mobile: drawer sheet, desktop: dropdown)
- Search by title, use case, or keyword (250ms debounce)

**Mobile Enhancements (Feature Flag):**
- Filter sheet drawer
- Comment thread drawer
- One-tap mobile notifications

#### C) Post Interactions
- Upvote/downvote (requires auth)
- Mark as verified (if applicable, requires auth)
- Copy prompt to clipboard
- Remix to Builder (navigates to `/?remix=:postId`)
- View detail (navigates to `/community/:postId`)
- Block/unblock user (requires auth)
- Report post (requires auth)

#### D) Telemetry
- Vote interactions
- Filter changes
- Comment thread opens
- Mobile-specific events

**Exit Points:**
- Click post → navigate to post detail
- Remix → navigate to Builder with remix context
- Author profile → future feature

### 4. Community Post Detail Flow

**Entry:** Navigate to `/community/:postId`

**Features:**

#### A) Post Content
- Full post header (title, author, category, tags)
- Enhanced prompt (primary display)
- Built prompt (collapsible)
- Vote counts and verified status
- Remix attribution (if remixed from another post)

#### B) Remix Chain
- Shows parent post if this is a remix
- Shows child remixes (derivatives of this post)
- Visual hierarchy of remix relationships

#### C) Comment Thread
- Nested comments
- Add comment (requires auth)
- Vote on comments
- Report comments
- Block comment authors

#### D) Actions
- Vote on post
- Save to library (creates private copy, requires auth)
- Remix to Builder
- Copy prompt
- Report post
- Block author

**Exit Points:**
- Remix parent → navigate to parent post detail
- Remix to Builder → navigate to Builder with context
- Save to library → confirm toast, stay on page or navigate to Library

### 5. Presets Flow (Template Discovery)

**Entry:** Navigate to `/presets`

**Categories:**
General, Frontend, Backend, Fullstack, DevOps, Data, ML-AI, Security, Testing, API, Automation, Docs

**Features:**

#### A) Browse
- Category filter with color-coded cards
- Search by name, description, category
- Each preset card shows:
  - Name and emoji indicator
  - Description
  - Starter prompt preview
  - Role, tone, complexity, format

#### B) Load Preset
- Click "Use Preset" button
- Navigates to Builder with `/?preset=:id` param
- Builder loads template configuration
- User can immediately enhance or modify

**Exit Points:**
- Use preset → navigate to Builder with template loaded

### 6. History Flow (Version Timeline)

**Entry:** Navigate to `/history`

**Features:**

#### A) Version List
- Chronological list of all saved versions
- Each version shows:
  - Timestamp
  - Prompt name
  - Preview of prompt content

#### B) Restore
- Click version to restore to Builder
- Navigates to Builder with version loaded
- User can continue editing from that snapshot

**Exit Points:**
- Restore version → navigate to Builder

## State Management Architecture

### Core Hooks

#### `usePromptBuilder()` (Primary State Hub)
Manages entire builder state and persistence.

**Returns:**
- `config`: Current PromptConfig object
- `updateConfig()`: Batch config updates
- `builtPrompt`: Assembled prompt text
- `score`: Quality metrics (0-100)
- `enhancedPrompt`: AI-enhanced version
- `setEnhancedPrompt()`: Update enhanced output
- `isEnhancing`: Enhancement in progress boolean
- `versions`: Saved version history array
- `templateSummaries`: Saved prompts list
- `remixContext`: Current remix mode info
- Save/share/load functions
- Template management functions

#### `useContextConfig()`
Extracted context config updaters (composition pattern).

**Returns callbacks:**
- `updateContextSources()`: Add/update sources
- `updateDatabaseConnections()`: Database config
- `updateRagParameters()`: RAG settings
- `updateContextStructured()`: Structured data
- `updateContextInterview()`: Interview responses
- `updateProjectNotes()`: Project documentation

#### `useDraftPersistence()`
Tracks dirty state and auto-save.

**Handles:**
- Guest → authenticated migration
- localStorage vs cloud sync
- Dirty state tracking
- Auto-save throttling

#### `useAuth()`
Neon Auth (Better Auth) context.

**Provides:**
- Current user object
- Sign in/out methods
- Auth loading state
- Auth error handling

#### Other Hooks
- `useIsMobile()`: Breakpoint detection (768px)
- `useToast()`: Toast notifications
- `useCommunityMobileTelemetry()`: Mobile tracking
- `useNotifications()`: Push notifications

### Data Flow Patterns

**Persistence Layer (Dual-Path):**
- **Guest users:** localStorage with local template summaries
- **Authenticated users:** Neon Postgres via PostgREST Data API
- **Config versioning:** V1/V2 adapters for backward compatibility
- **Template fingerprinting:** Deduplication and conflict resolution

**State Hierarchy:**
```
App (Auth + Theme Provider)
├── Index/Builder
│   ├── usePromptBuilder (main state)
│   ├── useContextConfig (context updaters)
│   ├── BuilderTabs (display)
│   ├── ContextPanel (display)
│   ├── OutputPanel (desktop) or Drawer (mobile)
│   └── Enhancement state + telemetry
├── Community
│   ├── Feed state (posts, sorting, filtering)
│   ├── Author profiles cache
│   ├── Vote states (optimistic updates)
│   └── Block/moderation state
└── Library
    ├── Filtered/sorted saved prompts
    ├── Selection state
    └── Bulk operations state
```

## Mobile vs Desktop Differences

### Layout

**Desktop:**
- Two-column layout: builder (left 60%) + output panel (right 40%, sticky)
- Accordion sections (expandable/collapsible)
- Inline controls with desktop spacing
- Sidebar navigation (if applicable)

**Mobile:**
- Single column stacked layout
- All sections expanded by default (or Phase 2+ redesign variations)
- Drawer-based output preview
- Sticky bottom bar with enhance button
- Bottom navigation bar (Home, Community, Library, More)
- Sheet-based filters and selection
- Safe area padding for notch/home indicator

### Interactions

**Desktop:**
- Hover states on cards and buttons
- Dropdown menus for filters and actions
- Inline tooltips
- Keyboard shortcuts (Ctrl+Enter for enhance)

**Mobile:**
- Touch-optimized tap targets (44px minimum)
- Drawer sheets for filters and selections
- Long-press gestures (optional)
- Pull-to-refresh (optional)
- Swipe gestures for navigation (optional)

### Responsive Breakpoints

**Current implementation:**
- `useIsMobile()`: 768px
- Tailwind `sm`: 640px
- **Note:** Mismatch between hook and Tailwind breakpoints causes 640-767px inconsistencies (documented in ux-review-prioritized.md as P0 issue)

## Feature Flags

Active feature flags control UX variations:

1. **`VITE_COMMUNITY_MOBILE_ENHANCEMENTS`** (default: false)
   - Enables mobile-specific Community behaviors
   - Filter drawer, comment thread drawers
   - One-tap mobile notifications

2. **`VITE_BUILDER_REDESIGN_PHASE1`** (default: true)
   - Initial builder redesign improvements

3. **`VITE_BUILDER_REDESIGN_PHASE2`** (default: false)
   - Progressive disclosure enhancements

4. **`VITE_BUILDER_REDESIGN_PHASE3`** (default: false)
   - Suggestion chips and advanced context

5. **`VITE_BUILDER_REDESIGN_PHASE4`** (default: false)
   - Advanced template system

## Error States and Edge Cases

### Authentication-Dependent Features

**Requires Sign In:**
- Share to community
- Vote on posts/comments
- Add comments
- Block users
- Save to cloud library (falls back to localStorage)

**Graceful Degradation:**
- Builder works fully offline for guests
- Community is read-only for guests
- Library uses localStorage for guests
- Auth prompts appear inline when needed

### Network Error Handling

**Community Feed/Post:**
- Error state card with retry action
- Contextual error messages (network, auth, not found)
- Fallback to cached data if available

**Enhancement:**
- Graceful fallback on stream errors
- Partial results preserved
- User can retry or continue with built prompt

**Persistence:**
- Conflict resolution for cloud sync
- Optimistic updates with rollback
- User-friendly error messages

### Empty States

**Library (No Saved Prompts):**
- Friendly empty state with CTA to create first prompt
- Visual illustration or icon
- Clear next action

**Community (No Results):**
- Empty search results state
- Suggestions to adjust filters or search terms
- CTA to browse all or share own prompt

**History (No Versions):**
- Empty state explaining version history
- CTA to save first version from Builder

## Performance Characteristics

### Optimizations

1. **Lazy Route Loading:** All routes use React.lazy() and Suspense
2. **Virtual Lists:** 50+ items use virtualization
3. **Debounced Search:** 250ms debounce on search inputs
4. **Optimistic UI:** Vote states update immediately before server confirmation
5. **Request Tokens:** Race condition prevention for async operations
6. **Cloud Version Caching:** Local fallback with cloud sync
7. **Component Code Splitting:** Large components lazy-loaded

### Known Performance Considerations

1. **Builder Initial Render:** Large component tree, Phase 2+ adds lazy mounting
2. **Community Feed:** 20 posts per page, infinite scroll can accumulate DOM
3. **Mobile Background:** Fixed radial gradients can impact scroll repaint (documented in ux-review-prioritized.md)
4. **Desktop Sticky Output:** Continuous re-render on config changes

## Accessibility Features

1. **Keyboard Navigation:** Full keyboard support with visible focus states
2. **Screen Reader Labels:** Semantic HTML and ARIA labels
3. **Touch Targets:** 44px minimum on mobile
4. **Contrast:** Semantic color tokens with theme support
5. **Reduced Motion:** Respects prefers-reduced-motion
6. **Focus Management:** Modal/drawer focus trapping

## Known UX Issues

See `docs/ux-review-prioritized.md` for comprehensive UX audit findings. Key highlights:

**P0 (Critical):**
- App crashes on startup if Neon env vars missing
- No retry paths for Community errors
- Breakpoint mismatch (768px hook vs 640px Tailwind)
- Missing keyboard focus in Community search

**P1 (High Priority):**
- Presets hidden on mobile
- Builder first-screen cognitive overload
- Low readability in state cards
- Disabled action reasons hidden in tooltips
- Community card semantic issues
- Mobile sticky bar touch comfort
- Library action overload on mobile

**P2 (Nice to Have):**
- List virtualization gaps
- Generic loading states
- Mobile background repaint cost
- Density token inconsistency

## Design System Reference

See `docs/design-system.md` for complete design system documentation.

**Key Systems:**
- Semantic color tokens (HSL)
- Typography scale with responsive sizing
- Component height standards (mobile vs desktop)
- Radius, shadow, spacing tokens
- Motion and interaction patterns
- Community typography subsystem
- Apple HIG alignment checklist

## Launch Asset References

See `docs/launch-assets-pack.md` for:
- Product screenshots (desktop and mobile 390px)
- Social preview assets
- Announcement copy
- App listing descriptions
