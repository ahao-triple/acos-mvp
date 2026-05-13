# 共联防线文档索引

| 文档 | 给谁 | 何时读 |
|---|---|---|
| `vivo-quirks.md` | 维护代码 / 接入新平台的 AI / 人 | 撞 vivo runtime 怪异行为时 |
| `phase1-summary.md` | 新人 / 半年后的自己 | 想了解项目历程 |
| `platform-checklist.md` | 平台适配维护 | 检查 vivo 适配约束时 |
| `audio-audit.md` | 音效维护 | 修音效 / 加 BGM 时 |
| `visual-upgrade-proposal.md` | 美术 / 视觉升级 | 调表现力时 |
| `phase0-changelog.md` | 归档 | 极少看，只为复盘 |
| `font-charset.txt` | 工程 / 字体维护 | 改中文文案、重打 atlas 时 |

## 维护约定

- 改可见中文文案后，必须重跑 `node scripts/scan-charset.mjs`、`sh scripts/build-font-atlas.sh`、`pnpm test`。
- vivo 真机问题先查 `vivo-quirks.md`，不要凭浏览器表现推断。
