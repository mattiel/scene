---
description: "Git workflow standards - branching, commits, and PR practices"
alwaysApply: true
---

# Git Workflow Standards

## Branch Strategy

**Always create a branch before making changes.** Never commit directly to `main`.

### Branch Naming

```
feat/phase-N-description    # New features (e.g., feat/phase-2-webgpu-renderer)
fix/issue-description       # Bug fixes (e.g., fix/surface-rect-sync)
refactor/description        # Code improvements (e.g., refactor/event-bus-types)
docs/description            # Documentation (e.g., docs/api-reference)
```

### Before Starting Work

```bash
git checkout main
git pull origin main
git checkout -b feat/phase-N-description
```

## Commit Standards

### Conventional Commits Format

```
type(scope): description

[optional body]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code change that neither fixes nor adds
- `docs` - Documentation only
- `test` - Adding or updating tests
- `chore` - Build process, dependencies, tooling

**Scopes** (use package names):
- `core`, `renderer`, `surfaces`, `screen`, `input`, `navigation`, `a11y`

### Examples

```
feat(renderer): add WebGPUContext with availability detection
fix(surfaces): batch layout updates per frame
refactor(core): extract EventBus to separate module
docs(readme): add installation instructions
```

## Commit Timing

Commit after completing **logical units of work**:
- After creating a new module/class
- After implementing a feature
- After fixing a bug
- After writing tests

**Do not** make giant commits with many unrelated changes.

## Pull Request Workflow

1. Push branch to remote: `git push -u origin feat/branch-name`
2. Create PR with clear description
3. Reference the implementation phase in PR body
4. Link to relevant spec sections

## Rules

- Never force push to shared branches
- Keep commits atomic and focused
- Write meaningful commit messages (why, not just what)
- Rebase feature branches on main before PR
