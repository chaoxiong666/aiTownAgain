# AI Town 重构 · 第一次工程落地任务企划书

> 日期：2026-05-20
> 编制：队长 1 人 + 队员 4 人，共 5 人
> 基于：ai-town-cn 当前代码库（React + Convex + PixiJS）

---

## 零、项目现状回顾

| 组件 | 关键文件 | 当前状态 |
|------|---------|----------|
| 游戏引擎 | `convex/engine/` + `convex/aiTown/` | ✅ Tick/Step 循环、寻路、对话状态机 |
| Agent 智能 | `convex/agent/` | ✅ LLM 对话生成、向量记忆、嵌入缓存 |
| LLM 配置 | `convex/util/llm.ts` | ✅ 阿里云 Dashscope，全局单模型 |
| PixiJS 渲染 | `src/components/PixiGame.tsx` | ✅ 精灵动画、地图渲染、视口控制 |
| UI 框架 | `src/App.tsx` + `src/components/Game.tsx` | ✅ 双栏布局（游戏区 + 右侧面板） |
| 8 个角色 | `data/characters.ts` | ✅ 全角色解锁，中文化 identity/plan |
| 汉化 | 全局 | ⚠️ 部分完成 |
| 人类玩家系统 | `src/components/PlayerDetails.tsx` + `InteractButton` | ⚠️ 待移除 |

---

## 一、分工总览

| 角色 | 任务数 | 负责领域 | 启动条件 |
|------|--------|---------|---------|
| **队长** | 5 项 | 去玩家 + 引擎参数 + 模拟控制 + 对话日志 + Agent prompt 重构 + 监控 API | 无依赖 |
| **队员A** | 2 项 | 布局重构 + 场景系统（数据/选择器/切换） | 等队长 P4-001 完成（约 3-4 天） |
| **队员B** | 2 项 | 多模型 LLM 支持 + NPC 管理系统 | **无依赖，即刻开工** |
| **队员C** | 2 项 | 全局数据仪表盘 + NPC 详情面板 | **无依赖，即刻开工** |
| **队员D** | 3 项 | 手动撮合 + 悬停 tooltip + 全中文化 | **无依赖，即刻开工** |

**关键变化：布局不再由队长做（消除瓶颈），多模型支持由队员B 端到端负责（谁用谁做）。**

---

## 二、架构总览（重构完成后）

```
                         ┌─────────────────────────┐
                         │    全局数据仪表盘        │  ← 队员C
                         └───────────┬─────────────┘
                                     │
                                     ▼
┌──────────────┐    ┌────────────────────────────────────────────┐
│   使用者      │───▶│           Convex 后端                        │
│  (纯观战)     │    │                                              │
└──────────────┘    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │  场景    │  │  NPC    │  │  模拟    │  │
  ┌──────────────┐  │  │ (队员A)  │  │ (队员B)  │  │  控制    │  │
  │  左侧面板    │──▶│  └──────────┘  └──────────┘  └──────────┘  │
  │              │  │                                              │
  │ [队员A:场景] │  │  ┌──────────────────────────────────────┐  │
  │ [队员B:NPC]  │  │  │         游戏引擎 (Tick/Step)          │  │
  │ [队员D:撮合] │  │  │  Agent → prompt → 寻路 → 对话 → 记忆│  │
  └──────────────┘  │  └──────────────────────────────────────┘  │
                    │                                              │
  ┌──────────────┐  │  ┌────────────┐ ┌────────────────────────┐  │
  │  右侧面板    │◀─│  │ 对话日志   │ │  世界状态监控 API      │  │
  │  [队员C:详情]│  │  │ 持久化     │ │  (队长)                │  │
  └──────────────┘  │  │ (队长)     │ └────────────────────────┘  │
                    │  └────────────┘                              │
                    └────────────────────────────────────────────┘
```

---

## 三、任务分解

---

## 队长任务 · 引擎 & 后端基础设施

---

### `P4-001` 去除玩家互动

