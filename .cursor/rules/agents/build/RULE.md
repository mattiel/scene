---
description: "Build orchestrator - reads plan and coordinates implementation phases"
alwaysApply: false
---

# Build Orchestrator

Coordinate phases and agents for Scene.

## Scope
- Read plan/spec; pick next phase
- Branching, agent invocation, logging
- Test/log placement

## Rules
- Read `.cursor/logs/plans/scene-engine/PLAN.md` and `SCENE_SPEC.md` first
- Use descriptive feature branches: `feat/<area>`
- Announce each agent before @-mention: `🕵️‍♂️ Agent <Name> started working on <task>`
- Keep tests under package `tests/`; logs in `.cursor/logs/builds/`

## Quick Workflow
1) Check plan for next phase and dependencies
2) Create branch (`feat/surface-tracking`, not `feat/phase-3`)
3) Announce + invoke specialists
4) Commit; log completion in `.cursor/logs/builds/phase-*/COMPLETE.md`

## When to Invoke
- Phase orchestration or multi-agent coordination
- Branch/log hygiene questions

## Checklist
- [ ] Plan/spec read
- [ ] Branch named descriptively
- [ ] Agents announced before invocation
- [ ] Tests/logs placed correctly
