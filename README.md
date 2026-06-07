# Role-Specific Agent Personality Lab

本项目根据 `Proposal.md` 实现了一个面向 CHI 2027 实验的 web-based human-agent team workspace。系统支持 Study 0、Study 1、Study 2，支持中英文切换，后端通过 `.env` 配置 agent API，前端不暴露 API key。

## 1. 系统目标

研究问题来自 proposal 的核心主张：

> In human-agent teams, agent personality is not a decorative style layer. It is a role-specific collaboration mechanism.

系统围绕四个固定 agent role 实现：

- `Coordinator`: 组织讨论、总结分支、推进下一步。
- `Ideator`: 发散方案、提出替代方向和类比。
- `Critic`: 挑战假设、暴露权衡和失败案例。
- `Verifier`: 检查证据、不确定性、隐私、伦理和评估严谨性。

Study 1 使用 L8 正交角色人格消融矩阵。每个参与者被均衡随机分配到 `C1-C8` 条件，agent 的 role、顺序、UI、模型、任务模板保持一致，只改变对应 role 是否启用 role-specific personality expression。

## 2. 技术栈

- Frontend: React 19 + TypeScript + Vite
- Backend: Express 5 + TypeScript
- Visualization: Recharts
- Icons: lucide-react
- Storage: local JSON / JSONL files under `data/`
- Agent API: OpenAI-compatible `/chat/completions`

选择这个栈的原因：

- 本地启动快，便于 pilot study 快速迭代。
- 前后端分离，部署到服务器时可由 Express 同时托管 API 和静态前端。
- JSONL 事件日志便于审计、导出、行为编码和统计分析。
- Agent key 只在后端读取，避免浏览器泄露。

## 3. 本地运行

```bash
npm install
npm run dev
```

默认服务：

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

生产构建：

```bash
npm run build
npm run start
```

类型检查：

```bash
npm run typecheck
```

## 4. 环境变量

真实配置放在 `.env`，示例配置在 `.env.example`。不要提交 `.env`。

```bash
PORT=8787
CLIENT_ORIGIN=http://localhost:5173
ADMIN_TOKEN=replace-with-admin-token
BLIND_ITEM_SALT=replace-with-stable-secret
AGENT_API_BASE_URL=https://aiping.cn/api/v1
AGENT_API_KEY=replace-with-your-key
AGENT_MODEL=DeepSeek-V4-Flash
AGENT_MODE=live
AGENT_TEMPERATURE=0.7
AGENT_MAX_TOKENS=360
VITE_API_BASE_URL=http://localhost:8787
```

`ADMIN_TOKEN` 默认 fail-closed：如果没有配置，`/api/analytics`、`/api/export/*` 和 `/api/rater/*` 会拒绝访问。只有本地演示时才可以显式设置 `ALLOW_UNPROTECTED_ADMIN=true`。`BLIND_ITEM_SALT` 用于生成盲评 opaque item id，正式实验中应保持稳定，不要在评分中途更换。

如果做 UI pilot 或离线演示，可以设置：

```bash
AGENT_MODE=mock
```

这样系统会使用内置 mock agent 回复，不调用真实 API。

## 5. 页面入口

- `/`: Study 1 主实验
- `/study0`: Study 0 personality manipulation validation
- `/study2`: Study 2 role-level personality control probe
- `/admin`: 管理员端，包含分析仪表盘、数据导出和盲评入口，需要 `ADMIN_TOKEN`

正式招募时应给参与者分发 study-specific 链接。参与者端不会展示其他 Study 入口、管理员数据、分析图表、condition id 或盲评入口。管理员需要直接访问 `/admin`，输入 `.env` 中的 `ADMIN_TOKEN` 后才能访问研究数据 API。

每个参与者入口都支持右上角中英文切换。

## 6. Study 0 设计

目的：

- 验证四种 role-specific personality expressions 是否可感知。
- 检查 personality 是否与 competence、helpfulness、verbosity、discomfort 混淆。
- 检查 Critic 是否被感知为 hostile，Verifier 是否被感知为 incompetent。

系统实现：

- 后台材料池为 `6 scenarios x 4 roles x 2 levels = 48` 个短片段。
- 每位参与者只评价 counterbalanced 8-item subset，覆盖 `4 roles x 2 levels`。
- neutral / role-specific 片段共享同一语义材料，只改变行为表达方式，避免混入 advice quality。
- 每个片段评分：structure、openness、skepticism、evidence seeking、warmth、calibration、competence、helpfulness、verbosity、discomfort。
- 额外评分片段适合哪个 role。
- 结果写入 participant JSON，并在 `/analytics` 中作为 manipulation check 数据导出。

