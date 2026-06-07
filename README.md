# Agent-Team Personality Collaboration Study

本项目根据 `Proposal.md` 实现了一个 web-based human-agent team workspace，用于一个**被试内 A/B** 的 CHI 实验：每位参与者先后与一个「中性人格团队」和一个「角色特定人格团队」协作，比较两者对任务产出、校准依赖和协作体验的影响。系统支持中英文切换，agent API 通过 `.env` 在后端配置，前端不暴露 key。

## 1. 研究问题

- **RQ1（产出与依赖）**：相比中性人格团队，角色特定人格团队是否提升任务产出质量与对建议的校准依赖？
- **RQ2（体验与代价）**：角色特定人格如何影响角色可辨识度、认知负荷、建设性冲突、感知压力与自主感，又带来哪些权衡？

四个固定 agent 角色：

- `Coordinator`：组织讨论、总结分支、推进下一步。
- `Ideator`：发散方案、提出替代方向和类比。
- `Critic`：挑战假设、暴露权衡和失败案例。
- `Verifier`：检查证据、不确定性、隐私、伦理和评估严谨性。

**唯一操控变量**是每个角色是否启用角色特定人格表达（arm = `neutral` / `specific`）。两个 arm 中角色、数量、专长、orchestration、发言顺序、模型、token 上限、UI 完全一致。

## 2. 技术栈

- Frontend: React 19 + TypeScript + Vite
- Backend: Express 5 + TypeScript
- Visualization: Recharts；Icons: lucide-react
- Storage: `data/` 下的本地 JSON / JSONL
- Agent API: OpenAI-compatible `/chat/completions`

Agent key 只在后端读取；JSONL 事件日志便于审计、导出与统计分析。

## 3. 本地运行

```bash
npm install
npm run dev      # 前端 http://localhost:5173，后端 http://localhost:8787
npm run build    # 生产构建
npm run start    # node dist-server/server/index.js
npm run typecheck
npm run audit:study1   # 离线质量审计（见 §9）
```

## 4. 环境变量

真实配置放 `.env`（示例见 `.env.example`，不要提交 `.env`）：

```bash
PORT=8787
CLIENT_ORIGIN=http://localhost:5173
ADMIN_TOKEN=replace-with-admin-token
BLIND_ITEM_SALT=replace-with-stable-secret
AGENT_API_BASE_URL=https://aiping.cn/api/v1
AGENT_API_KEY=replace-with-your-key
AGENT_MODEL=DeepSeek-V4-Flash
AGENT_MODE=live          # 设为 mock 可离线演示，不调真实 API
AGENT_TEMPERATURE=0.7
AGENT_MAX_TOKENS=360
VITE_API_BASE_URL=http://localhost:8787
```

`ADMIN_TOKEN` 默认 fail-closed：未配置时 `/api/analytics`、`/api/export/*`、`/api/rater/*` 拒绝访问，只有本地演示才可设 `ALLOW_UNPROTECTED_ADMIN=true`。`BLIND_ITEM_SALT` 用于生成盲评 opaque item id，正式实验中应保持稳定。

## 5. 页面入口

- `/`：参与者实验（两个协作 block 的完整流程）。
- `/admin`：管理员端，含分析仪表盘、数据导出、盲评入口，需 `ADMIN_TOKEN`。
- `/admin/rater`：盲评入口。

参与者端永远不会返回 arm（人格条件只存在于后端记录），也不展示管理员数据或分析图表。

## 6. 参与者流程（单 session，约 50–60 分钟）

```text
1. 知情同意 + 实验前问卷（AI 熟悉度、信任、怀疑倾向、领域熟悉度、创意自我效能、注意力检查=5）

2. Block 1
   a. 独立写初稿（>= 280 字符质量门槛）
   b. 角色说明（只讲四角色职责，不提人格操控）
   c. 团队协作工作区：3 轮固定 orchestration + 自由定向提问；第 2-3 轮嵌入 seeded suggestions
   d. 提交终稿（>= 480 字符），处理完决策板所有建议
   e. 本轮协作问卷（负荷、可辨识、建设性冲突、压力、自主、信任、人格感知操控检查）

3. 过渡说明 -> Block 2（结构同上，不同题目，不重复角色说明）

4. 对比问卷（两轮头对头偏好）

5. 完成 + 强制 debrief（揭示 seeded flawed 建议）
```

每个 block 的 3 轮编排：

```text
Round 1 Problem framing    Coordinator -> Ideator -> Critic -> Verifier
Round 2 Solution alternatives  同上（嵌入 1 valid + 1 flawed 建议）
Round 3 Risks and evaluation   同上（嵌入 1 valid + 1 flawed 建议）
```

## 7. 条件与平衡

操控为单一被试内因素 arm = {`neutral`, `specific`}。每位参与者两个 block 各占一个 arm，按 4 种 counterbalance 序列轮转分配（见 `src/shared/experiment.ts` 的 `sequences`）：

| 序列 | Block 1 | Block 2 |
| --- | --- | --- |
| S1 | neutral + 题目A | specific + 题目B |
| S2 | specific + 题目A | neutral + 题目B |
| S3 | neutral + 题目B | specific + 题目A |
| S4 | specific + 题目B | neutral + 题目A |

后端按已提交样本量选择最少的序列，保持均衡。

## 8. Seeded Suggestions（行为层信任探针）

