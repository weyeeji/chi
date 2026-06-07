# 面向人类-智能体团队协作的 Agent 团队人格研究

## When a team of AI agents works with a person, does giving each agent a role-specific personality help the person produce better work — and at what cost to the experience?

---

## 一句话定位

> 本研究在一个四角色（Coordinator / Ideator / Critic / Verifier）的 human-agent team 中，用**被试内对照实验**比较「中性人格团队」与「角色特定人格团队」，检验为每个 agent 赋予与其协作角色相匹配的人格表达，是否能提升人类协作者的任务产出与对建议的校准依赖，以及它给协作体验带来了哪些收益与代价。

核心主张：

> In a human-agent team, an agent's personality is not decoration. It is a role-specific collaboration signal: it tells the human what each agent is for, when to lean on it, and when to push back.

---

# 1. 研究动机与缺口

LLM 系统正从「单个助手」走向「多个分工协作的 agent 团队」。当用户面对的不再是一个 AI 怎么说话，而是多个 AI 如何以不同风格分工、冲突、互补时，一个新的设计问题出现了：

> 团队里每个 agent 应不应该有人格？如果有，它应该是和角色匹配的，还是统一中性的？

近三年 CHI 已经接受「LLM 的 persona / personality 会影响用户体验、批判性思考与创作」，但现有工作几乎都停留在**单 agent**层面：

| 工作 | 会议 | 人格/persona 如何设计 | 对本研究的启示 |
| --- | --- | --- | --- |
| Vibe Check | CHI 2026 | 用 Big Five 与 Trait Modulation Keys 控制**单个**对话 agent 的人格表达强度，研究 user-agent 人格匹配 | Big Five 可作为人格表达的心理学锚点，但单 agent 已被做过 |
| CloChat | CHI 2024 | 让用户自定义 agent persona（包含人口身份、语言风格、知识、外观等） | persona 比 personality 宽得多，容易混入身份与外观 |
| Debate Chatbots | CHI 2024 Best Paper | 操控 chatbot 的 social identity 与 rhetorical style，检验 critical thinking | CHI 接受「风格影响批判性思考」，但仍是单 chatbot |

**缺口**：没有工作系统地检验，在一个**人也参与的 agent 团队**中，把人格表达**和角色绑定**会如何影响协作产出和体验。这正是本研究的位置。

---

# 2. 核心定义：什么是 Agent 团队中的人格

为了不被审稿人质疑「你研究的是 persona / prompt engineering / 能力差异」，本研究采用一个**狭义、可操作、可防守**的人格定义，并主动与四个相邻概念切割。

## 2.1 Agent personality（本研究定义）

> **Agent personality** 是 agent 在语言互动中**稳定呈现、用户可感知的行为表达模式**——它影响 agent 如何沟通、发散、处理不确定性、挑战假设和支持用户决策；但它**不包括** agent 的功能角色、领域专长、人口身份、传记背景或模型能力。

英文：

> Agent personality is a stable, perceivable pattern of behavioral expression in language that shapes how an agent communicates, explores, handles uncertainty, challenges assumptions, and supports decisions — while its role, expertise, and task competence are held constant.

## 2.2 Role-specific agent personality（本研究的设计构念）

> **角色特定人格**指 agent 的功能角色与其行为表达风格之间的**匹配关系**：让组织者更结构化、发想者更开放、批评者更会建设性地挑战、验证者更会校准不确定性，从而让用户更容易理解每个 agent 负责什么、何时该听它、何时该质疑它。

## 2.3 必须与之切割的五个概念

| 概念 | 含义 | 本研究是否操控 |
| --- | --- | --- |
| Role 角色 | agent 在团队中负责什么 | ❌ 两个条件都保持四角色不变 |
| Expertise 专长 | agent 掌握什么领域知识 | ❌ 保持一致 |
| **Personality 人格** | agent 以什么稳定行为风格执行任务 | ✅ **唯一操控变量** |
| Persona identity 身份 | agent 被设定成谁（年龄、性别、传记、头像） | ❌ 完全不使用 |
| Capability 能力 | agent 做得多好（准确性、推理质量） | ❌ 通过 prompt 分层 + 长度监控保持一致 |

