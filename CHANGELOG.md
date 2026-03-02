# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [4.12.0] - 2026-03-03

### Added

- repo-analyzer agent for external GitHub repository analysis (#46)

### Fixed

- Harden command execution and consolidate architecture

## [4.11.1] - 2026-03-01

### Changed

- Consolidate 29 skills into 14 for cleaner skill structure (#44)

## [4.11.0] - 2026-03-01

### Added

- Local MCP conflict detection in init, update, sync tools (#43)

## [4.10.0] - 2026-03-01

### Added

- Plan-archive tool for workflow history management
- Ralph-todo loop mode for autonomous task iteration
- Knowledge vault for Obsidian-compatible local knowledge base (#42)
- Knowledge context injection into prompt-enricher hook
- work-start and work-finish instruction skills

## [4.9.0] - 2026-02-27

### Added

- Overlap detection and resolution system for tool conflicts
- Quality gate improvement hints in verification results
- Quality-reviewer step to workflow pipelines (#34)

### Changed

- Centralize `.agent/` paths into project-paths module
- Adopt McpResponseBuilder semantic API in doctor and info tools
- Improve McpResponseBuilder with semantic formatting

## [4.8.0] - 2026-02-27

### Added

- plugin-update skill for harness and OMC updates

### Fixed

- Correct plugin update commands with marketplace scope (#33)
- Check full commit body for issue references in hooks

## [4.7.0] - 2026-02-27

### Added

- Behavioral guard system — rationalization prevention + red flag detection (#32)
- Hybrid enforcement (G1-G5) for implementation readiness
- Plan-gate pre-check and implementation trigger (G1+G5)
- verify-behavioral-guard skill

## [4.6.0] - 2026-02-26

### Added

- 15 development workflow utility commands (branch-info, deps-check, diff-summary, etc.)

## [4.5.0] - 2026-02-26

### Fixed

- Ontology incremental cache bug and enabledSteps handling (#30)

### Changed

- Merge maintenance and patterns modules into core (9 → 7 modules)
- Remove unused OmcAgentMapping and agentPipelineHints

### Added

- @MX:WARN integration to code-change hook
- Session-log, lessons, handoff, and SDD templates
- Enhanced session lifecycle hooks with ontology injection

## [4.4.1] - 2026-02-26

### Fixed

- Bundle all dependencies to fix plugin cache loading (#29)
- Include package-lock.json in release commit (#28)
- Update plugin update command in release script (#27)

## [4.4.0] - 2026-02-26

### Added

- README verification to ship-pr skill (#26)
- README verification to logical-commit skill

### Fixed

- Plugin install commands in README (#25)
- Rename marketplace to avoid duplicate name in plugin key (#24)

## [4.3.1] - 2026-02-26

### Added

- design-guide skill for design system selection
- branch-cleanup skill for post-merge branch management (#23)

## [4.3.0] - 2026-02-26

### Added

- Ontology documentation indexing in domain layer (step 8)
- DDD aggregate/bounded-context analysis in domain layer
- Test maturity and schema analysis in ontology domain layer

## [4.2.0] - 2026-02-26

### Added

- Self-evolving verify skill system
- Verify-all integration into workflow verifier steps

## [4.1.2] - 2026-02-26

### Fixed

- Add `harness-` prefix to all skill names to avoid built-in collisions (#18)

## [4.1.1] - 2026-02-26

### Fixed

- Include dist/ in git for plugin distribution (#17)
- Hook wrapper for graceful fallback on missing dist

## [4.1.0] - 2026-02-26

### Added

- Issue/QA tracking system for bug lifecycle management
- Skill trigger manifest for automatic skill routing (#16)

## [4.0.0] - 2026-02-25

### Added

- MCP server architecture (StdioTransport + 9 tool handlers)
- Claude Code plugin packaging and marketplace metadata
- TRUST 5 quality gate framework (5 validators)
- Workflow execution engine with FSM and state transitions
- 3-layer ontology system (structural/semantic/domain)
- @MX annotation integration for ontology
- OMC integration layer with capability detection
- Hook system with 8 lifecycle events (session-start, pre-task, post-task, etc.)
- Team-memory module with shared rules and MEMORY.md auto-sync
- Security module with hooks and commands
- Workflow dashboard with visualization and session replay
- Agents, skills, presets, and build integration
- Release automation pipeline with git tag-based updates
- Plugin self-update capability
- Settings bootstrap for one-stop project setup
- harness-init and harness-update slash commands
- harness-sync global command
- verify-loop and handoff-verify quality tools
- auto-verification gates in ship workflow
- CLAUDE.md auto-sync with marker-based partial update
- Ontology domain-write tool
- ONTOLOGY-INDEX.md auto-generation
- Event logging infrastructure to all hooks
- Branch awareness in session-start and quality-gate hooks
- work-start and work-finish skills with worktree support
- Comprehensive test suite (154 tests)

### Changed

- Migrate from CLI to MCP server plugin architecture
- Replace chalk logger with MCP buffer pattern
- Centralize OMC references with omc-compat adapter layer
- Update global templates to use MCP tools instead of manual file copy
- Remove CLI entry point and interactive prompts
- Remove legacy infrastructure and simplify plugin

[4.12.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.11.1...v4.12.0
[4.11.1]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.11.0...v4.11.1
[4.11.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.10.0...v4.11.0
[4.10.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.9.0...v4.10.0
[4.9.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.8.0...v4.9.0
[4.8.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.7.0...v4.8.0
[4.7.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.6.0...v4.7.0
[4.6.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.5.0...v4.6.0
[4.5.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.4.1...v4.5.0
[4.4.1]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.4.0...v4.4.1
[4.4.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.3.1...v4.4.0
[4.3.1]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.3.0...v4.3.1
[4.3.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.2.0...v4.3.0
[4.2.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.1.2...v4.2.0
[4.1.2]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.1.1...v4.1.2
[4.1.1]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.1.0...v4.1.1
[4.1.0]: https://github.com/skdkfk8758/carpdm_harness/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/skdkfk8758/carpdm_harness/releases/tag/v4.0.0
