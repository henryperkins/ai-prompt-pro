/**
 * Public textarea entrypoint – import from "@/components/base/textarea".
 *
 * Exports:
 *  - Textarea  – legacy HTML-native textarea with basic DS styling (standard
 *                <textarea> attributes).  Deprecated; prefer TextArea for new code.
 *  - TextArea  – DS-owned React Aria field with label / hint / tooltip support.
 *
 * TextAreaBase is DS-internal – do not import it from feature code.
 */

/**
 * @deprecated Use `TextArea` from this module for new code.  `Textarea` is a
 * thin HTML-native wrapper kept for backward compatibility.
 * TODO(ds-refactor): Migrate remaining consumers to TextArea (target: 2026-09-30).
 */
export { Textarea } from "@/components/base/primitives/textarea";
export type { TextareaProps } from "@/components/base/primitives/textarea";

export { TextArea } from "@/components/base/textarea/textarea";
