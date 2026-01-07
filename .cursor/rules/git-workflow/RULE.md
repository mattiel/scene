---
description: "Git workflow standards - branching, commits, and PR practices"
alwaysApply: true
---

# Git Workflow Standards

## ⚠️ CRITICAL: Never Commit Directly to Main

**This is a non-negotiable rule that applies to all contributors, including AI assistants.**

Before making ANY commits:
1. Check current branch: `git branch --show-current`
2. If on `main`, STOP and create a feature branch first
3. Only then proceed with commits

## Branch Strategy

**Always create a branch before making changes.** Never commit directly to `main`.

### Branch Naming

```
feat/phase-N-description    # New features (e.g., feat/phase-2-webgpu-renderer)
fix/issue-description       # Bug fixes (e.g., fix/surface-rect-sync)
refactor/description        # Code improvements (e.g., refactor/event-bus-types)
docs/description            # Documentation (e.g., docs/api-reference)
chore/description           # Tooling, dependencies, config (e.g., chore/organize-logs)
```

### Before Starting Work

**ALWAYS follow this sequence:**

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Create feature branch with descriptive name
git checkout -b feat/descriptive-name

# 3. Now you can make changes and commit
git add .
git commit -m "feat(scope): description"

# 4. Push branch (not main!)
git push -u origin feat/descriptive-name
```

## For AI Assistants

When asked to commit and push changes:

1. **Check current branch FIRST**: Run `git branch --show-current`
2. **If on main**: Create feature branch before committing
3. **If on feature branch**: Proceed with commit
4. **Never use**: `git push origin main` unless explicitly requested
5. **If you accidentally commit to main**: 
   - If not pushed yet: Move commits to feature branch
   - If already pushed: Create revert commit, then feature branch

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
- `chore` - Build process, dependencies, tooling, project structure

**Scopes** (use package names or project areas):
- Package names: `core`, `renderer`, `surfaces`, `screen`, `input`, `navigation`, `a11y`
- Project areas: `rules`, `logs`, `config`, `build`, `deps`

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