> 移除人类玩家参与，变为纯观战模式。**最底层改动，Week 1 前 3-4 天必须完成。**

- **前置任务**：无
- **负责人**：队长
- **状态**：🔴 待开始

- [ ] `InteractButton` 组件删除（App.tsx 移除引用）
- [ ] `MessageInput` 组件删除或禁用
- [ ] `sendInput` hook 移除人类调用路径
- [ ] `PlayerDetails` 移除 `isMe` / `canInvite` / `acceptInvite` / `rejectInvite` / `leaveConversation` 所有人类交互逻辑
- [ ] `PlayerDetails` 改为纯观察者视角：点击 NPC → 展示信息，无操作按钮
- [ ] `Game.tsx` 移除 `humanTokenIdentifier` 相关逻辑
- [ ] `Player.join` 仅保留 AI 加入路径
- [ ] `MAX_HUMAN_PLAYERS` / `HUMAN_IDLE_TOO_LONG` 常量标记废弃
- [ ] 世界初始化不再创建人类玩家槽位
- [ ] 帮助弹窗内容更新：移除"互动"部分

```
修改:
  src/App.tsx, src/components/Game.tsx, src/components/PlayerDetails.tsx
  src/components/MessageInput.tsx, src/hooks/sendInput.ts
  convex/aiTown/player.ts, convex/aiTown/main.ts, convex/constants.ts
```

---

### `P4-002` 游戏参数优化

> 缩小地图、提高移速、调优对话触发参数，让 NPC 更活跃。

- **前置任务**：P4-001（参数在观战模式下调整更安全）
- **负责人**：队长
- **状态**：🔴 待开始

- [ ] 相机 zoom 缩到约 70%（不物理改地图，降低碰撞风险）
- [ ] 移动速度 `0.75 → 1.5 tiles/s`
- [ ] `CONVERSATION_DISTANCE`：`1.3 → 1.8`
- [ ] `CONVERSATION_COOLDOWN`：`15000 → 8000ms`
- [ ] `INVITE_TIMEOUT`：`60000 → 30000ms`
- [ ] `INVITE_ACCEPT_PROBABILITY`：`0.8 → 0.95`
- [ ] `MAX_CONVERSATION_DURATION`：`10min → 5min`
- [ ] 手动测试：NPC 在 30s 内至少触发 1 次对话

```
修改:
  convex/constants.ts, data/gentle.js（如需）
```

---

### `P4-003` 模拟控制系统

> 暂停 / 1x / 2x / 5x 速度控制，通过调整 Step 间隔实现。

- **前置任务**：P4-001
- **负责人**：队长
- **状态**：🔴 待开始

- [ ] `SimSpeed` 类型：`paused | 1x | 2x | 5x`
- [ ] Convex mutation `setSimSpeed(worldId, speed)`
  - [ ] `paused`：不再调度 `runStep`
  - [ ] `1x`：STEP_INTERVAL = 1000ms
  - [ ] `2x`：STEP_INTERVAL = 500ms
  - [ ] `5x`：STEP_INTERVAL = 200ms
- [ ] `SimControl` UI 组件：按钮组，当前速度高亮
- [ ] 速度切换即时生效

```
修改: convex/aiTown/main.ts, convex/constants.ts
新增: src/components/SimControl.tsx
```

---

### `P4-004` 对话日志持久化

> Convex 新表 + 查询 API，对话历史按会话归档、支持分页和筛选。

- **前置任务**：无（独立后端任务）
- **负责人**：队长
- **状态**：🔴 待开始

- [ ] 新增 `conversationLogs` 表：
  - [ ] 字段：`worldId`, `participants[]`（角色名+模型名）, `startedAt`, `endedAt`, `messageCount`, `topic`, `messages[]`
  - [ ] 索引：`worldId` + `startedAt`
- [ ] Conversation 结束/销毁时自动写入日志
- [ ] `listConversationLogs(worldId, {limit, cursor, playerId, startTime, endTime})` — 分页+筛选
- [ ] `getConversationLog(conversationId)` — 完整会话
- [ ] 过期日志自动清理（7 天 TTL）
- [ ] 单元测试：写入 + 分页 + 按NPC筛选 + 按时间筛选