## 7. Study 1 主实验流程

Study 1 是主要实验，流程为：

1. Pre-survey
   - AI familiarity
   - baseline trust
   - domain familiarity
   - creative self-efficacy
   - need for cognition
   - attention check
   - 服务端要求 attention check 等于 5，否则不能进入有效样本流程。

2. Initial individual proposal
   - 参与者先独立完成结构化初稿。
   - 前端和后端都要求所有字段有完整内容，并达到最低长度，减少低努力样本。
   - 后续 primary outcome 可计算 `Final quality - Initial quality`。

3. Role tutorial
   - 只解释四个 agent role。
   - 不解释 personality manipulation。

4. Human-agent team collaboration
   - 左侧：任务、初稿、最终模板。
   - 中间：四轮团队时间线。
   - 右侧：记录 agent 已提出 seeded suggestions 的 decision board、采纳/拒绝/质疑/改写记录、研究备注。
   - 第 2-4 轮 seeded suggestions 会嵌入 source role agent 的自然发言；右侧 board 只用于记录用户如何处理这些 agent 建议。

5. Final proposal
   - 参与者独立提交最终方案。
   - 终稿有更高最低长度要求，保证盲评可比性。

6. Post-survey
   - NASA-TLX short items
   - role legibility
   - social pressure
   - autonomy / ownership
   - satisfaction

四轮系统编排：

```text
Round 1: Problem framing
Coordinator -> Ideator -> Critic -> Verifier

Round 2: Solution alternatives
Coordinator -> Ideator -> Critic -> Verifier

Round 3: Risks and evaluation
Coordinator -> Ideator -> Critic -> Verifier

Round 4: Final synthesis
Coordinator -> Ideator -> Critic -> Verifier -> Coordinator
```

参与者也可以向单个 agent 或全部 agent 发起 user-directed turn。

## 8. L8 条件矩阵

| Condition | Coordinator | Ideator | Critic | Verifier |
| --- | --- | --- | --- | --- |
| C1 | Neutral | Neutral | Neutral | Neutral |
| C2 | Structured | Neutral | Neutral | Calibrated |
| C3 | Neutral | Exploratory | Neutral | Calibrated |
| C4 | Structured | Exploratory | Neutral | Neutral |
| C5 | Neutral | Neutral | Skeptical | Calibrated |
| C6 | Structured | Neutral | Skeptical | Neutral |
| C7 | Neutral | Exploratory | Skeptical | Neutral |
| C8 | Structured | Exploratory | Skeptical | Calibrated |

系统会根据已有 Study 1 participant 数量自动选择样本量最少的 condition，帮助保持均衡。

## 9. Trust Calibration Probes

系统在第 2-4 轮插入固定语义骨架的 suggestion cards。参与者可以选择：

- Accept
- Reject
- Question
- Reframe

后台知道每张 probe 是 `valid` 还是 `flawed`，前端不会向参与者显示 validity。

当前 probes：

- Valid: hybrid AI + peer feedback comparison (Ideator, R2)
- Valid: deadline over-reliance risk (Critic, R3)
- Valid: behavioral evaluation measures (Verifier, R3)
- Flawed: collect prompts, assignments, and grades by default (Ideator, R3)
- Flawed: satisfaction-only evaluation (Coordinator, R4)
- Flawed: automatic submission blocking (Ideator, R4)

Flawed probe 的 source role 故意避开“本该抓住该缺陷”的角色（隐私缺陷不由 Verifier 提出、自治缺陷不由 Critic 提出），使 probe 可见性不随被估计的人格因素变化。

系统在每次 agent 生成后校验该 probe 文本是否被原样送达（verbatim 或高词重叠），记录 `probeDelivery`，并在 analytics 的 `probeDeliverySummary` 中按 probe 报告送达率。未faithful 送达者从该 probe 的 calibrated reliance 分析中剔除。

Calibration score 的基本逻辑：

- lenient: valid suggestion 被 `accepted` 或 `reframed` 算校准；flawed suggestion 被 `rejected`、`questioned` 或 `reframed` 算校准。
- strict (confirmatory): reframe 仅对 flawed 计分，valid 要求 `accepted` 才算校准，避免“全部 reframe”拿满分。两者都在 analytics 中报告。