## 2.4 用 Big Five-informed，而不是 Big Five-only

本研究不声称 LLM「拥有」人格，而是用四条**与角色匹配的可观察行为轴**来设计人格表达：

| 角色 | 行为表达轴 | Big Five / 理论锚点 |
| --- | --- | --- |
| Coordinator | 结构化：分步骤、追踪目标、收敛分支 | Conscientiousness |
| Ideator | 探索性：发散、类比、提出替代方案 | Openness |
| Critic | 建设性怀疑：直接挑战假设、指出权衡与失败案例 | low-Agreeableness facet + 批判推理 |
| Verifier | 不确定性校准：要求证据、标注不确定、检查隐私与评估严谨性 | emotional stability + epistemic caution |

关键防守句：

> We do not claim LLM agents have human personality. We study the **perception and behavioral consequences** of designed personality **expressions** attached to collaborative roles.

---

# 3. 两个研究问题

本研究只聚焦两个问题，讲一个完整的故事：**给 agent 团队角色特定人格，对任务有没有用，代价是什么。**

### RQ1（产出与依赖）

> 相比中性人格团队，角色特定人格团队是否能提升人类协作者的**任务产出质量**与**对建议的校准依赖**（采纳有效建议、拒绝/质疑有缺陷建议）？

### RQ2（体验与代价）

> 角色特定人格如何影响协作**体验**——角色可辨识度、认知负荷、建设性冲突、感知压力与用户自主感——又带来哪些**权衡与代价**？

> 两个 RQ 合起来回答 CHI 审稿人最关心的问题：**Does role-specific personality help, and what does it cost?**

## 3.1 假设

| 假设 | 预测 | 主要证据 |
| --- | --- | --- |
| H1 产出 | 角色特定团队的盲评「初稿→终稿」提升量高于中性团队 | 盲评质量提升（配对差） |
| H2 校准依赖 | 角色特定团队中，用户更多拒绝/质疑有缺陷建议、采纳有效建议 | seeded probe 决策（配对差） |
| H3 可辨识度 | 角色特定团队的角色可辨识度更高 | 角色可辨识量表（配对差） |
| H4 代价 | 角色特定团队（尤其 Critic）带来更高感知压力，认知负荷不一定更低 | 压力量表、NASA-TLX（配对差） |

> 故事不是「人格让一切变好」，而是 **role-specific trade-off**：产出与校准依赖上升，但可能以更高压力为代价。这种「有得有失」的结果比「全面更好」更可信、更难被质疑。

---

# 4. 实验设计：被试内 A/B 对照

## 4.1 为什么用被试内设计

样本规模约束：本研究预计招募 **N ≤ 20**。在这一规模下，组间设计（如把人不同地分到中性/角色特定两组）几乎没有统计功效。**被试内设计**让每位参与者**既体验中性团队、又体验角色特定团队**，每个人成为自己的对照，配对比较能在 16–20 人时就得到可分析、可发表的效应估计——这是 CHI 小样本受控实验的标准做法。

## 4.2 设计结构

- **操控变量（被试内）**：团队人格 = {中性, 角色特定}，两个 arm。
- 每位参与者完成**两个协作 block**，一个 block 用中性团队、另一个用角色特定团队。
- 两个 block 使用**两个不同但难度匹配的设计题目**（topic A / topic B），避免重复同一题目导致的练习/厌倦效应。
- **唯一变化**：每个 agent 是否启用角色特定人格表达。两个 arm 中，agent 角色、数量、专长、orchestration、模型、发言顺序、轮数、token 上限、UI 全部相同。

## 4.3 平衡（counterbalancing）

用 **2 (arm 顺序) × 2 (arm-题目映射) = 4 种序列**，按入组顺序轮转分配，在小样本下也能均衡：

| 序列 | Block 1 | Block 2 |
| --- | --- | --- |
| S1 | 中性 + 题目A | 角色特定 + 题目B |
| S2 | 角色特定 + 题目A | 中性 + 题目B |
| S3 | 中性 + 题目B | 角色特定 + 题目A |
| S4 | 角色特定 + 题目B | 中性 + 题目A |

这样 arm 顺序、题目、arm-题目搭配都被平衡，arm 的效应不会被「先后顺序」或「哪个题目更难」混淆。