```
修改: convex/schema.ts, convex/aiTown/conversation.ts
新增: convex/query/conversationLogs.ts
```

---

### `P4-005` Agent 对话 Prompt 系统重构

> 重构 Agent 对话生成链路：支持场景 prompt 注入、角色深度定制、模型特定 prompt 模板。

- **前置任务**：P4-001, P4-002（需要知道场景 prompt 和引擎参数）
- **负责人**：队长
- **状态**：🔴 待开始

- [ ] 对话 system prompt 拆分为三层模板：
  - [ ] 基础层：角色 identity + plan（已有，检查优化）
  - [ ] 场景层：当前场景 prompt 注入（如"你在热闹的广场上"）
  - [ ] 行为层：对话规则（消息长度、风格、结束条件）
- [ ] `buildConversationPrompt(agent, scene, context)` 函数：组合三层模板
- [ ] Agent tick 中读取世界 `scenePrompt` 字段传入对话生成
- [ ] 对话结束条件优化：基于话题自然结束而非固定消息数
- [ ] prompt 模板全部中文化
- [ ] 单元测试：不同场景 prompt 生成不同风格的对话

```
修改:
  convex/agent/conversation.ts        # prompt 构建逻辑
  convex/aiTown/agent.ts              # 传入 scenePrompt
  convex/aiTown/agentOperations.ts    # 异步操作传入上下文
新增:
  convex/agent/promptTemplates.ts     # 三层 prompt 模板
```

---

### `P4-006` 世界状态监控 API

> 为仪表盘和 NPC 详情面板提供数据查询接口。

- **前置任务**：无（可基于现有表结构先行开发）
- **负责人**：队长
- **状态**：🔴 待开始

- [ ] `getWorldStats(worldId)` query：
  - [ ] 活跃对话数、总 NPC 数、在线 NPC 数
  - [ ] 各模型 NPC 分布统计
  - [ ] 今日对话总轮数 / 总消息数
  - [ ] 世界运行时长
- [ ] `getAgentStats(agentId)` query：
  - [ ] Token 消耗（当前会话 + 累计）
  - [ ] API 调用次数、平均响应延迟
  - [ ] 最近对话话题列表
- [ ] `getRecentActivity(worldId, limit)` query：最近 N 条世界事件
- [ ] 统计数据通过 Convex `useQuery` 实时更新
- [ ] 单元测试：各 query 返回值和边界情况

```
新增:
  convex/query/worldStats.ts          # 世界统计查询
  convex/query/agentStats.ts          # Agent 统计查询
```

---

## 队员A 任务 · 布局 + 场景系统

---

### `P4-007` 布局重构 + 左侧面板框架

> 将双栏改为三栏，创建 LeftPanel 容器，定义子组件插槽接口。**队员A 拥有 LeftPanel 的全部控制权。**

- **前置任务**：队长 P4-001（等 Game.tsx 中 humanPlayer 逻辑清理后开始）
- **负责人**：队员A
- **状态**：🔴 待开始
- **启动策略**：第 1 周前半段等队长 P4-001；期间准备场景数据 + SceneSelector 独立开发；P4-001 合并后 1-2 天完成布局

- [ ] `Game.tsx` 双栏 → 三栏：左侧面板(260px) + 游戏区(flex-1) + 右侧面板(384px)
- [ ] 左侧面板可折叠，折叠状态存 localStorage
- [ ] `LeftPanel.tsx` 创建，定义三个子组件接口：
  ```tsx
  // 队员A 自己实现
  <SceneSelector currentSceneId onSceneChange />
  // 队员B 实现，队员A 只 import
  <ModelNPCManager availableModels npcsByModel onGenerateNPC onRemoveNPC />
  // 队员D 实现，队员A 只 import
  <ForceConversation npcList onForceConversation />
  ```
