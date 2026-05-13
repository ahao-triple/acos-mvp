/**
 * 启动加载页 LoadingScreen（规范 §三 P1 / 合规要素清单 §5）。
 *
 * 10 个元素（顶 → 底）：
 *   1 著作权人               2 软著登记号 SRxxxxxxxxxx
 *   3 游戏主标题             4 副标题（可选，本游戏未使用）
 *   5 状态文案               6 装饰动画（背景圆斑）
 *   7 进度条（1-2 秒动画，不绑定真实加载进度）
 *   8 提示文案
 *   9 适龄提示图标（CADPA 12+，左下角，矢量绘制；PNG 备用见注释）
 *   10 健康游戏忠告（标题 + 4 行 8 句固定文本）
 *
 * 交互：纯展示，无任何用户输入；进度条 1.5 秒动画结束后 dispatch 'loadingDone'
 *       由 controller 切 screen='menu'。
 *
 * 矢量适龄图标参考 commit c28971a `src/render/loadingScreen.ts` 的 drawAgeRatingVector：
 *   100×128 px（满足 CADPA ≥100×100 合规下限）
 *   外框 白底 黑边 / 蓝色块 / 白字 "12+ / CADPA" / 黑字 "适龄提示"
 */
import { Container, Graphics } from "pixi.js";
import type { AppViewState } from "../../app/controller";
import { createText } from "../ui/text";
import type { PixiScreen, ScreenContext } from "./base";

// 加载动画时长（毫秒）。规范要求 1-2 秒；旧 Canvas 版用 1500。
const LOADING_DURATION_MS = 1500;

// 进度条几何（与旧 loadingScreen.ts 一致，375 屏宽中心）
const PROGRESS_X = 145;
const PROGRESS_Y = 620;
const PROGRESS_WIDTH = 460;
const PROGRESS_HEIGHT = 38;
const PROGRESS_FILL_INSET = 4;
const TEXT_COLOR = 0x1a2332;

export class LoadingScreen implements PixiScreen {
  readonly container: Container;
  private readonly progressFill: Graphics;
  private readonly decorativeAnim: Graphics;
  private startMs = -1;
  private dispatched = false;

  constructor(private readonly ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = "loading";

    // ─── 元素 1-2：顶部 著作权人 + 软著登记号 ───
    // TODO(legal): 上线前需替换为真实著作权人 + 软著号。当前 placeholder。
    this.container.addChild(
      createText({
        text: "著作权人：谢金霞",
        size: 22,
        color: TEXT_COLOR,
        x: 375,
        y: 98,
      }),
    );
    this.container.addChild(
      createText({
        text: "软著登记号：2024SA0032478",
        size: 22,
        color: TEXT_COLOR,
        x: 375,
        y: 132,
      }),
    );

    // ─── 元素 3：游戏主标题 ───
    // 8 字 × 字号 60 ≈ 480 px，stage 宽 750 居中安全
    this.container.addChild(
      createText({
        text: "全民爆梗游戏软件",
        size: 60,
        color: TEXT_COLOR,
        x: 375,
        y: 280,
      }),
    );

    // ─── 元素 5 + 8：状态/提示文案 ───
    this.container.addChild(
      createText({
        text: "资源加载中，请稍候",
        size: 28,
        color: TEXT_COLOR,
        x: 375,
        y: 360,
      }),
    );
    this.container.addChild(
      createText({
        text: "请保持网络畅通",
        size: 22,
        color: TEXT_COLOR,
        x: 375,
        y: 720,
      }),
    );

    // ─── 元素 6：装饰动画（底层背景圆斑，alpha 脉冲） ───
    // 这是装饰；每帧 update 中改 alpha。
    this.decorativeAnim = new Graphics();
    const ringColors = [0xd7d1c5, 0xf59e0b];
    for (let i = 0; i < 6; i += 1) {
      const r = 60 + i * 28;
      this.decorativeAnim
        .circle(375, 440, r)
        .stroke({ color: ringColors[i % 2], width: 1.2, alpha: 0.35 });
    }
    this.container.addChildAt(this.decorativeAnim, 0); // 放最底
    this.decorativeAnim.alpha = 0.8;

    // ─── 元素 7：进度条 ───
    // 边框
    const progressFrame = new Graphics();
    progressFrame
      .roundRect(PROGRESS_X, PROGRESS_Y, PROGRESS_WIDTH, PROGRESS_HEIGHT, 8)
      .fill({ color: 0xffffff, alpha: 0.88 })
      .stroke({ color: 0xd7d1c5, alpha: 1, width: 2 });
    this.container.addChild(progressFrame);
    // 填充（每帧 update 中 clear + redraw）
    this.progressFill = new Graphics();
    this.container.addChild(this.progressFill);

    // ─── 元素 9：适龄提示图标 CADPA 12+ ───
    this.container.addChild(this.buildAgeRatingBadge(60, 940));

    // ─── 元素 10：健康游戏忠告（固定文本，含标题 + 4 行 8 句） ───
    this.container.addChild(
      createText({
        text: "健康游戏忠告",
        size: 26,
        color: TEXT_COLOR,
        x: 375,
        y: 1110,
      }),
    );
    this.container.addChild(
      createText({
        text: "抵制不良游戏，拒绝盗版游戏。",
        size: 20,
        color: TEXT_COLOR,
        x: 375,
        y: 1150,
      }),
    );
    this.container.addChild(
      createText({
        text: "注意自我保护，谨防受骗上当。",
        size: 20,
        color: TEXT_COLOR,
        x: 375,
        y: 1180,
      }),
    );
    this.container.addChild(
      createText({
        text: "适度游戏益脑，沉迷游戏伤身。",
        size: 20,
        color: TEXT_COLOR,
        x: 375,
        y: 1210,
      }),
    );
    this.container.addChild(
      createText({
        text: "合理安排时间，享受健康生活。",
        size: 20,
        color: TEXT_COLOR,
        x: 375,
        y: 1240,
      }),
    );
  }