## 4.4 任务

两个题目都是需要**发散 + 批判 + 验证**的开放设计任务，保证四个角色在两个 block 都有发挥空间：

- 题目 A：设计一个帮助大学生批判性使用生成式 AI、避免过度依赖的工具。
- 题目 B：设计一个帮助职场新人在重要决策前评估 AI 生成建议的工具。

最终方案统一为 7 个结构化字段：问题陈述、目标用户、核心设计概念、交互流程、风险与失败案例、评估计划、如何保留用户自主性。

## 4.5 参与者流程（单 session，约 50–60 分钟）

```text
1. 知情同意 + 实验前问卷（AI 熟悉度、信任、怀疑倾向、领域熟悉度、创意自我效能、注意力检查）

2. Block 1（约 20 分钟）
   a. 独立写题目1初稿（>= 280 字符质量门槛）
   b. 角色说明（只讲四个角色职责，不提人格操控）
   c. 团队协作工作区：3 轮固定 orchestration（问题界定 / 方案发散 / 风险与评估）+ 自由定向提问
      - 第 2-3 轮嵌入 4 条 seeded suggestions（2 有效 + 2 有缺陷）
   d. 提交题目1终稿（>= 480 字符门槛），处理完决策板所有建议
   e. 本轮协作问卷（负荷、可辨识、建设性冲突、压力、自主、信任、人格感知操控检查）

3. 过渡说明：进入第二轮，同一团队、不同题目

4. Block 2（约 20 分钟，结构同 Block 1，但不重复角色说明）

5. 对比问卷：两轮团队风格的整体偏好、有用性、压力（头对头比较）

6. 完成 + 强制 debrief（揭示哪些建议是故意设计的缺陷、为何如此设计、勿在真实系统中实施）
```

---

# 5. 测量

## 5.1 主结果（RQ1）

| 主结果 | 定义 | 采集方式 |
| --- | --- | --- |
| **方案质量提升** | 盲评终稿质量 − 盲评初稿质量（每个 block 各一对） | 3 名盲评者对匿名单项打分 |
| **校准依赖** | 对 seeded 建议的处理是否与其真实有效性匹配 | 决策板行为日志 |

**盲评协议（防需求特征）**：初稿、终稿被拆成独立匿名 item；评分者看不到 arm、题目-arm 映射、参与者 id，也不知道某 item 是初稿还是终稿；每个 item 至少 3 名评分者；分析阶段才用隐藏 stage 计算每个 (参与者, block) 的 `终稿 − 初稿`。盲评维度：问题界定、创新性、可行性、风险意识、用户自主性、评估严谨性、整体 CHI 潜力。报告 Krippendorff's α。

**校准依赖评分**：
- 有效建议：采纳或改写 = 校准；
- 有缺陷建议：拒绝、质疑或改写 = 校准。
- 同时预注册 **strict 变体**（改写只对有缺陷建议计分，有效建议须采纳），防止「全部改写」拿满分；strict 为 confirmatory，lenient 为 sensitivity。

## 5.2 体验结果（RQ2）

每个 block 结束后用 1–7 量表测量（用于配对比较）：

| 构念 | 条目示例 |
| --- | --- |
| 认知负荷 | NASA-TLX 简版（心理负荷、时间压力、努力、挫败） |
| 角色可辨识度 | 能分辨各 agent 职责 / 知道该问谁 / 能理解分歧 / 风格符合角色 |
| 建设性冲突 | 分歧帮助我改进 / 批评有用而非阻碍 |
| 感知压力 | 被推向某方向 / 某些 agent 过于强势 / 可无负担地拒绝 |
| 用户自主感 | 终稿仍是我的决定 / 可拒绝建议 |
| 人格感知（操控检查） | 组织者结构化 / 发想者开放 / 批评者直接 / 验证者谨慎 |

对比问卷（两 block 头对头）：整体更喜欢哪一轮、哪一轮更有帮助、哪一轮压力更大；开放题问两轮团队差异、最想调哪个角色。

## 5.3 seeded suggestions（行为层信任探针）

每个题目嵌入**结构匹配**的 4 条建议（2 有效 + 2 有缺陷），两个题目一一对应，使两个 block 的校准分数可比：