- [ ] 移动端（< 1024px）：左侧面板变为底部抽屉
- [ ] 接口约定写入共享文档，队员 B/D 按接口导出即可

```
新增: src/components/LeftPanel.tsx
修改: src/components/Game.tsx（三栏布局）
```

---

### `P4-008` 场景系统

> 场景数据定义 + SceneSelector 组件 + 场景切换逻辑。

- **前置任务**：P4-007（需要 LeftPanel 容器）
- **负责人**：队员A
- **状态**：🔴 待开始
- **启动策略**：第 1 周即可在独立文件开发 SceneSelector + 场景数据，第 2 周嵌入 LeftPanel

- [ ] `data/scenes.ts` — `Scene` 类型：`{ id, name, description, prompt, mapData? }`
- [ ] 至少 4 个预设场景：小镇广场、咖啡馆、图书馆、公园
- [ ] 每个场景有中文描述 prompt（影响 NPC 对话主题）
- [ ] `SceneSelector` 组件：列表渲染，当前激活高亮
- [ ] 点击场景 → `switchScene` input → 更新世界 scenePrompt
- [ ] 切换 toast："场景已切换至「{场景名}」"
- [ ] 可选：不同场景使用不同地图瓦片（Phase 4 可先用同地图+不同 prompt）

```
新增: data/scenes.ts, src/components/SceneSelector.tsx
新增: convex/aiTown/sceneInputs.ts（switchScene handler）
```

---

## 队员B 任务 · 多模型 + NPC 管理

---

### `P4-009` 多模型 LLM 支持

> 让每个 Agent 可使用不同大模型，端到端负责：从 LLM 配置改造到 Agent 创建链路。

- **前置任务**：无（纯 Convex 后端 + LLM 配置，即刻开工）
- **负责人**：队员B
- **状态**：🔴 待开始

- [ ] `chatCompletion()` 支持可选 `model` 参数覆盖全局配置
- [ ] `fetchEmbedding()` 同理支持可选 `embeddingModel` 参数
- [ ] `createAgent` input 扩展：新增 `model` 参数（默认 `qwen3.5-flash`）
- [ ] Agent 对象增加 `modelName` 字段，序列化/反序列化支持
- [ ] Agent 调用 LLM 时传入自己的 `modelName`
- [ ] `listAvailableModels()` query：从环境变量 `AVAILABLE_MODELS` 读取
- [ ] 环境变量 `AVAILABLE_MODELS` 定义可用模型列表
- [ ] 单元测试：不同 model 的 Agent 调用正确 LLM

```
修改:
  convex/util/llm.ts                  # chatCompletion/embedding 支持 model 覆盖
  convex/aiTown/agent.ts              # Agent 增加 modelName
  convex/aiTown/agentInputs.ts        # createAgent 支持 model 参数
  convex/agent/conversation.ts        # 传入 Agent model
  convex/aiTown/agentOperations.ts    # 异步操作传入 model
新增:
  convex/query/models.ts              # listAvailableModels
```

---

### `P4-010` NPC 管理系统

> 模型列表 → 随机角色 → 生成 NPC → 状态管理 → 移除 NPC 的完整 UI。

- **前置任务**：P4-009（多模型支持完成后对接真实 Agent 创建）
- **负责人**：队员B
- **状态**：🔴 待开始
- **启动策略**：第 1 周做多模型后端；第 2 周开发 ModelNPCManager UI，用 mock 数据调试；第 3 周对接真实 API

- [ ] `ModelNPCManager` 组件：
  - [ ] 模型列表：调用 `listAvailableModels()`，每项显示模型名+颜色标签+NPC 数量
  - [ ] 点击模型 → 从 8 个角色池随机抽取未使用角色 → `createAgent({model})`
  - [ ] 生成成功 toast："「{角色名}」已加入小镇（{模型名}）"
  - [ ] 角色池耗尽提示"所有角色已在小镇中"
