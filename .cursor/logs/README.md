# Agent Logs and Artifacts

This directory contains all logs, plans, and other artifacts created by AI agents during development.

## Directory Structure

### `plans/` - Implementation Plans

Implementation plans for features, phases, or major changes. Each plan gets its own folder.

**Structure:**
```
plans/
  {feature-name}/
    PLAN.md          # Original implementation plan
    UPDATES.md       # Updates and revisions to the plan
```

### `builds/` - Build Logs

Progress tracking and completion logs for build phases.

**Structure:**
```
builds/
  phase-{n}-{name}/
    LOG.md           # Build progress and notes
    COMPLETE.md      # Completion summary
```

### `tasks/` - Task Logs

Logs for specific development tasks, refactorings, or investigations.

**Structure:**
```
tasks/
  {task-name}/
    LOG.md           # Task progress and notes
```

### `migrations/` - Migration Logs

Documentation of migrations, upgrades, or major refactorings.

**Structure:**
```
migrations/
  {migration-name}/
    LOG.md           # Migration process and decisions
    NOTES.md         # Additional notes and learnings
```

## Guidelines

1. **Never create logs in project root** - All agent-created documentation lives here
2. **Use descriptive folder names** - Clear, kebab-case names for easy navigation
3. **Maintain history** - Don't overwrite; append or create separate update files
4. **Keep it organized** - One folder per artifact, related files together

## Example Usage

When starting a new implementation:
```bash
mkdir .cursor/logs/plans/webgpu-renderer
# Create PLAN.md with implementation details
```

When tracking a build phase:
```bash
mkdir .cursor/logs/builds/phase-2-renderer
# Create LOG.md to track progress
```

When documenting a migration:
```bash
mkdir .cursor/logs/migrations/typescript-5-upgrade
# Create LOG.md with migration steps and outcomes
```
