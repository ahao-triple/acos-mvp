# Difference Hunt AGENT Rules

This file only adds local rules for `games/difference-hunt`. Repository-wide rules are in the root `AGENT.md`. The same-directory `AGENT_CN.md` is the Simplified Chinese mirror and must stay semantically equivalent.

## Project Boundary

- The product name is `就你眼神好`. It is a mobile portrait spot-the-difference mini-game.
- The default work scope is limited to `games/difference-hunt`.
- Keep the Vite + Canvas + mini-pack architecture. Do not migrate to Cocos and do not connect `normalGame`, `addGame`, or other gameplay types.
- The platform config entry is `game.config.ts`. Runtime static assets live in `game/public-pack`.

## Gameplay And Levels

- The core gameplay is only spot-the-difference: the player taps visual differences within a time limit.
- Level data comes from `game/src/assets/levels.ts`. Runtime image assets live under `game/public-pack/assets/find/...`.
- The current content has 7 levels, with 10 differences per level. When adding levels, keep numbering continuous, targets complete, and resource paths valid.
- When coordinates come from source level assets, preserve a clear coordinate conversion path. Do not adjust hit areas by guesswork.
- Levels unlock in order. Locked levels may be unlocked through a clearly labeled rewarded-video entry point.

## Screens And Monetization

- Keep clear boundaries between the home screen, gameplay screen, level screen, settings screen, win dialog, and fail dialog.
- Ad entry points are for active-player-triggered scenarios such as hints, extra time, reward doubling, and level unlocks.
- Ad fallback behavior must not corrupt the current level, timer, found targets, or save state.
- Player-facing copy must use standard Simplified Chinese. Do not bake button text, reward descriptions, or level goals into images.

## Verification

- After changing gameplay, levels, saves, ads, or rendering, run `pnpm --dir games/difference-hunt/game test`.
- After changing resource directories, Vite config, or platform config, run `pnpm --dir games/difference-hunt/game build`.
