# 字体源文件授权说明

本目录存放游戏 SDF atlas 生成所用的字体源文件。**字体源 OTF/TTF 因体积大不进 git**（见 `.gitignore`），需要按本文档手动下载。

## 当前字体

### Source Han Sans CN Bold（思源黑体简体中文 Bold 字重）

| 字段 | 值 |
|---|---|
| 文件 | `SourceHanSansCN-Bold.otf` |
| 大小 | 8.1 MB |
| 字重 | Bold (700/Heavy 范围) |
| 字符集 | 简体中文 + 拉丁 + CJK 标点 |
| 来源 | Adobe + Google 联合开发 |
| 下载页 | https://github.com/adobe-fonts/source-han-sans/releases/tag/2.004R |
| 版本 | 2.004R |
| 下载日期 | 2026-05-13 |

**下载步骤（手动）：**

```bash
curl -L -o /tmp/SourceHanSansCN.zip \
  https://github.com/adobe-fonts/source-han-sans/releases/download/2.004R/SourceHanSansCN.zip
unzip -j -o /tmp/SourceHanSansCN.zip \
  'SubsetOTF/CN/SourceHanSansCN-Bold.otf' \
  -d assets/fonts/source/
rm /tmp/SourceHanSansCN.zip
```

## 商用授权

**协议：** SIL Open Font License, Version 1.1（**OFL-1.1**）

**OFL-1.1 商用条款摘要（非法律建议，详见同目录 `OFL.txt` 全文）：**

✅ **允许：**
- 商业产品（游戏 / app / 网站）打包发行字体或其 atlas 衍生品
- 修改字体（如生成 SDF atlas、subset 字符集）
- 嵌入到任意软件，包括闭源商业软件
- 与不同协议的代码 / 资源混合使用（"非传染性"）

🚫 **禁止：**
- 单独售卖字体本身（**作为打包产品的一部分发行 OK**）
- 用 "Source" / 等保留字体名直接命名衍生品（衍生品需改名）

📝 **要求：**
- 衍生品（如本项目的 SDF atlas）**必须包含本 LICENSE 文件 + OFL 正文 + 版权声明**
- 衍生品**不得以原字体保留名发行**（"Source" 是 Adobe 注册商标）

## 衍生品规则（本项目专属）

- **不允许把 OTF/TTF 直接打进 .rpk / Web bundle**
- **允许打包 SDF atlas（main.png + main.xml）**，atlas 是字体的位图衍生品，OFL 允许
- atlas 生成脚本 `scripts/build-font-atlas.sh` 离线运行（CI 暂不跑，避免远程依赖）
- atlas 输出文件名用 `main.*` 不用 `SourceHanSans*` 命名（避开 "Source" 商标）

## 备选字体（未启用）

如未来需要 Regular 字重 / TC 繁体 / 日文 / 韩文，按相同方式从 adobe-fonts/source-han-sans release 拉对应 zip。

**绝不使用以下来源：**
- ❌ 任何中文字体下载站（fonts.com.cn / 字体天下 / 100font / 等）
- ❌ 微软雅黑 / 方正字体 / 汉仪字体（**全部商用付费**）
- ❌ 通过非官方 mirror 下载（无法核实文件完整性 + 协议）

## 附文件

- `OFL.txt` —— SIL OFL 1.1 完整协议正文（Adobe 官方仓库 release 分支同步下载）
- `SourceHanSansCN-Bold.otf` —— 字体源（不在 git）
