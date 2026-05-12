# vivo 小游戏登录 API 对接文档

更新日期：2026-05-12

本文档只面向 vivo 小游戏端登录对接。游戏端调用 vivo 账号 SDK 的 `qg.login()` 拿到 token，发到 AI-KS 服务端，由服务端用预配置的 `appKey + appSecret` 签名换取真实的 `openId` 与用户资料。

当前 vivo 子系统**只做登录与存档**，不接 ECPM / 结算 / 提现 / 代理。

## 1. 接入目标

游戏端完成一件事：

```
qg.login() → 拿到 token → POST /api/vivo/sessions → AI-KS 返回 openId 等用户资料 + clientConfig
```

AI-KS 后续会用 `openId` 做用户存档（`vivo_user` 表）和登录记录（`vivo_login_record` 表）。

## 2. Base URL

API 统一前缀为 `/api`。

服务器直连示例：

```
http://<server-host>:8007/api
```

如果游戏页面与 AI-KS Web 同源，且 Nginx 已把 `/api` 反向代理到 API，可使用：

```
/api
```

⚠️ 远程联调时不要把游戏端 API 地址写成 `http://localhost:8007/api`——`localhost` 指的是运行游戏的设备本机，不是服务器。

## 3. 后台前置配置

调用登录接口前，超管必须在后台 "vivo 游戏" 页面创建一条游戏配置：

| 字段 | 说明 |
|------|------|
| `pkgName` | vivo 小游戏包名 |
| `appKey` | vivo 开发者平台申请的 appKey |
| `appSecret` | vivo 开发者平台申请的 appSecret |
| `name` | 游戏展示名 |
| `clientConfig`（可选） | 下发给游戏端的 KV 配置（JSON） |

游戏端只传 `pkgName + token`，**不要把 `appKey` / `appSecret` 放到游戏客户端**。

## 4. 健康检查

### `GET /api/health`

确认 API 服务可访问。

响应：

```json
{ "status": "ok", "service": "ai-ks-api" }
```

## 5. 登录换 openId

### `POST /api/vivo/sessions`

游戏端拿到 `qg.login` 返回的 `token` 后调用该接口。

请求头：

```http
Content-Type: application/json
```

请求体：

```json
{
  "pkgName": "com.example.vivogame",
  "token": "<qg.login 返回的 token，5 分钟有效>"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `pkgName` | string | 是 | 后台已配置的 vivo 游戏包名 |
| `token` | string | 是 | `qg.login` 返回的一次性 token，5 分钟内有效 |

响应示例：

```json
{
  "game": {
    "pkgName": "com.example.vivogame",
    "name": "示例 vivo 游戏"
  },
  "openId":       "vivo_open_id_xxxxxxxx",
  "nickName":     "玩家昵称",
  "smallAvatar":  "https://...",
  "biggerAvatar": "https://...",
  "gender":       1,
  "clientConfig": { "startScene": "intro" }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `game.pkgName` | 后台配置的 vivo 包名 |
| `game.name` | 后台配置的游戏名 |
| `openId` | vivo 唯一标识，AI-KS 用这个做用户存档 key |
| `nickName` | vivo 用户昵称 |
| `smallAvatar` / `biggerAvatar` | vivo 用户头像 |
| `gender` | 性别：0 保密 / 1 男 / 2 女 |
| `clientConfig` | 后台下发的 JSON 配置，可按 key 读 |

## 6. 游戏端示例

vivo 小游戏侧伪代码（服务端验签路径）：

```js
const API_BASE = 'http://<server-host>:8007/api'; // 远程不要写 localhost
const PKG_NAME = 'com.example.vivogame';

qg.login({
  success: async (res) => {
    if (!res.token) {
      console.error('vivo qg.login 没返回 token');
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/vivo/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pkgName: PKG_NAME,
          token: res.token,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error('AI-KS vivo 登录失败', data);
        // 失败提示用户，不要自动重试调用 qg.login
        // 建议提供"点击屏幕重新登录"入口
        return;
      }

      console.log('vivo openId', data.openId);
      console.log('clientConfig', data.clientConfig);
      // 把 openId / 资料 / 配置 应用到游戏运行参数
    } catch (e) {
      console.error('AI-KS 网络异常', e);
    }
  },
  fail: (err) => {
    console.error('qg.login failed', err);
  },
});
```

注意：

- vivo 1203+ 客户端可以直接从 `qg.login` 拿到 `openId`，但 AI-KS **不接受**客户端直传 openId（客户端可伪造）。**统一走 token 路径**。
- `qg.login` 之前先调 `qg.getSystemInfoSync()` 校验 `platformVersionCode >= 1063` 再调（vivo 官方要求）。

## 7. 常见错误

接口错误格式（全局 `ApiExceptionFilter`）：

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Vivo game com.example.vivogame is not configured"
}
```

常见情况：

| 状态码 | message | 处理 |
| --- | --- | --- |
| `400` | Zod 校验错误（如 `pkgName` / `token` 为空） | 检查请求体字段名与值 |
| `404` | `Vivo game <pkgName> is not configured` | 先在后台 "vivo 游戏" 页录入该 pkgName |
| `502` | `vivo token 已失效：...` | token 过期或已被消费，重新调 `qg.login` |
| `502` | `vivo 用户拒绝登录：...` | 引导用户检查手机 vivo 账号登录状态 |
| `502` | `vivo 登录异常：...` | 检查网络与手机账户 |
| `502` | `vivo userInfo 失败：...` | 后台 `appKey` / `appSecret` 与 vivo 开发者平台是否同一应用 |
| `ERR_CONNECTION_REFUSED` | — | API 地址不对（不要写远程服务器为 `localhost`） |

**失败处理建议（vivo 官方约定）：**

1. 显式提醒用户登录失败
2. 失败后**不要**自动重试调用 `qg.login`
3. 提供"点击屏幕重新登录"的入口
4. 失败时游戏可降级为不依赖 vivo 账号继续运行

## 8. curl 联调

健康检查：

```bash
curl http://127.0.0.1:8007/api/health
```

模拟登录（pkgName 必须先在后台录入）：

```bash
curl -X POST http://127.0.0.1:8007/api/vivo/sessions \
  -H 'Content-Type: application/json' \
  --data '{"pkgName":"com.example.vivogame","token":"<真实 5min 内的 token>"}'
```

> token 是 `qg.login` 在真机环境返回的真实 token，不能伪造——vivo 服务端会校验签名 + token 匹配。

## 9. 最小验收

游戏端接入完成只需要确认：

1. `GET /api/health` 返回 `status=ok`
2. `POST /api/vivo/sessions` 返回非空 `openId`
3. 后台 "vivo 游戏" 页里该 `pkgName` 的游戏存在（前提）
4. 登录记录已写入数据库 `vivo_login_record` 表（验证可走 Prisma Studio 或 SQL）
