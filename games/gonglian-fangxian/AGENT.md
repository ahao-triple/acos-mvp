# Gonglian Fangxian AGENT Rules

This file only adds local rules for `games/gonglian-fangxian`. Repository-wide rules are in the root `AGENT.md`. The same-directory `AGENT_CN.md` is the Simplified Chinese mirror and must stay semantically equivalent.

## Project Boundary

- The product name is `共联防线软件`. It is a mobile portrait match-3 campaign mini-game.
- The default work scope is limited to `games/gonglian-fangxian`.
- Keep the Vite + Canvas + mini-pack architecture. The core gameplay is swapping adjacent tiles and clearing matches of three or more.
- The platform config entry is `game.config.ts`. Runtime static assets live in `game/public-pack`.
- Review materials, screenshots, and player-facing copy must keep the name `共联防线软件`; do not revert to the old name `共联防线`.

## Gameplay And Levels

- Levels focus on collecting resources such as shields, ammo, radar, medals, and wrenches, plus clearing blockers such as sandbags and damaged defenses.
- Preserve the campaign flow: home screen, level selection, mission briefing, gameplay screen, win result, fail result, and supply entry.
- Levels unlock in order. Locked, completed, and currently playable states must be visually clear.
- Tool items, combos, goal progress, node rewards, and coin rewards must remain save-compatible with old data.

## Ads And Platform Capabilities

- Ad entry points are for active-player-triggered scenarios such as supplies, tool acquisition, extra steps after failure, and win reward doubling.
- Ad buttons should continue to reuse the existing `38 x 28` rewarded-video marker and unified ad button layout.
- Preserve Douyin sidebar, add-to-desktop, and platform reward logic. Failures should degrade with feedback and must not block the main flow.
- When changing platform capabilities, check both browser preview and the mini-pack runtime entry.

## Verification

- After changing gameplay, levels, saves, ads, or rendering, run `pnpm --dir games/gonglian-fangxian/game test`.
- After changing resource directories, Vite config, or platform config, run `pnpm --dir games/gonglian-fangxian/game build`.
- After changing platform packaging, run `pnpm build games/gonglian-fangxian` from the repository root.