每个题目嵌入**结构匹配**的 4 条建议（2 有效 + 2 有缺陷），两题一一对应，使两 block 的校准分数可比。参与者可选 Accept / Reject / Question / Reframe。validity 不向参与者显示。

| 类型 | 题目A | 题目B | source 角色 | 轮次 |
| --- | --- | --- | --- | --- |
| valid | AI vs 同伴反馈对照 | AI vs 第二来源对照 | Ideator | R2 |
| flawed（隐私） | 默认收集学生 prompt/作业/成绩 | 默认抓取员工邮件/文档/决策 | Ideator | R2 |
| valid | 行为指标评估 | 决策质量评估 | Verifier | R3 |
| flawed（评估弱） | 只用满意度评估 | 只用自评信心评估 | Coordinator | R3 |

**防混淆**：有缺陷建议绝不由「本应抓住该缺陷的角色」提出（隐私缺陷不由 Verifier、评估缺陷不由 Critic），使探针可见性不随人格操控变化。系统对每条探针做送达验证（verbatim 或词重叠 ≥ 0.7），在 analytics 的 `probeDeliverySummary` 报告送达率；未faithful 送达者从该探针分析中剔除。

校准评分：
- **lenient（sensitivity）**：valid 被 accepted/reframed 算校准；flawed 被 rejected/questioned/reframed 算校准。
- **strict（confirmatory）**：reframe 仅对 flawed 计分，valid 须 accepted，避免「全部 reframe」拿满分。

## 9. 数据与分析

数据写入 `data/`：

```text
data/
  participants/p_*.json     # 含 sequenceId、两个 block（arm/topic/初稿/终稿/blockSurvey）、preSurvey、finalSurvey
  ratings/rating_*.json     # 匿名盲评，按 (participant, block, stage) 的 opaque itemId
  events.jsonl              # 全部过程事件
```

导出接口（均需 admin token）：`/api/export/participants`、`/api/export/events`、`/api/export/analytics`、以及对应 `.csv`。`participants.csv` 按 (参与者, block) 每行一条，便于把每个 arm 作为独立可分析行。

`/admin` Analytics tab 提供：参与者/完成数、盲评覆盖、**配对均值（specific vs neutral）**、**配对效应量 Cohen's dz**、人格感知操控检查、seeded probe 决策分布、按 arm 的响应长度 parity、完成漏斗、盲评覆盖率与 Krippendorff α。

离线审计：

```bash
npm run audit:study1
```

输出有效样本门槛、序列均衡、盲评覆盖、重复评分、各维度 Krippendorff α，以及 improvement / calibration 的配对差与 dz。

**主分析**为配对比较（每位参与者 specific block 减 neutral block）：配对均值差 + Cohen's dz + bootstrap CI + Wilcoxon signed-rank。四个主检验：方案质量提升、校准依赖（strict）、角色可辨识度、感知压力。稳健性见 `docs/pre-registration.md`。

## 10. 盲评

`/admin/rater` 对匿名单项 proposal item 评分。系统把每个 block 的初稿与终稿拆成独立 item，评分者看不到 arm、题目-arm 映射、participant id，也不知道 item 是初稿还是终稿。盲评 API 只返回 opaque item id；后端反查真实 (participant, block, stage)，并阻止同一 rater 重复评分。建议至少 3 名 rater，报告 Krippendorff α。

## 11. 伦理

研究刻意 seed 有缺陷建议且不预先告知（否则校准依赖无法测量）。结束页强制 debrief，揭示哪些建议是 seeded flawed 及原因，并提示勿在真实系统中实施。不收集真实姓名、成绩等敏感信息。

## 12. 重要文件

- `src/shared/experiment.ts`：arm、序列、题目、轮次、量表、seeded probes。
- `server/agent-personalities.json`：四角色的 role instruction、per-role neutral / specific 人格表达，以及两套 mock response。**改人格表达优先改这里。**
- `server/agents.ts`：三层 prompt 拼接、API 调用、arm-aware mock fallback、探针送达验证。
- `server/storage.ts`：participant（含 block）、event、rating 本地存储 + 序列分配。
- `server/analytics.ts`：配对对比、操控检查、parity 与覆盖聚合。
- `server/index.ts`：API、校验门、blind item 生成、导出。
- `src/App.tsx`：参与者两-block 流程 + 管理员/盲评页面。
- `scripts/study1_quality_audit.py`：离线质量与配对审计脚本。
- `docs/pre-registration.md`：预注册草案。
- `docs/behavioral-codebook.md`：行为编码手册。

## 13. 防审稿风险

- 不是 prompt engineering：prompt 分离 task / role / personality 三层（Layer 1、2 在两 arm 间完全一致，仅 Layer 3 变化）。
- 不是 persona identity：无人口身份、头像、姓名、传记。
- 不是只看 trust self-report：有 seeded valid/flawed 建议的行为校准。
- 小样本可分析：被试内配对设计 + 效应量 + CI，每人自己做对照。
- 操控有效性可验证：人格感知操控检查 + 响应长度 parity + fallback 审计。

## 14. 部署

```bash
npm install && npm run build && npm run start
```

正式部署建议：HTTPS；`.env` 仅部署用户可读；定期备份 `data/`；正式招募前清空或迁移 pilot 数据；IRB 材料中明确日志字段、用途与保存期限。