- [ ] NPC 列表：每个模型下展示 NPC（角色名 + 状态：空闲/对话中/行走中）
- [ ] 移除 NPC：点击 × → 确认 → `leaveWorld` input → toast
- [ ] "清空所有 NPC"按钮（二次确认）
- [ ] 模型颜色标签与地图 tooltip 颜色一致

```
新增: src/components/ModelNPCManager.tsx
```

---

## 队员C 任务 · 数据监控系统

---

### `P4-011` 全局数据仪表盘

> 页面顶部横向面板，实时汇总世界运行数据。

- **前置任务**：无（即刻开工，先用现有 query，后续对接队长 P4-006 监控 API）
- **负责人**：队员C
- **状态**：🔴 待开始

- [ ] `Dashboard` 组件：横向条形面板，可折叠
- [ ] 实时展示：活跃对话数 / 总 NPC 数 / 在线数 / 各模型分布 / 今日消息数 / 运行时长
- [ ] 数据通过 Convex `useQuery` 实时更新
- [ ] 数值变化过渡动画
- [ ] 对接队长 P4-006 的 `getWorldStats` query 获取精确 Token 统计

```
新增: src/components/Dashboard.tsx
```

---

### `P4-012` NPC 详情面板增强

> 重写 PlayerDetails：标签页式展示对话记录 + 模型统计，纯观察者视角。

- **前置任务**：无（即刻开工，现有 PlayerDetails 可独立改造）
- **负责人**：队员C
- **状态**：🔴 待开始

- [ ] 两个标签页：
  - [ ] **对话记录**：复用 Messages 组件，无对话时显示占位文本
  - [ ] **模型统计**：模型名、Token 消耗、API 调用次数、平均延迟、话题摘要
- [ ] 对接队长 P4-006 的 `getAgentStats` query
- [ ] 移除所有人类操作按钮（开始对话/接受/拒绝/离开）
- [ ] 面板标题：角色名 + 模型颜色标签

```
修改: src/components/PlayerDetails.tsx
新增: src/components/ModelStatsTab.tsx
```

---

## 队员D 任务 · 交互与润色

---

### `P4-013` 手动触发对话 + 悬停 Tooltip + 全中文化

> 三个独立子模块，文件隔离，可并行推进。

- **前置任务**：中文化+tooltip 无依赖即刻开工；手动撮合依赖队员B 的 NPC 列表
- **负责人**：队员D
- **状态**：🔴 待开始

**子任务 A — 手动触发对话：**

- [ ] `ForceConversation` 组件：两个下拉框（选 NPC）+ "发起对话"按钮
- [ ] 选满 2 个不同 NPC 后按钮激活
- [ ] `forceConversation` input handler：
  - [ ] 两个 NPC 中断当前活动 → 互相走向对方 → 自动开始对话
  - [ ] 已在对话中的 NPC 先离开再加入
- [ ] 触发 toast："正在撮合「{A}」与「{B}」..."
- [ ] 距离 > 20 tiles 时先移动到位

**子任务 B — 悬停 Tooltip：**

- [ ] hover NPC 精灵 → React 层绝对定位 div："{角色名} · {模型名}"
- [ ] 坐标从 PixiJS `mouseover` 事件获取 → `getBoundingClientRect` 转换
- [ ] 200ms 防抖消失，半透明深色背景+白色文字+圆角

**子任务 C — 全面中文化：**

- [ ] 扫描 `src/` / `convex/` / `data/` 所有英文字符串
- [ ] 更新帮助弹窗：纯观战 + 管理面板使用说明
- [ ] 所有 toast/按钮/错误提示/浏览器标题为中文
- [ ] `convex/agent/conversation.ts` prompt 模板检查

```
新增: src/components/ForceConversation.tsx, src/components/NPCModelTooltip.tsx
修改: src/components/Player.tsx, convex/aiTown/agentInputs.ts
      convex/aiTown/conversation.ts, src/App.tsx, 全局各文件英文→中文
```

---

## 共享任务

---

### `P4-014` 集成联调测试

> 全链路功能测试，确保所有功能协同工作，无回归问题。

