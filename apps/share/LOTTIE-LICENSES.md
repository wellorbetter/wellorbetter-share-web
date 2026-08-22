# Lottie 资产许可清单（T306）

当前状态：**未引入任何 Lottie 资产**。本文件是引入门禁，新增任何 `.json` / `.tgs` 动画前必须更新此清单。

## 允许的来源（白名单）

| 来源 | 许可 | 备注 |
|---|---|---|
| LottieFiles 官方 *Free* 区且标注 CC0 | CC0 | 需存档来源 URL 与下载日期 |
| lottie-web 示例库（MIT 仓库内自带样本） | MIT | 保留上游 LICENSE 副本 |
| 自制（lottie-editor / AE + Bodymovin 导出） | 归项目所有 | 记录制作工具 |

## 禁止

- 未知许可的第三方动画（默认禁止）
- 来源不明的 .tgs / .lottie 打包文件
- 任何含品牌 logo / 水印的素材

## 使用约束（ui-system.md 契约）

- Lottie 仅用于：**加载、空状态、发布成功** 三类反馈，不得用于装饰性循环动画
- 单文件 ≤ 30KB gzip；超过必须用 CSS 骨架替代
- 每处动画必须有非动画 fallback（骨架 / 静态图标）
- 全局遵守 `prefers-reduced-motion: reduce`（design 包 baseStyles 已全局关闭 animation/transition）
- 播放器使用 `lottie-web`（MIT）按需 import（dynamic import），不进首屏 bundle

## 引入流程

1. 确认来源在白名单内，下载原始文件到 `apps/share/public/lottie/<name>.json`
2. 在本文件"当前资产"表登记：文件名 / 来源 URL / 许可 / 大小 / 用途
3. 更新对应组件，提供 fallback
4. 验证 gzip 体积与 reduced-motion 行为

## 当前资产

（无）
