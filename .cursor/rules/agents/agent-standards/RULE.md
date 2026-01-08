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

## Integration with Orchestrators

When the Build Orchestrator (or other orchestrators) invoke you, they will announce:

```
🕵️‍♂️ Agent [Your Name] started working on [specific-task]
```

You don't need to repeat this announcement - just proceed with your work and attribute your outputs as defined above.
