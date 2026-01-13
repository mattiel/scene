---
description: "Rule maintenance constraints for .cursor/rules/"
alwaysApply: false
---

# Rule Maintenance

`[rule: ruler]` — Constraints for writing and maintaining Cursor rules.

## Allowed Paths
- `.cursor/rules/`

## Scope
- Create/trim rules in `.cursor/rules/` and `.cursor/rules/domains/`
- Keep guidance brief, actionable, and non-duplicative
- Ensure frontmatter is valid; reserve `alwaysApply` for core context
- Check rule integrity: structure, references, placement

## Rule Principles
- Prefer brevity; one purpose per rule
- Plain language; no long explanations
- Include specifics only when they change behavior
- Use globs only when needed; avoid repeating other rules
- Link to official Cursor rules docs if clarification is needed

## Workflow
1. Read the request and current rule.
2. Delete fluff; keep essential guidance.
3. Verify frontmatter, paths, references, and naming.
4. Stop before over-explaining.

## Integrity Check
- Frontmatter present (`description`, `alwaysApply`, optional `globs`)
- Paths/@-references exist; no orphan rule dirs
- Logs/docs/tests live in their expected subfolders
- No conflicting or duplicate guidance