- **前置任务**：P4-001 ~ P4-013 全部完成
- **负责人**：全员 5 人联合
- **状态**：🔴 待开始

| # | 测试场景 | 覆盖 |
|---|---------|------|
| 1 | 启动 → 无互动按钮 → 纯观战 | P4-001 |
| 2 | 左侧面板折叠/展开 → 三栏响应式 | P4-007 |
| 3 | 选择场景 → 切换 → toast | P4-008 |
| 4 | 不同模型生成 NPC → 角色出现 → 模型标签正确 | P4-009 + P4-010 |
| 5 | 多模型 NPC 对话 → 各自使用正确模型 | P4-009 |
| 6 | 仪表盘实时数据 → 对话数/NPC分布/运行时长 | P4-011 + P4-006 |
| 7 | 点击 NPC → 对话记录 + 模型统计标签页 | P4-012 |
| 8 | hover NPC → tooltip "{名} · {模型}" | P4-013-B |
| 9 | 手动撮合两个 NPC → 走近 → 对话 | P4-013-A |
| 10 | 暂停 → 1x → 2x → 5x 速度变化 | P4-003 |
| 11 | 刷新 → 历史对话日志翻看/筛选 | P4-004 |
| 12 | 全局无英文 | P4-013-C |
| 13 | 角色池耗尽处理 | P4-010 |
| 14 | 不同场景 prompt 影响对话风格 | P4-005 + P4-008 |

---

## 四、任务依赖图

```
当前代码库
    │
    ├── P4-001 去玩家 · 队长 (Day 1-4) ──┬── P4-002 参数 · 队长
    │                                     ├── P4-003 模拟控制 · 队长
    │                                     ├── P4-005 prompt重构 · 队长
    │                                     │
    │                                     └── P4-007 布局 · 队员A
    │                                           │
    │                                           └── P4-008 场景 · 队员A
    │
    ├── P4-004 对话日志 · 队长 ──────────── 独立
    ├── P4-006 监控API · 队长 ──────────── 独立
    │
    ├── P4-009 多模型 · 队员B ──────────── 独立，即刻开工
    │      │
    │      └── P4-010 NPC管理 · 队员B ──── 需 P4-007(LeftPanel) + P4-009
    │
    ├── P4-011 仪表盘 · 队员C ──────────── 独立，即刻开工
    ├── P4-012 NPC详情 · 队员C ─────────── 独立，即刻开工
    │
    ├── P4-013-B tooltip · 队员D ──────── 独立，即刻开工
    ├── P4-013-C 中文化 · 队员D ──────── 独立，即刻开工
    └── P4-013-A 撮合 · 队员D ────────── 需 P4-007(LeftPanel) + P4-010(NPC列表)
            │
            ▼
        P4-014 集成联调 · 全员
```

**并行度：**
- Week 1 前半：队长 P4-001；队员B P4-009；队员C P4-011+P4-012；队员D P4-013-B+P4-013-C — **4 人完全并行，无人等队长**
- Week 1 后半-2：队长 P4-002+003+005+006；队员A P4-007+008；队员B P4-010；队员C/D 继续 — **5 人完全并行**
- Week 3：全部收尾
- Week 4：联合集成

---

## 五、时间线

```
               Day 1-4      Day 5-7     Week 2       Week 3       Week 4
队长 ────  P4-001 ████████████
                    P4-002     ████████████
                    P4-003          ████████████
                    P4-004          ██████████████████
                    P4-005               ██████████████████
                    P4-006               ██████████████████
                                                             P4-014 ████

队员A ─── [准备场景数据] ████
                    P4-007     ████████████
                               P4-008     ████████████████
                                                             P4-014 ████

队员B ───  P4-009 多模型 ██████████████████
                               P4-010     ████████████████
                                                             P4-014 ████

队员C ───  P4-011 仪表盘 ████████████████████████
           P4-012 NPC详情 ████████████████████████
                                                             P4-014 ████

队员D ───  P4-013-C 中文化 ████████████
           P4-013-B tooltip  ████████████
                               P4-013-A 撮合 ████████████████
                                                             P4-014 ████
```

