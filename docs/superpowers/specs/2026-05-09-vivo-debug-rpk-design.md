# Vivo Debug RPK Packaging Design

Date: 2026-05-09

## Goal

Add vivo Mini Game packaging support to the shared mini-pack toolchain so the current game can be packaged as a debug `.rpk` without modifying anything under `games/`.

The immediate target is a local debug package that can be installed and tested with vivo/Quick Game tooling. Release signing, vivo account integration, payment, login, and cross-vendor alliance packaging are out of scope for this step.

## Hard Constraint

This work must not modify any file under `games/`.

The game directory is read-only input for this task. Any platform-specific defaults needed for vivo must live in the shared packager or be supplied through CLI arguments. The existing Douyin packaging path must continue to work without requiring changes in game projects.

## User Workflow

The intended command is:

```bash
pnpm build games/gonglian-fangxian --platform vivo
```

The command should produce:

```text
build/gonglian-fangxian-vivo/
```

That output directory should contain a generated vivo/Quick Game project and, when the vivo CLI is available, a debug `.rpk` artifact.

## Architecture

The platform support should be added in `mini-pack`, not in the game.

`mini-pack` will gain a `vivo` platform builder alongside the existing `douyin` builder. The platform selector will accept both `douyin` and `vivo`, and the root build script will parse `--platform vivo` and route it through the existing package API.

The config loader should keep Douyin behavior compatible while allowing CLI platform override. For vivo builds, the loader should not require `platform/douyin/materials`, because that would force a `games/` change. Vivo-specific app identity and manifest defaults should come from the packager unless explicit CLI/config values are added later.

## Generated Vivo Project

The vivo builder should generate a Quick Game project structure inside the build directory. The exact file names should follow the current vivo CLI expectations after verifying the installed tool, but the intended shape is:

```text
build/gonglian-fangxian-vivo/
  package.json
  src/
    game.js
    manifest.json
    assets/
      ...
```

`src/game.js` should bundle the game entry and inject a vivo runtime bridge. Static game assets should be copied from the existing public directory into the generated project output, not written back to `games/`.

## Vivo Runtime Bridge

The vivo runtime bridge should target the `qg` global and expose the same `GameRuntime` surface expected by the game:

- canvas creation through vivo APIs when available
- storage through vivo storage APIs with in-memory fallback if needed
- music and sound effects through vivo audio APIs
- haptics through vivo vibration APIs when available
- rewarded video ads through vivo APIs if present, otherwise logged unsupported behavior
- reward helper methods as conservative no-op/unsupported responses for now
- logger output prefixed so vivo-side failures are easy to identify in device logs

Unsupported vivo capabilities should fail soft. The game should remain playable even when a platform feature is unavailable.

## RPK Build

After generating the project, the builder should invoke the vivo Mini Game CLI in debug mode when it is available locally.

The implementation should prefer a reproducible local dependency or local executable over relying on a globally installed command. If the CLI is missing or incompatible, the build should fail with a clear error that names the missing tool and the generated project path, rather than silently producing only partial output.

## Error Handling

Platform selection errors should name supported platforms.

Vivo CLI failures should include the command context and point to the generated output directory. Runtime bridge failures should log concise platform-prefixed messages without crashing the game loop.

## Tests

Add focused tests outside `games/` for:

- platform schema accepts `vivo` and continues accepting `douyin`
- invalid platforms are rejected clearly
- root build argument parsing routes `--platform vivo`
- vivo builder emits the expected project files
- generated vivo entry contains the `qg` runtime bridge
- Douyin build behavior does not regress

If the local environment cannot run the vivo CLI in CI, tests should cover project generation and command invocation boundaries without requiring an actual device install.

## Scope Exclusions

This step will not:

- edit any file under `games/`
- add release signing keys
- publish to vivo developer services
- implement vivo login, payment, or account binding
- support Quick Game alliance packaging
- change gameplay or game assets

## Success Criteria

The task is complete when:

- `pnpm build games/gonglian-fangxian --platform vivo` generates a vivo build directory
- the builder attempts or completes debug `.rpk` creation through the vivo CLI
- existing Douyin packaging still passes its tests
- all changes are outside `games/`