| 类型 | 题目A 示例 | 题目B 对应 | source 角色 |
| --- | --- | --- | --- |
| 有效 | AI 反馈 vs 同伴反馈对照 | AI 建议 vs 第二来源对照 | Ideator |
| 有缺陷（隐私） | 默认收集学生 prompt、作业、成绩 | 默认抓取员工邮件、文档、决策 | Ideator |
| 有效 | 用行为指标评估而非只看满意度 | 用决策质量指标评估而非只看信心 | Verifier |
| 有缺陷（评估弱） | 只用满意度问卷判断有效性 | 只用自评信心判断有效性 | Coordinator |

**关键设计原则（防混淆）**：有缺陷建议绝不由「本应抓住该缺陷的角色」提出——隐私缺陷不由 Verifier 提出、评估缺陷不由 Critic 提出。否则探针的「可见性」会随人格操控变化，校准差异不可解释。系统同时对每条探针做**送达验证**（verbatim / 词重叠 ≥ 0.7），未faithful 送达者从该探针分析中剔除并报告送达率。

---

# 6. 分析计划

## 6.1 主分析：配对比较

对每个结果，按参与者构造 (角色特定 arm, 中性 arm) 配对值，报告：

- 配对均值差 `mean(specific − neutral)`；
- 配对 Cohen's dz（差值均值 / 差值标准差）与 95% bootstrap CI；
- confirmatory 检验：Wilcoxon signed-rank（小样本、不假设正态）或配对 t。

主检验（预注册）：
1. 方案质量提升（specific vs neutral）；
2. 校准依赖（strict，specific vs neutral）；
3. 角色可辨识度；
4. 感知压力。

> 主结果用配对差 + 效应量 + CI 呈现，不依赖单纯的 p 值阈值，符合 CHI 对小样本研究透明报告的要求。

## 6.2 稳健性与混淆检查

- **混合模型（探索性）**：`Rating ~ Stage * Arm + Topic + (1|Participant) + (1|Rater)`，把题目与评分者作为随机/固定项，验证配对结论稳健。
- **顺序效应**：把 block 顺序作为协变量，检查是否存在练习/厌倦。
- **响应长度均等**：按 arm × 角色比较 agent 发言词数，预注册 ±15% parity band；若违反则把长度作为协变量。
- **人格感知操控检查**：角色特定 arm 在对应人格条目上应显著高于中性 arm（配对差 > 0），否则操控无效。
- **fallback 审计**：任何在中性 block 注入了 specific 语气文本的 API fallback 使该 session 失效（系统按 arm 记录 fallback）。

## 6.3 定性

对开放题与决策板备注做主题分析（最想调哪个角色、压力时刻、决策时刻），支撑 RQ2 的代价叙事，并产出可控制性设计启示。

---

# 7. 系统实现（作为方法的一部分）

系统是一个 web-based human-agent team workspace，已可直接 pilot / recruit，应在论文 Methods 中作为**受控实验平台**报告。

## 7.1 三层 prompt 架构（防 confound 关键）

每个 agent 的 prompt 分三层，干净分离 task / role / personality：

```text
Layer 1 共享任务指令：任务目标、输出模板、协作规范、安全与自主规则、长度上限
Layer 2 角色指令：Coordinator / Ideator / Critic / Verifier 各自的功能职责
Layer 3 人格指令：中性表达 或 角色特定表达（行为 stance + 语言风格）
```

仅 Layer 3 在两个 arm 间变化；Layer 1、2 完全一致。人格配置外置在 `server/agent-personalities.json`，便于 pilot 后快速修订并在 supplement 公开。

## 7.2 界面（不暴露操控）

- 左栏：任务、初稿、计时；中栏：团队对话时间线 + 定向提问；右栏：建议决策板。
- agent 名称直接用角色（Coordinator/Ideator/Critic/Verifier），**不用**头像、性别化名字或人口线索。
- 两种交互：系统编排轮次（保证每个 agent 等量发言）+ 用户定向提问（观察用户更信谁、问谁、反驳谁）。

## 7.3 参与者端 / 管理员端分离

