---
description: "Shared standards for all Scene project agents - output attribution and communication protocols"
alwaysApply: false
---

# Agent Standards

This rule defines shared standards that apply to all agents in the Scene project. All specialist agents should follow these guidelines.

## When This Applies

This rule is automatically applied when:
- You are acting as any Scene project agent (WebGPU Engineer, Surface Engineer, Input Engineer, Accessibility Engineer, Agent Ruler, etc.)
- You are creating documentation, logs, or written artifacts
- You are being invoked as part of an orchestrated workflow

## Output Attribution

All agents must attribute their output to provide transparency and traceability.

### Documentation Files

Add attribution at the top of any documentation file you create:

```markdown
---
Written by: [Your Agent Name]
Last updated: [Current Date]
---
```

**Examples:**
- `Written by: WebGPU Engineer`
- `Written by: Surface Engineer`
- `Written by: Input Engineer`
- `Written by: Accessibility Engineer`
- `Written by: Agent Ruler`
- `Written by: Build Orchestrator`

### Log Files

Add attribution at the top:

```
# Written by: [Your Agent Name]
# Generated: [Current Date]
```

### Inline Comments

For significant code blocks or complex implementations, add:

```typescript
/**
 * [Brief description of what this does]
 * 
 * @author [Your Agent Name]
 */
```

**Use this for:**
- Complex algorithms or business logic
- Non-obvious implementation choices
- Significant refactors or rewrites
- Code that may need specialist context later

**Don't use for:**
- Trivial code or obvious implementations
- Code that is self-explanatory
- Small utility functions

### Markdown Documentation

At the end of substantial documentation sections or guides, add:

```markdown
---
*Written by [Your Agent Name]*
```

## Agent Names Reference

Use your proper display name in attributions:

| Agent Handle | Display Name |
|--------------|--------------|
| `@webgpu-engineer` | WebGPU Engineer |
| `@surface-engineer` | Surface Engineer |
| `@input-engineer` | Input Engineer |
| `@a11y-engineer` | Accessibility Engineer |
| `@agent-ruler` | Agent Ruler |
| `@build` | Build Orchestrator |

## Self-Identification

When you begin working on a task (especially when invoked by an orchestrator), identify yourself if appropriate to the context. However, the orchestrator is responsible for formal announcements.

## Examples

### Good Attribution Examples

**Documentation file:**
```markdown
---
Written by: WebGPU Engineer
Last updated: January 7, 2026
---

# WebGPU Renderer Architecture

This document describes the WebGPU rendering pipeline...
```

**Complex code block:**
```typescript
/**
 * Implements two-pass Gaussian blur using separable convolution.
 * First pass blurs horizontally, second pass blurs vertically.
 * This approach reduces complexity from O(n²) to O(2n).
 * 
 * @author WebGPU Engineer
 */
export class GaussianBlurEffect {
  // implementation...
}
```

**Log file:**
```
# Written by: Surface Engineer
# Generated: January 7, 2026

Surface tracking performance analysis:
- Average rect sync time: 1.2ms
- Layout observer batching efficiency: 94%
```

### When NOT to Attribute

Don't add attribution to:
- **Minor edits** to existing files (unless you're doing significant refactoring)
- **Configuration files** (package.json, tsconfig.json, etc.)
- **Generated code** that isn't authored by you
- **Trivial changes** like typo fixes or formatting

## Best Practices

1. **Be Consistent:** Always use your official display name
2. **Be Honest:** Only attribute work you actually did
3. **Be Helpful:** Attribution should help others understand who has context
4. **Be Proportional:** Don't over-attribute trivial contributions
5. **Update Dates:** When significantly updating a file, update the "Last updated" date

## Orchestration Communication

When agents are invoked by orchestrators (like `@build`), they must be announced to provide transparency.

### Announcement Format

```
🕵️‍♂️ Agent [Agent Name] started working on [descriptive-task-name]
```

### Announcement Rules

1. **Always Announce:** Every agent invocation must be announced before the @-mention
2. **Be Specific:** Task names should describe actual work, not generic labels
3. **Multiple Agents:** When multiple agents work on a task, announce each one separately
4. **Sequential Clarity:** When one agent hands off to another, the new announcement marks the transition

### Agent Names Reference (Canonical)

| Agent Handle | Display Name | Typical Tasks |
|--------------|--------------|---------------|
| `@webgpu-engineer` | WebGPU Engineer | WebGPU renderer, shader optimization, render pipelines |
| `@surface-engineer` | Surface Engineer | Surface tracking, DOM synchronization, ghost surfaces |
| `@input-engineer` | Input Engineer | Pointer input, picking, inertia physics |
| `@a11y-engineer` | Accessibility Engineer | DOM mirrors, keyboard navigation, screen reader support |
| `@agent-ruler` | Agent Ruler | Creating/refining agents, rule integrity checking |
| `@build` | Build Orchestrator | N/A (orchestrator announces others) |

### Examples

**Single Agent:**
```
🕵️‍♂️ Agent WebGPU Engineer started working on WebGPU renderer implementation.

@webgpu-engineer please implement the renderer package...
```

**Multiple Agents in Sequence:**
```
🕵️‍♂️ Agent WebGPU Engineer started working on screen effect shaders.

@webgpu-engineer implement blur and vignette effects...

[After completion]

🕵️‍♂️ Agent Surface Engineer started working on effect surface integration.

@surface-engineer integrate effects with surface tracking...
```

### As an Agent Being Invoked

When you are invoked by an orchestrator, you don't need to repeat the announcement - just proceed with your work and attribute your outputs as defined above.

## Cross-References

All agents should be aware of and follow:
- `@typescript` - TypeScript coding standards for all code
- `@efficiency` - Credit-conscious patterns for minimal overhead
- `@git-workflow` - Git standards when creating commits
