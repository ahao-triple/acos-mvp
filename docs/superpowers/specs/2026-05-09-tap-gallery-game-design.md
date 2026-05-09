# Tap Gallery Game Design

## Goal

Turn `games/tap-gallery/tap-gallery-dev-handoff` from a handoff package into a playable Canvas game project that can run in the browser and build through the existing `mini-pack` pipeline for Douyin.

## Scope

The implementation creates a formal project under `games/tap-gallery` while preserving `tap-gallery-dev-handoff` as source material. The first complete version must provide the full game loop: load 30 levels, render arrow boards, allow valid arrow clearing, reveal the final image on completion, handle failure/retry, persist progress, play sound effects, and expose platform hooks for rewarded flows.

The version should be close to submission quality in structure, but platform-only features such as real rewarded ads, sidebar entry, favorite prompts, and desktop shortcuts will use the existing adapter pattern with web-safe placeholders and Douyin-ready boundaries.

## Project Layout

`games/tap-gallery/game.config.ts` defines the mini-pack entry and platform metadata.

`games/tap-gallery/game` is a Vite + TypeScript + Canvas app. It owns runtime code, tests, and public assets.

`games/tap-gallery/game/public` contains a copied runtime asset set derived from `tap-gallery-dev-handoff/game-assets`, including `asset-manifest.json`, level configs, reveal images, masks, thumbs, UI icons, and SFX.

`games/tap-gallery/tap-gallery-dev-handoff` remains untouched except when explicitly regenerating source assets.

## Gameplay

Each level loads a board from `level-configs/level-XXX.json`. Cells with arrows can be tapped when their arrow path to the board edge is clear. A valid tap removes the arrow, plays feedback, advances progress, and may reveal more of the level image. Invalid taps give a light blocked feedback without consuming state.

The win condition is clearing all active arrow cells. On win, the board camera resets, the full `revealImage` is shown, the level is marked complete, rewards are granted, and the player can continue to the next level. The failure condition is running out of moves before clearing the board. Failure offers retry and an extra-moves rewarded flow through the platform adapter.

## UI Flow

The first launch starts directly at level 1. The screen keeps the handoff document's `750 x 1334` logical canvas and scales to the viewport. Top UI shows level, energy, coins, and settings. The middle shows title, moves, and progress. The board uses the handoff `660 x 660` safe region. The bottom exposes tools: Hint, Bomb, Magnet, Hammer, and Freeze.

The level selector is available after first play but is not the first screen. Completed levels show thumbnails, current progress is persisted, and locked levels remain inaccessible until prior levels are completed.

## Tools

Hint highlights a valid arrow and can move attention toward it.

Bomb removes a small cluster around the selected cell when at least one removable arrow is affected.

Magnet removes all currently clear arrows matching a selected direction, capped to avoid trivializing large boards.

Hammer removes one selected arrow regardless of blockage.

Freeze grants temporary invalid-tap forgiveness by preventing move loss or failure pressure for a short number of actions.

These tools need correct game-state behavior first. Polished animations can be refined after the playable loop is stable.

## Assets

Runtime code reads `assets/asset-manifest.json` from the public directory, then loads level data and images by URL. It must tolerate missing optional image loads by drawing a fallback silhouette or tile state, but level JSON and manifest load failures should surface a blocking error screen because the game cannot proceed.

The first 14 reveal images are imagegen-derived polished assets. Levels 15-30 may use the existing procedural placeholders from the handoff package until those source images are replaced.

## Persistence And Economy

Save state uses the platform storage interface. It stores current level, completed levels, unlocked highest level, coins, energy, tool counts, settings, and lightweight level attempt state. Browser runtime uses `localStorage`; mini-pack runtime uses the provided storage bridge.

Energy is consumed on starting or retrying a level when appropriate. Rewards add coins and occasional tools. Exact numbers should stay simple and deterministic for the first version.

## Platform Integration

Web runtime provides placeholders for rewarded ads and platform rewards. Douyin packaging is handled by `mini-pack` using the same runtime boundary pattern already present in `gonglian-fangxian`.

The game should not directly depend on `tt` APIs in core gameplay. Platform-specific calls stay behind adapters so browser tests can exercise the same user-facing flows.

## Architecture

Core rules live in pure TypeScript modules with no DOM dependency: level parsing, board state, move validation, tool effects, rewards, and save migration.

The app/controller layer owns session state, input routing, screen transitions, persistence, and platform calls.

The render layer owns canvas layout, drawing, animation timing, image cache, and pointer hit targets. It consumes controller view state instead of mutating game rules directly.

The audio layer maps game events to the handoff SFX files and degrades silently when autoplay or platform audio is unavailable.

## Testing

Unit tests cover level loading, arrow clearance rules, win/failure conditions, tool effects, save migration, and controller transitions. A build test should confirm the project can compile and mini-pack can package the Douyin output. Browser visual QA is useful once the first playable version runs.

## Non-Goals For First Completion

No real ad network integration beyond adapter boundaries.

No image generation or replacement of levels 15-30 source art.

No leaderboard, cloud save, analytics dashboard, or backend.

No unrelated refactor of `gonglian-fangxian`.