## 10. Study 2 控制探针

Study 2 不让用户调 Big Five sliders，而是暴露 role-level controls：

- Coordinator: structure level, summary frequency, authority level
- Ideator: idea breadth, concreteness, risk tolerance
- Critic: directness, challenge frequency, warmth
- Verifier: evidence strictness, uncertainty display, privacy sensitivity

用户调节控制项后进入同样的 human-agent workspace。后端会把控制值转换成 agent prompt 约束，用于研究：

- 用户最想调哪个 agent？
- Critic 多直接才有帮助？
- Verifier 多谨慎才不会拖慢？
- Coordinator 多强才不会降低自主性？
- Ideator 多发散才不会变成噪音？

## 11. 数据记录

数据默认写入 `data/`：

```text
data/
  participants/
    study1_*.json
    study0_*.json
    study2_*.json
  ratings/
    rating_*.json
  events.jsonl
```

Participant JSON 包含：

- participant id
- study
- language
- condition id
- topic id
- consent metadata
- anonymous recruitment code
- browser language, timezone, screen, viewport, device pixel ratio, referrer
- pre-survey
- initial proposal
- final proposal
- post-survey
- Study 0 ratings
- Study 2 controls and notes
- timestamps

Event JSONL 包含：

- participant created / updated
- stage entered / submitted
- proposal submitted with per-field char/word counts
- round started / completed
- all user messages
- all agent messages
- prompts sent to agents
- latency
- token estimate
- API errors
- seeded probes revealed
- probe decisions
- optional probe decision reasons
- direct turn target and completion
- workspace completion summary
- workspace notes
- blind rating saved

导出入口：

- `/api/export/participants`
- `/api/export/events`
- `/api/export/analytics`
- `/api/export/participants.csv`
- `/api/export/events.csv`
- `/api/export/ratings.csv`

这些导出接口都需要管理员 token。

## 12. 盲评

进入 `/admin` 后切换到 Blind Rating，研究者对匿名单项 proposal item 评分。系统把 initial proposal 和 final proposal 拆成独立 item，评分者不看到 condition id、participant id，也不知道该 item 是 initial 还是 final。

盲评 API 返回 opaque item id；rater 客户端不会收到 participant id 或 initial/final stage。提交评分时，后端根据 opaque id 反查真实 participant/stage，并阻止同一 rater 重复评分同一个 item。

评分维度：

- problem framing
- novelty
- feasibility
- risk awareness
- user agency
- evaluation rigor
- overall CHI potential

建议实验正式运行时：

- 至少 3 名 blind raters。
- 每个 rater 不看 condition id。
- 每个 rater 不并排比较 initial/final。
- 报告 ICC 或 Krippendorff's alpha。
- Primary outcome 使用 `final quality - initial quality`。

## 13. 分析与可视化

`/admin` 的 Analytics tab 当前提供：

- Study 0/1/2 participant count
- Study 1 completion count
- blind rating count
- fully rated blind item count
- event count
- condition-level n
- condition-level calibration score
- condition-level blind-rated improvement
- role personality main-effect estimate
- seeded probe decision distribution
- Study 1 completion funnel
- survey construct means
- agent response latency and token estimate by role
- response length (words) by personality level for capability-parity check
- seeded probe delivery rate by probe and condition-aware fallback counts
- user-directed turn target distribution
- blind-rating coverage table
- dimension-level Krippendorff alpha monitor

离线审计：

```bash
npm run audit:study1
```

该脚本读取 `data/participants` 和 `data/ratings`，输出 valid-sample gates、condition balance、blind-rating coverage、重复评分和各评分维度的 Krippendorff alpha。

主分析模型可按 proposal 这样写：

```text
Improvement ~ CoordinatorPersonality
            + IdeatorPersonality
            + CriticPersonality
            + VerifierPersonality
            + InitialQuality
            + Topic
            + AI_Familiarity
            + Domain_Familiarity
            + CreativeSelfEfficacy
            + (1 | Rater)
```

Role-matched secondary outcomes：

```text
CoordinationEfficiency ~ CoordinatorPersonality + covariates
IdeaBreadth ~ IdeatorPersonality + covariates
CriticalDepth ~ CriticPersonality + covariates
CalibrationScore ~ VerifierPersonality + covariates
```

当前系统已直接记录 matched outcomes 所需的关键原始数据：

- coordination: timestamps, round completion, role-targeted turns
- ideation: conversation logs and final proposal text
- critique: critic messages, user pushback, revision difference
- verification: probe decisions and evaluation plan text
- load / pressure / autonomy: post-survey

