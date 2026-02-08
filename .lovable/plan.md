

## Plan: Drag-and-Drop File Upload + URL Auto-Fetch

### Overview

Two new capabilities for the context source chips:

1. **Drag-and-drop file upload** -- Users can drop text-based files (`.txt`, `.md`, `.csv`, `.json`, `.xml`) directly onto the context panel. The file contents are read in the browser and auto-summarized into a compact source chip.

2. **URL auto-fetch** -- When users paste a URL, a new edge function fetches the page content via the AI gateway, extracts the key passages, and populates the source chip automatically (no manual copy-paste needed).

---

### Feature 1: Drag-and-Drop File Upload

**What the user sees:**
- A dashed drop zone appears at the top of the Sources section with the text "Drop files here (.txt, .md, .csv, .json)"
- When a file is dragged over the area, the zone highlights with a visual accent border
- On drop, the file is read in the browser, auto-summarized, and added as a "file" type chip
- Multiple files can be dropped at once
- A loading spinner shows briefly while the file is being read
- Unsupported file types show a toast error

**Files changed:**
- `src/components/ContextSourceChips.tsx` -- Add drag-and-drop event handlers (`onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop`) wrapping the component. Use the browser `FileReader` API to read text-based files. Call `summarizeSource()` on the content and invoke `onAdd()` with a source of type `"file"`.

**Supported formats:** `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.log`, `.yaml`, `.yml` (all read as plain text via `FileReader.readAsText`).

---

### Feature 2: URL Auto-Fetch

**What the user sees:**
- In the "Add source" dialog, when the user selects the URL mode, there is now a URL input field and a "Fetch & Extract" button
- The user pastes a URL and clicks the button (or the content area is still available for manual paste as a fallback)
- A loading spinner appears while the edge function fetches and summarizes the page
- On success, the extracted key passages populate the content textarea automatically, and the title field is set to the page's domain
- The user can review/edit the extracted content before clicking "Add source"
- On error (e.g., unreachable URL), a toast message explains the issue and the user can still paste content manually

**Files changed:**

1. **New edge function: `supabase/functions/extract-url/index.ts`**
   - Accepts `{ url: string }` in the request body
   - Fetches the URL's HTML content server-side using `fetch()`
   - Strips HTML tags to extract plain text (lightweight regex-based stripping -- no heavy dependencies)
   - Truncates to a reasonable limit (~8,000 characters) to stay within token budgets
   - Sends the extracted text to the Lovable AI gateway with a system prompt instructing it to produce 5-10 concise bullet points of the key information
   - Returns `{ title: string, content: string }` as JSON (non-streaming, since this is a short extraction task)
   - Uses CORS headers and `verify_jwt = false` (same pattern as `enhance-prompt`)
   - Uses the existing `LOVABLE_API_KEY` secret

2. **`supabase/config.toml`** -- Add the new function entry:
   ```toml
   [functions.extract-url]
   verify_jwt = false
   ```

3. **`src/lib/ai-client.ts`** -- Add a new `extractUrl()` function that calls the `extract-url` edge function and returns the extracted title and content. This is a simple `fetch` + JSON response (no streaming needed).

4. **`src/components/ContextSourceChips.tsx`** -- Update the URL mode UI:
   - Add a "Fetch & Extract" button next to the URL input
   - When clicked, call `extractUrl()` from `ai-client.ts`
   - On success, populate the content textarea and title field with the results
   - Show a loading state on the button while fetching
   - Keep manual paste as a fallback (the textarea remains editable)

---

### Technical Details

**Drag-and-drop implementation (browser-only, no server):**
```text
ContextSourceChips component
  +-- Drop zone wrapper div (onDragOver, onDrop, etc.)
  |     +-- Visual indicator (dashed border, highlight on dragover)
  +-- Existing chip list and dialog
```

- `onDrop` handler reads each file via `FileReader.readAsText()`
- File size guard: reject files larger than 500KB with a toast warning
- Each file becomes a `ContextSource` with `type: "file"`, title set to filename

**URL extraction edge function flow:**
```text
Browser                    Edge Function              AI Gateway
  |                            |                          |
  |-- POST {url} ------------>|                          |
  |                            |-- fetch(url) ---------->| (target website)
  |                            |<-- HTML response -------|
  |                            |-- strip HTML, truncate  |
  |                            |-- POST chat/completions |
  |                            |   "Extract key points"  |
  |                            |<-- bullet points -------|
  |<-- {title, content} ------|                          |
```

**Edge function system prompt for extraction:**
> "You are a content extractor. Given raw text from a web page, extract the 5-10 most important and relevant points as concise bullet points. Focus on facts, data, and key claims. Omit navigation text, ads, and boilerplate. Return only the bullet points, one per line, prefixed with a bullet character."