  show(_view: AppViewState, nowMs: number): void {
    this.container.visible = true;
    this.startMs = nowMs;
    this.dispatched = false;
    this.renderProgress(0);
  }

  hide(): void {
    this.container.visible = false;
  }

  update(_view: AppViewState, nowMs: number): void {
    if (this.startMs < 0) {
      this.startMs = nowMs;
    }
    const elapsed = nowMs - this.startMs;
    const progress = Math.max(0, Math.min(1, elapsed / LOADING_DURATION_MS));
    this.renderProgress(progress);

    // 装饰动画：alpha 缓慢脉冲（0.6 - 1.0），让页面"有动静"不死板
    const pulse = 0.5 + Math.sin(nowMs / 320) * 0.5;
    this.decorativeAnim.alpha = 0.6 + pulse * 0.4;

    if (progress >= 1 && !this.dispatched) {
      this.dispatched = true;
      this.ctx.dispatch({ type: "loadingDone" });
    }
  }

  dispose(): void {
    this.container.destroy({ children: true });
  }

  private renderProgress(progress: number): void {
    const fillWidth = Math.max(
      0,
      (PROGRESS_WIDTH - PROGRESS_FILL_INSET * 2) * progress,
    );
    this.progressFill.clear();
    if (fillWidth <= 0) return;
    this.progressFill
      .roundRect(
        PROGRESS_X + PROGRESS_FILL_INSET,
        PROGRESS_Y + PROGRESS_FILL_INSET,
        fillWidth,
        PROGRESS_HEIGHT - PROGRESS_FILL_INSET * 2,
        6,
      )
      .fill({ color: 0xf59e0b });
  }

  /**
   * 矢量适龄图标（CADPA 12+）：100×128 px，参照旧 loadingScreen.ts drawAgeRatingVector。
   * 满足 CADPA ≥100×100 合规下限。
   *
   * 备用：`public-pack/assets/age-rating-12plus.png` 官方 PNG 已存档；
   * 若矢量版被审核驳回，可加载 PNG 替换：用 Pixi `Assets.load('assets/age-rating-12plus.png')`
   * + Sprite 替换 Container 即可。
   */
  private buildAgeRatingBadge(x: number, y: number): Container {
    const c = new Container();
    const width = 100;
    const height = 128;
    const padding = 6;
    const blockBottom = 100;
    const cx = width / 2;

    // 外框 白底 黑边
    const frame = new Graphics();
    frame
      .roundRect(0, 0, width, height, 12)
      .fill({ color: 0xffffff })
      .stroke({ color: 0x000000, width: 3 });
    c.addChild(frame);

    // 蓝色块（顶部主区）
    const block = new Graphics();
    block
      .roundRect(
        padding,
        padding,
        width - padding * 2,
        blockBottom - padding,
        8,
      )
      .fill({ color: 0xbfeeff });
    c.addChild(block);

    // 三段文字走 createText 统一 BitmapText 路径，绕开 vivo Canvas2D fillText alpha bug
    // "CADPA" 原设计是衬线字体，atlas 走 SourceHanSans Bold（非衬线），妥协换"能稳定显示"
    const tw1 = createText({ text: "12+", size: 40, color: TEXT_COLOR });
    tw1.position.set(cx, 44);
    c.addChild(tw1);

    const tw2 = createText({ text: "CADPA", size: 14, color: TEXT_COLOR });
    tw2.position.set(cx, 82);
    c.addChild(tw2);

    const tw3 = createText({ text: "适龄提示", size: 18, color: TEXT_COLOR });
    tw3.position.set(cx, 116);
    c.addChild(tw3);

    c.position.set(x, y);
    return c;
  }
}