## 14. 建议的统计工作流

1. Pilot
   - 设置 `AGENT_MODE=mock` 或 live API。
   - 运行 5-8 个内部样本。
   - 检查时长、日志完整性、probe 是否被看见。

2. Study 0
   - N=120-150。
   - 检查目标 trait 是否显著高于 neutral。
   - 检查 competence/helpfulness/verbosity/discomfort 是否失衡。
   - 如失衡，回到 `server/agents.ts` 调整 personality prompt。

3. Study 1
   - Recruit N=480，target valid N=400。
   - 8 conditions x 50 valid participants。
   - 使用 `/rater` 完成 blind rating。
   - 导出 JSON 后用 R / Python 建 mixed-effects models。

4. Study 2
   - N=24-30 remote think-aloud。
   - 导出 controls + notes。
   - 主题分析用户如何理解 role-level controls。

## 15. 面向 CHI 论文写作的证据链

系统设计对应论文贡献：

- Conceptual contribution:
  - role-specific agent personality 被操作化为 role + personality layer，而不是 biography/persona identity。

- Empirical contribution:
  - Study 1 的 L8 正交矩阵可以估计四个 agent personality 的 main effects。

- Methodological contribution:
  - initial-to-final proposal improvement、seeded flawed suggestions、role-matched outcomes、行为日志和盲评入口都在系统中实现。

- Design contribution:
  - Study 2 的 role-level controls 可直接支持 design guidelines。

审稿风险防守：

- 不是简单 prompt engineering：系统分离 task instruction、role instruction、personality instruction。
- 不是 persona identity：没有 demographic identity、avatar、age、gender、biography。
- 不是只看 trust self-report：有 seeded valid/flawed suggestion 的 behavioral calibration。
- 不是只比较 aligned vs neutral：L8 ablation 可估计 role-level main effects。
- 不是只看主观体验：有初稿/终稿盲评、行为日志和问卷。

## 16. 部署建议

服务器部署可以沿用：

```bash
npm install
npm run build
npm run start
```

Nginx 反向代理示例：

