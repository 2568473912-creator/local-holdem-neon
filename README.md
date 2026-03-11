# 霓虹德州俱乐部（本地单机）

当前稳定版本：`v1.0.0`

一个完整本地运行的单机德州扑克牌桌项目：
- 1 名人类玩家 vs 1~10 名 AI
- 标准德州（52 张）
- 短牌德州 6+（36 张，移除 2~5）
- 现金局模式（固定盲注）
- 锦标赛模式（每 N 手自动升盲）
- 锦标赛自动前注（Ante，默认按当前大盲 10% 计算）
- 快速模式（手牌结束后自动开始下一手）
- AI 难度档位（保守 / 标准 / 激进）
- 局中可热切换 AI 难度（HUD）
- 牌桌实时态势面板（筹码排名 / 淘汰记录 / M 值 / 升盲倒计时）
- 态势榜支持“仅在局/全部”与“按筹码/近5手净变化”切换
- 近N手窗口可切换（3/5/10）并参与态势榜排序
- 严格下注顺序、最小加注、全下与多边池结算
- 事件溯源 + 可视化回放（逐步、自动播放、跳阶段）

## 技术栈
- React
- TypeScript
- Vite
- framer-motion（动效）

## 默认短牌规则说明（可配置）
短牌规则位于：
- `src/engine/evaluators/shortDeckRules.ts`

当前默认预设（`defaultShortDeckPreset`）：
- 使用 36 张牌（2~5 移除）
- `A-6-7-8-9` 计作顺子
- `同花 > 葫芦`
- `三条 > 顺子`

说明：短牌不同赛事存在差异。该项目将短牌牌型顺序独立为规则模块，可替换 `categoryOrder` 快速调整。

## 本地运行
```bash
npm install
npm run dev
```

打开浏览器访问控制台输出的本地地址（默认 [http://localhost:5173](http://localhost:5173)）。

## 说明书
- 完整中文说明书见：[用户说明书.md](./用户说明书.md)

## Windows Release 1.0
- 发布目录模板：`release/v1.0.0/windows`
- 打包后可直接双击 `启动游戏.bat` 启动

## Windows 便携一键版（免 Node）
- 生成命令：`npm run desktop:portable:win`
- 输出文件：`release/local-holdem-neon-v1.0.0-windows-portable.zip`
- 解压后双击 `NeonHoldemClub.exe` 即可运行

## 构建
```bash
npm run build
npm run preview
```

## 测试
```bash
npm run test
```

当前已包含规则单测，覆盖：
- 多人全下边池分层
- 平分池奇数筹码分配
- 不足最小加注导致的再加注锁定
- 短码全下不重开加注队列
- AI 街道策略与难度差异场景
- AI 行动教学标签推断
- 回放分析（可疑诈唬线、关键节点阈值、时间线组合筛选）

## 主要架构
- `src/engine/cards.ts`：牌堆与发牌
- `src/engine/evaluators/standardEvaluator.ts`：标准德州评估器
- `src/engine/evaluators/shortDeckEvaluator.ts`：短牌评估器
- `src/engine/evaluators/shortDeckRules.ts`：短牌规则预设
- `src/engine/actionValidation.ts`：合法动作验证
- `src/engine/bettingRound.ts`：下注轮状态机（顺序、最小加注、重开加注）
- `src/engine/potSettlement.ts`：主池/边池/分池结算
- `src/engine/ai.ts`：AI 决策
- `src/engine/handEngine.ts`：整手流程（翻前->翻牌->转牌->河牌->摊牌/结算）
- `src/replay/replayBuilder.ts`：回放事件建模
- `src/replay/replayReconstructor.ts`：按事件重建桌面快照
- `src/replay/replayAnalysis.ts`：回放分析（关键节点、可疑诈唬线、时间线筛选）
- `src/ui/components/*`：菜单、牌桌、历史中心、回放查看器

## 功能覆盖
- 完整持续牌局循环，庄位/盲注轮转
- 淘汰机制与比赛结束判定
- 支持平分底池与奇数筹码分配
- 记录每手完整结构化历史：行动序列、边池事件、摊牌结果、派奖明细
- 回放中可逐步查看每一步桌面状态与时间线
- 回放中心支持按玩法/局制/AI 难度筛选，并提供教学标签统计（进攻频率、压力弃牌占比、Top 标签）
- 回放侧栏提供每位玩家单手筹码变化（起始 → 结束）
- 回放关键节点支持筛选（全部 / 高压 / 诈唬线 / 淘汰），并标记可疑诈唬线
- 回放支持高压阈值（2/4/6/8/10 BB）与时间线组合筛选（高压/诈唬/淘汰/教学/摊牌）
