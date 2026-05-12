# AGENT Development Rules

This file defines repository-wide rules. Before working inside a specific game, read this file first, then read `games/<game-project>/AGENT.md`. Game-level rules extend or narrow these rules. If rules conflict, the file closer to the working directory takes precedence.

Each `AGENT.md` must have a same-directory `AGENT_CN.md` mirror. `AGENT.md` is the English version used by AI agents. `AGENT_CN.md` is the Simplified Chinese version used for user review. The two files must stay semantically equivalent and must be updated together in the same change.

## Language Rules

- AI-facing documentation must be written in English. This includes `AGENT.md` files, agent handoff notes, implementation instructions, and any document primarily meant to guide AI agents.
- User-facing documentation must be written in Simplified Chinese unless the user explicitly asks for another language. This includes `AGENT_CN.md` files, summaries, product notes, acceptance notes, and direct replies to the user.
- When changing any `AGENT.md`, update its matching `AGENT_CN.md` in the same change. When changing any `AGENT_CN.md`, update its matching `AGENT.md` in the same change.
- Player-facing in-game text must use standard Simplified Chinese.
- Keep Chinese product names unchanged, for example `就你眼神好` and `共联防线软件`.

## Project Boundaries

- `mini-pack/` is the shared packager and mini-game runtime bridge.
- `games/<game-project>/` contains independent game projects.
- Game projects must not depend on paths outside this repository or on deleted experiment projects.
- Cross-game reuse must happen through explicit copying, shared abstractions, or `mini-pack` features.
- Platform-specific packaging belongs in `mini-pack`; do not scatter platform packaging logic into individual games.

## Mini-Game Product Rules

- Design games as mobile portrait mini-games by default, using `750 x 1334` as the logical design size.
- Prioritize short sessions, lightweight systems, clear goals, and fast access to the core gameplay.
- Keep page boundaries clear. Common pages include home, gameplay, result, level selection, and settings.
- All player-facing UI, dialogs, buttons, tips, reward descriptions, and level goals must use standard Simplified Chinese.
- Do not bake critical UI copy, button text, numbers, or variable information into images unless the requirement explicitly says so.
- New systems should support the core gameplay, retention, sharing, or monetization. Do not turn these games into heavy long-term games, generic tools, or content websites.

## Stability Rules

- The core game flow must remain usable when platform capabilities fail.
- Sharing, ads, storage, audio, desktop shortcuts, sidebar entry points, and similar platform features must be isolated and have fallback behavior.
- Saves must tolerate old versions, missing fields, and malformed data. A bad save must not prevent game startup.
- Music and sound effects must support toggles. Audio loading, playback, or autoplay failures must not block the game flow.
- Browser preview may be preserved, but the final implementation must not depend on a normal web-only runtime.

## Ad Rules

- Video ads may only be used in reward scenarios that the player actively triggers.
- Ad entry points must clearly show the rewarded-video marker and explain the reward.
- If the player cancels, skips, closes, or does not complete the ad, do not grant the full reward.
- If platform capability is unavailable, the ad component fails to load, or the platform API throws, fallback rewards may be granted with clear feedback.
- Keep game state stable before and after ads. Ads must not corrupt level, reward, or screen state.

## Level And Resource Rules

- Level-based games should progress in order, starting from level 1 by default.
- Locked levels must have a clear locked state and must not look directly playable.
- Runtime assets belong in `game/public-pack/`. Resource manifests and docs should use the same path.
- Browser preview assets may use public-root paths such as `/audio/...` and `/assets/...`.
- Generated or replaced images and audio must fit the current game's style. Do not commit temporary previews, tool caches, or obviously unrelated assets.

## Verification Rules

- When changing gameplay, levels, saves, or ad flows, run the corresponding game's tests.
- When changing rendering or interaction, run the corresponding game's tests and use browser preview when needed.
- When changing resource directories, Vite config, or platform config, run the corresponding game build and platform package.
- When changing `mini-pack`, run `pnpm --dir mini-pack test` and verify at least one real game platform package.
- Windows is a supported development environment. Use `fileURLToPath()` for local paths; do not build Windows paths directly from `URL.pathname`.

## Git Rules

- The worktree may already be dirty. Check `git status --short` before editing.
- Do not revert unrelated changes.
- Do not commit `node_modules/`, `dist/`, `build/`, `builds/`, local tool config, or temporary directories.
- Before deleting a legacy project at scale, confirm that no active references remain.

## AI Working Conventions

This section collects the additional rules an AI must follow when working in this repository. Items already covered in `Language Rules`, `Verification Rules`, or `Git Rules` are restated here only as pointers — the canonical wording stays in those sections.

### Preparation Before Edits

- Read the root `AGENT.md` first, then the relevant `games/<game>/AGENT.md`. When rules conflict, the file closer to the working directory wins.
- Run `git status --short` before editing, to avoid overwriting uncommitted work. See `Git Rules`.

### Irreversible Operations Require User Approval

- The AI must not run unprompted: `git push`, PR merges, `git push --force` / `--force-with-lease`, `git reset --hard`, branch deletion, or `git rebase` that rewrites published history.
- `git commit` only runs when the user explicitly asks for it. If a hook fails, create a new commit instead of using `--amend`.
- Flags that bypass hooks or signatures (`--no-verify`, `--no-gpg-sign`, etc.) are only used when the user explicitly requests them.

### Completion Bar (No Performative "Done")

- Do not claim "done / fixed / passing" before the corresponding verification has actually run. Running `tsc --noEmit` alone does not count as verification.
- Verification scope follows `Verification Rules`: gameplay / saves / ads → that game's `pnpm test`; resource directories / Vite config / platform config → also run that game's `pnpm build`; `mini-pack` changes → also run `pnpm --dir mini-pack test` and at least one real game's platform package.
- When something cannot be verified locally (UI browser preview unreachable, device unreachable, etc.), explicitly call it out as an unverified item — do not hide it.

### Documentation And Mirroring

- Any change to an `AGENT.md` must be paired in the same commit with the matching change to its sibling `AGENT_CN.md`, and vice versa. See `Language Rules`.

### specs / plans Location And Naming

- Cross-game work, `mini-pack`, platform integration, and repo-level rules → root `docs/superpowers/{specs,plans}/`.
- Gameplay / level / UI / save / asset / in-game platform bridge work for a single game → `games/<game>/docs/superpowers/{specs,plans}/`.
- A single change that spans multiple games → root.
- Naming: `specs/YYYY-MM-DD-<topic>-design.md`, `plans/YYYY-MM-DD-<topic>.md`; `<topic>` uses an English hyphen-joined slug.
- `specs/plans` are written in standard Simplified Chinese by default and do not need an English mirror.

## Channel Materials Convention

Each game keeps its per-channel configuration and outputs under `games/<game>/channels/<platform>/`:

- `materials.ts`: channel-specific fields (douyin/kuaishou `appid` / `projectName` / `rewardedAdUnitId` / `iconPath`; vivo `packageName` / `iconPath` / `versionName` / `versionCode`).
- `icon.png`: channel icon (required; uploaded to the douyin/kuaishou console manually, written into the vivo build at `src/icon.png`).
- `build/`: build output, already `.gitignored`.

`game.config.ts` carries only game-wide fields (`title` / `entry` / `publicDir` / `orientation` / `canvas` / `serverBaseUrl`); `platform`, `outDir`, and per-channel fields no longer live here.

Builds must pass preflight first:

- `pnpm preflight games/<game> --platform <platform>`: validation only.
- `pnpm build games/<game> --platform <platform>`: validates then builds; missing items are reported in Chinese as a single batch and exit non-zero.