```nginx
server {
  server_name your-domain.example;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

正式实验部署前建议：

- 使用 HTTPS。
- 把 `.env` 权限设为仅部署用户可读。
- 定期备份 `data/`。
- 若数据量大或多人并发，替换为 PostgreSQL。
- IRB/伦理材料中明确日志字段、数据用途和保存期限。
- 正式招募前清空 `data/` 或迁移 pilot 数据到单独目录。

## 17. 重要文件

- `src/shared/experiment.ts`: 条件矩阵、角色、轮次、量表、Study 0/2 材料。
- `server/agent-personalities.json`: 四个 agent 的 role instruction、per-role neutral personality、role-specific personality 和 neutral/specific 两套 mock response。修改人格表达优先改这个文件。
- `server/agents.ts`: agent prompt 分层、API 调用、系统编排、mock fallback。
- `server/storage.ts`: participant、event、rating 本地存储。
- `server/analytics.ts`: 聚合指标和可视化数据。
- `scripts/study1_quality_audit.py`: Study 1 有效样本、盲评覆盖和一致性离线审计脚本。
- `src/App.tsx`: 全部实验页面与研究者页面。
- `src/styles.css`: UI 与响应式布局。
- `docs/pre-registration-study1.md`: Study 1 预注册草案。
- `docs/behavioral-codebook.md`: 行为编码手册。

## 18. 下一步研究优化

正式实验前建议继续增加：

- 更细的 behavior coding console。
- Agent response length 自动监控，避免 Ideator verbosity confound。
- 每轮倒计时和强制流程锁。
- 正式 R / Python mixed-effects model 脚本。
- coder reconciliation console。

## 19. 招募就绪强化说明

本轮系统已经按“可以直接招募 pilot / main study”的标准强化：

- 用户端和管理员端分离：参与者只看到当前招募链接对应的 Study；管理员直接访问 `/admin`，并通过 `ADMIN_TOKEN` 访问 analytics、export、rater API。
- 管理员 API fail-closed：未配置 `ADMIN_TOKEN` 时不会开放数据接口，除非显式设置本地演示开关。
- 参与者知情同意：每个 Study 的开始页说明时长、记录数据、敏感信息边界、退出说明和用户自主权。
- 服务端协议门：attention check、proposal minimum content、Study 0 rating completeness、blind rating schema 都在 API 层验证。
- 日志更完整：系统记录阶段、轮次、消息、agent prompt、延迟、token 估计、proposal 字数、probe 决策、direct turn target、workspace 完成摘要、问卷和开放反馈。
- 问卷更贴近 CHI empirical study：post-survey 覆盖 cognitive load、role legibility、constructive conflict、trust/calibrated reliance、pressure、autonomy、satisfaction、reuse intent 和人格操控感知。
- 管理员可视化更论文导向：completion funnel、condition-level calibration、role main-effect estimate、blind-rated improvement、probe decision distribution、survey construct means、agent latency/token monitor、directed-turn target distribution。
- 盲评采集质量可审计：opaque item id、每 item 评分覆盖率、重复评分阻止、dimension-level reliability monitor、离线 audit 脚本。
- Agent personality 可配置：`server/agent-personalities.json` 独立保存人格表达，不需要改代码即可微调。

## 20. Proposal 到系统实现的对应关系

| Proposal 设计点 | 系统实现 | 论文中可用的数据 |
| --- | --- | --- |
| Study 0 manipulation validation | `/study0` 从 48-item pool 中展示 counterbalanced 8-item subset | target trait、role suitability、competence、helpfulness、verbosity、discomfort、scenario id |
| L8 role-personality ablation | `src/shared/experiment.ts` 的 `conditions`，后端均衡分配 C1-C8 | condition id、四个 binary role personality factors |
| 固定四轮 human-agent team collaboration | `Workspace` + `server/agents.ts` 固定 round order | all messages、round_started/completed、latency、token estimate |
| 区分 role / personality / capability | `server/agents.ts` 分层拼接 task、role、personality；配置在 `server/agent-personalities.json` | prompts logged to `events.jsonl`，可作为 supplement 审计材料 |
| Trust calibration probes | 第 2-4 轮 source role agent 自然发言中嵌入 seeded suggestion，decision board 记录处理方式 | accept/reject/question/reframe、optional reason、valid/flawed hidden label 后端分析 |
| Initial-to-final improvement | Study 1 初稿和终稿模板一致，盲评拆成匿名单项 item | blind ratings、proposal word/char stats、quality delta |
| Role-matched outcomes | 问卷与日志同时覆盖 coordination、ideation、critique、verification | role legibility、directed turns、critical feedback uptake、calibration score |
| Cognitive load / pressure / autonomy | Post-survey Likert items | NASA-TLX short style items、pressure items、ownership/autonomy items |
| Behavioral coding | JSONL 记录完整对话、用户响应、probe 处理理由 | suggestion uptake、evidence seeking、pushback、revision depth、role-targeted questions |
| Study 2 role-level controls | `/study2` sliders for each role | control choices、think-aloud notes、workspace logs |
| Admin analysis for paper figures | `/admin` Analytics tab | condition charts、funnel charts、construct means、agent monitor、exports |

## 21. Empirical Study 建议定稿

推荐最终论文采用三段式：

1. Study 0, manipulation validation
   - N=120-150。
   - 目标是证明 role-specific personality expression 可感知，并检查 competence/helpfulness/verbosity/discomfort confounds。

2. Study 1, main controlled experiment
   - Recruit N=480，target valid N=400。
   - L8 orthogonal array，8 conditions x 50 valid participants。
   - Primary outcome: blind-rated proposal quality improvement。
   - Secondary outcomes: role-matched process and survey outcomes。
   - Behavioral outcome: calibrated reliance from seeded valid/flawed probes。

3. Study 2, design probe
   - N=24-30。
   - 让参与者调 role-level controls，而不是 Big Five sliders。
   - 用 think-aloud 和访谈解释用户需要怎样的人格控制。

## 22. 参考设计依据

本系统的问卷与 HCI 设计取向参考了以下公开来源：

- NASA TLX 用于主观工作负荷测量，适合人机界面任务中的 cognitive load 评估：https://human-factors.arc.nasa.gov/groups/tlx/
- CHI 2024 Debate Chatbots 说明 chatbot persona / rhetorical style 可以影响 critical thinking，启发本研究测量批判性思考和构念冲突：https://dwyoon.com/files/papers/chi2024-debatechatbots.pdf
- Microsoft Human-AI Interaction Guidelines 强调能力边界、可拒绝性、错误处理和用户控制，支撑本系统的角色说明、probe 拒绝和 autonomy 设计：https://www.microsoft.com/en-us/research/?p=564561
