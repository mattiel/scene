---
description: "Delegation and attribution standards for multi-domain work"
alwaysApply: true
---

# Orchestration

Standards for delegating work and tracking rule application.

## Announcement Format

When a domain rule is applied, announce at the start:

```
[rule: <name>] Applying constraints for <brief-scope>
```

Example: `[rule: webgpu] Applying constraints for renderer work`

## Delegation Rules

### MUST
- Delegate domain work to exactly ONE domain rule per subtask
- Structure each subtask with: GOAL, NON-GOALS, ALLOWED_PATHS, VALIDATION
- Read project plan and spec before starting phased work
- Use descriptive feature branches: `feat/<area>`

### MUST NOT
- Implement code across multiple domains without delegation
- Proceed with ambiguous scope without clarification
- Skip the announcement format

### MAY (glue code only)
- Edit `packages/core/` for integration
- Update root config files
- Create/update logs in `.cursor/logs/`

## Attribution

- Docs/logs: add author + date when work is substantial
- Code: add `@author` block only for non-trivial logic

## Domain Reference

| Domain | Rule | Allowed Paths |
|--------|------|---------------|
| Rendering | `@webgpu` | `packages/renderer/`, `packages/screen/` |
| Surfaces | `@surfaces` | `packages/surfaces/` |
| Input | `@input` | `packages/input/` |
| Accessibility | `@a11y` | `packages/a11y/` |
| Enhancement | `@enhancement` | `demos/`, `website/src/lib/`, `website/src/routes/demos/` |
| Rules | `@ruler` | `.cursor/rules/` |
| Review | `@review` | Changed files (pre-push bug detection) |

## Progressive Enhancement

When working on demos/implementations and a library gap is found:
1. Document gap → Enhance library primitive → Use in implementation
2. Delegate library changes to appropriate domain rule
3. Keep demo code as pure primitive composition