---

## 六、组件接口约定

> 队员A 在 P4-007 中创建 LeftPanel 时确定以下接口，队员B/D 按接口导出即可，互不阻塞。

```typescript
// === 队员A 实现 ===
// src/components/SceneSelector.tsx
interface SceneSelectorProps {
  currentSceneId: string;
  onSceneChange: (sceneId: string) => Promise<void>;
}
export function SceneSelector(props: SceneSelectorProps): JSX.Element;

// === 队员B 实现 ===
// src/components/ModelNPCManager.tsx
interface ModelNPCManagerProps {
  availableModels: string[];
  npcsByModel: Map<string, NPCSummary[]>;
  onGenerateNPC: (model: string) => Promise<void>;
  onRemoveNPC: (npcId: string) => Promise<void>;
}
export function ModelNPCManager(props: ModelNPCManagerProps): JSX.Element;

// === 队员D 实现 ===
// src/components/ForceConversation.tsx
interface ForceConversationProps {
  npcList: NPCSummary[];
  onForceConversation: (npcA: string, npcB: string) => Promise<void>;
}
export function ForceConversation(props: ForceConversationProps): JSX.Element;
```

**LeftPanel 骨架（队员A 提供）：**

```tsx
// src/components/LeftPanel.tsx — 队员A 创建并维护
import { SceneSelector } from './SceneSelector';         // 队员A
import { ModelNPCManager } from './ModelNPCManager';     // 队员B
import { ForceConversation } from './ForceConversation'; // 队员D

export function LeftPanel({ collapsed, onToggle, ...props }: LeftPanelProps) {
  if (collapsed) return <CollapsedBar onExpand={onToggle} />;
  return (
    <div className="left-panel">
      <SceneSelector ... />
      <hr />
      <ModelNPCManager ... />
      <hr />
      <ForceConversation ... />
    </div>
  );
}
```

---

## 七、技术选型

| 问题 | 选择 | 理由 |
|------|------|------|
| UI 框架 | React + Tailwind CSS（现有） | 不引入新依赖 |
| 场景 prompt 存储 | `data/scenes.ts` 静态配置 | 简单灵活 |
| 多模型支持 | `chatCompletion(model?)` 参数覆盖 | 最小改动，向后兼容 |
| 悬停 tooltip | React 层绝对定位 div | 中文渲染可靠，避免 PixiJS 文本坑 |
| 对话日志 | Convex 新表 + 7 天 TTL | 复用 VACUUM |
| Toast | 已有 `react-toastify` | 不新增依赖 |
| 变速 | 调整 `runAfter` 间隔 | 最小侵入引擎 |
| 队员 UI 独立调试 | 各组件用 mock 数据独立跑 | 不需要完整后端 |

---

## 八、风险备忘

| 风险 | 概率 | 缓解方案 |
|------|------|---------|
| 去玩家后对话系统空指针 | 中 | P4-001 完成即验证，`humanPlayer` 判空逐处检查 |
| P4-001 和 P4-007 都改 Game.tsx 导致冲突 | 中 | 队员A 等队长 P4-001 合并后再开始 P4-007（仅 3-4 天），期间做场景数据 |
| 多模型 LLM 调用链路改动较深 | 中 | 参数覆盖模式，`model` 默认可选，不影响现有调用 |
| 不同模型响应速度差异大 | 中 | Agent 操作超时统一 120s，快模型不等慢模型 |
| 三栏+仪表盘布局拥挤 | 中 | 左面板和仪表盘均可折叠 |
| PixiJS hover 坐标转换不准 | 低 | React 层方案，`getBoundingClientRect` 计算 |
| 5 人 git 冲突 | 低 | 每人独立文件，仅 `Game.tsx` 由队长和队员A 先后修改（已排时序） |
| 队员等他人产出时闲置 | 低 | 每个任务都设计了独立开发阶段，mock 数据先行 |