- 参与者端：按招募链接进入，**永不返回 arm**（人格条件只存在后端记录）；
- 管理员端 `/admin`：需 `ADMIN_TOKEN`，含分析仪表盘、数据导出、盲评入口；未配置 token 默认 fail-closed。

## 7.4 日志（支持图表与审计）

记录：序列分配、各 block 的 arm/题目、所有 prompt 与消息、@ 定向、建议决策、初稿/终稿、时间戳、延迟、token、fallback、探针送达验证、盲评记录。支持的图表：完成漏斗、序列均衡、配对均值与效应量、人格感知操控检查、探针决策分布、响应长度 parity、盲评覆盖与一致性。

---

# 8. 伦理

本研究刻意让 agent 倡导有缺陷做法（默认收集隐私数据、只用满意度评估），且不事先告知。必须：

1. 论证 deception 必要性（若提前告知，校准依赖无法测量）；
2. 结束时**强制 debrief**，揭示哪些建议是 seeded flawed 及原因；
3. do-not-implement 提示；
4. 不收集真实姓名、成绩等敏感信息；明确数据保存与处理。

---

# 9. 已知局限（主动声明，作为 scope condition）

| 局限 | 处理 |
| --- | --- |
| 操控的是「角色契合表达的强度」，而非「有无角色」 | 把因果主张重述为「放大角色契合人格表达」的边际效应；中性 arm 仍保留可区分的弱角色 voice，使可辨识度增益归因于表达强度 |
| 固定发言顺序（C→I→Cr→V）混淆 serial position | 显式声明所有效应在该生态化顺序下估计，作为 scope condition；顺序 counterbalance 列为 future work |
| 任务偏 ideation/critique，Coordinator/Verifier 发挥空间可能受限 | 把贡献 scope 到 design-ideation 协作；在讨论中说明 |
| 单一 model | 把因果主张 scope 到所测 model 与版本；跨 model 复制列为 future work |
| 小样本（N≤20） | 被试内配对 + 效应量 + CI；定性证据补强；不对总体做过度推广 |

---

# 10. 预期贡献

- **C1 概念贡献**：提出 *role-specific agent personality* 作为 human-agent team 的设计构念，把 agent 人格从单 agent 的对话风格，推进为团队中可分配、可对照、可控制的协作机制。
- **C2 实证贡献**：用被试内 A/B 实验，给出角色特定人格对任务产出、校准依赖与协作体验的配对效应估计，并诚实呈现其代价（压力/负荷）。
- **C3 方法贡献**：一套适合小样本 human-agent team 人格研究的协议——三层 prompt 分离、被试内配对、初稿→终稿盲评提升、结构匹配的 seeded probes、探针送达验证、人格感知操控检查。
- **C4 设计贡献**：基于结果与定性的可控制性启示——哪些角色人格值得作为用户可调控制暴露、哪些需要 bounded defaults。

---

# 11. 时间表（以 CHI full paper deadline 倒推）

| 时间 | 工作 |
| --- | --- |
| 第 1 周 | 定稿理论、人格 profile、两题目与 seeded probes、IRB 草稿 |
| 第 2 周 | 完成原型与日志（已基本就绪），pilot 2–3 人调 prompt |
| 第 3 周 | 预注册，正式招募 16–20 人收集数据 |
| 第 4 周 | 盲评 + 行为编码 |
| 第 5 周 | 配对分析、稳健性检查、定性主题分析 |
| 第 6 周 | 写作、图表、supplement |
| 第 7 周 | 内审、终检、提交 |

---

# 12. 参考的 CHI 相关工作

- **Vibe Check (CHI 2026)** — Big Five-informed 人格表达强度操控；本研究借其心理学锚点，但推进到团队层面。
- **CloChat (CHI 2024)** — persona 自定义；本研究刻意**不**操控 persona 身份，只操控行为人格表达。
- **Debate Chatbots (CHI 2024 Best Paper)** — 风格影响 critical thinking；启发本研究的建设性冲突与校准依赖测量。
- **NASA-TLX** — 认知负荷测量基础。
- **Human-AI Interaction Guidelines** — 让用户理解 AI 能做什么、支持拒绝/忽略、保留控制权；启发角色说明、决策板与自主性条目。
