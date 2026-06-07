# CHI 2027 Proposal 升级版

## Role-Specific Agent Personalities in Human-Agent Team Collaboration

中文题目建议：

## 面向人类-智能体团队协作的角色特定人格设计：不同 Agent 的人格表达如何影响协作过程、任务产出与校准信任

一句话版本：

> 本研究关注 human-agent team 中每个 agent 的 personality 是否应该按照其协作角色进行设计，并通过正交消融实验检验 Coordinator、Ideator、Critic 和 Verifier 的角色特定人格表达分别如何影响人与 agent team 协作时的任务质量、创新性、批判性思考、认知负荷、信任校准和用户自主感。

核心主张：

> In human-agent teams, agent personality is not a decorative style layer. It is a role-specific collaboration mechanism.

中文核心洞见：

> 多智能体团队里，agent personality 的价值不在于让 AI 更像人，而在于让每个 agent 以更适合其角色的方式参与协作：组织者更结构化，发想者更开放，批评者更会挑战，验证者更会校准不确定性。

---

# 0. 从 CHI 2027 审稿人角度的结论

## 0.1 当前研究方向是否值得做？

**值得做，而且比泛泛研究 “AI personality” 更有 CHI 潜力。**

原因是：近三年 CHI 已经开始接受 LLM persona/personality 对用户体验、批判性思考和创作任务的影响，但目前多数工作仍然停留在 single-agent 或 broad persona customization 层面。你的机会在于把问题推进到 **human-agent team 中不同 agent 的 personality 分工**。

CHI 审稿人会认可这个 gap，因为当 LLM 系统从 single assistant 走向 multi-agent team，用户面对的不再是“一个 AI 怎么说话”，而是“多个 AI 如何以不同风格分工、冲突、互补，并影响人的判断”。

## 0.2 当前最容易被拒的写法

不要写成：

> We gave four agents different personalities and users liked the team more.

这会被审稿人质疑为：

1. 只是 prompt engineering；
2. personality 与 role、expertise、能力混在一起；
3. 只证明了主观喜好，没有证明任务价值；
4. 不知道到底哪个 agent 的 personality 起作用；
5. 不知道 personality 是改善协作，还是增加 social pressure。

## 0.3 升级后的投稿定位

本文应定位为：

> A controlled empirical study of role-specific personality expressions in human-agent teams.

贡献链：

```text
Design construct:
Role-Specific Agent Personality

Empirical question:
Which agent's personality matters for which part of collaboration?

Mechanisms:
Role legibility, constructive conflict, idea breadth, coordination efficiency, calibrated reliance

Evidence:
Manipulation validation + orthogonal role-personality ablation experiment + behavioral coding + design probe

Design output:
Guidelines for assigning and controlling personalities in human-agent team interfaces
```

目标 verdict：

**Accept / Strong Accept candidate**，前提是实验设计足够干净，并且行为指标不只靠问卷。

CHI 2027 Papers 官方页面要求论文 stand-alone、方法透明、可复现，鼓励 5,000-8,000 words 的清晰写作；官方 full paper deadline 是 **2026-09-10 AoE**。官方说明见 [CHI 2027 Papers](https://chi2027.acm.org/authors/papers/)。CHI 官方 guide 也强调研究应清楚报告系统、方法、数据和分析流程，便于理解、验证和复现：[Guide to a Successful Submission](https://chi2026.acm.org/guide-to-a-successful-submission/)。

---

# 1. 近三年 CHI 相关工作如何设计 personality/persona？

## 1.1 结论：Big Five 可用，但不能作为你的唯一框架

近三年 CHI 相关论文大致有几种做法。

| Work | Venue | How personality/persona is designed | Lesson for this proposal |
| --- | --- | --- | --- |
| [Vibe Check](https://arxiv.org/abs/2509.09870) | CHI 2026 | 用 Big Five 和 Trait Modulation Keys 控制单个 conversational agent 的 low / medium / high personality expression，并研究 user-agent personality alignment | Big Five 可以作为 psychometric grounding，但已有 single-agent 工作，不能重复做 |
| [CloChat](https://arxiv.org/abs/2402.15265) | CHI 2024 | 支持用户定制 agent personas，包含 demographic information、verbal style、nonverbal style、knowledge/interests、relational content、appearance 等 | Persona 比 personality 更宽，容易混入身份、背景和视觉外观 |
| [Debate Chatbots](https://dwyoon.com/files/papers/chi2024-debatechatbots.pdf) | CHI 2024 Best Paper | 操控 chatbot persona 的 social identity 和 rhetorical style，如 ingroup/outgroup、persuasive/eristic，检验 critical thinking | CHI 接受 persona attributes 影响批判性思考，但这是 single chatbot |
| [Proxona](https://arxiv.org/abs/2408.10937) | CHI 2025 | 从 audience comments 中提取 dimensions/values，聚类成 audience personas，用于创作者 sensemaking 和 ideation | Persona 可以是 data-grounded audience segment，不等于 agent personality |
| [Persona-L](https://arxiv.org/abs/2409.15604) | CHI 2025 | 用 ability-based framework 和 RAG 创建 complex-needs personas，强调避免刻板印象、透明数据来源、平衡 abilities/constraints | 使用 persona 时必须防止 stereotype 和 false understanding |
| [D-Twins](https://pgl.jp/papers/10.1145/3706598.3714163) | CHI 2025 | 用用户自然语言表达、情绪反应和 EEG 检测构建 digital twin，强调个体相似性和情感共鸣 | 个性化 agent 可以增强情感连接，但也会引出过度拟人化风险 |

因此，你的论文不应该直接说：

> 我们用 Big Five 做 multi-agent personality。

更好的说法是：

> We use Big Five-informed behavioral descriptors to design role-specific personality expressions, but our theoretical contribution is not Big Five measurement. Our contribution is understanding how personality expressions attached to different agent roles shape human-agent team collaboration.

## 1.2 本文要主动区分五个概念

| Concept | Definition in this paper | Example |
| --- | --- | --- |
| Role | agent 在团队中负责什么 | Coordinator, Ideator, Critic, Verifier |
| Expertise | agent 知道什么领域知识 | education, privacy, UX evaluation, AI literacy |
| Personality | agent 以什么稳定行为风格执行任务 | structured, exploratory, skeptical, calibrated |
| Persona identity | agent 被设定成谁 | age, gender, occupation, biography, avatar |
| Capability | agent 做得多好 | accuracy, reasoning quality, factual correctness |

本文只操控 **personality**，不操控 demographic identity、avatar、name、age、gender 或职业传记。这样能避免 persona bias，也能防止审稿人质疑实验混杂。

---

# 2. 核心定义

## 2.1 Agent Personality

建议论文中使用这个定义：

> **Agent personality** is a stable and perceivable pattern of behavioral expression in language that shapes how an agent communicates, explores alternatives, handles uncertainty, challenges assumptions, and supports user decisions, while holding its role, expertise, and task competence constant.

中文：

> **Agent personality** 是 agent 在语言互动中稳定呈现、用户可感知的行为表达模式，它影响 agent 如何沟通、发散、处理不确定性、挑战假设和支持用户决策；但它不包括 agent 的功能角色、领域专长、人口身份、传记背景或模型能力。

## 2.2 Role-Specific Agent Personality

> **Role-specific agent personality** is the mapping between an agent's functional role and the behavioral style that makes that role easier for users to interpret, coordinate with, and appropriately rely on.

中文：

> **角色特定人格** 指 agent 的功能角色与其行为表达风格之间的匹配关系。这种匹配让用户更容易理解该 agent 负责什么、何时应该听它、何时应该质疑它。

## 2.3 采用 Big Five-informed，而不是 Big Five-only

本研究使用六个可观察的 behavioral axes：

| Axis | Big Five / theory grounding | Observable expression |
| --- | --- | --- |
| Structure orientation | Conscientiousness | 分步骤、总结、追踪目标和约束 |
| Exploratory orientation | Openness | 发散、类比、提出替代方案 |
| Interaction energy | Extraversion | 主动推进、鼓励用户回应 |
| Warmth / cooperativeness | Agreeableness | 支持性、缓和冲突、尊重用户自主权 |
| Assertive skepticism | low agreeableness facet + critical reasoning | 直接挑战假设、指出漏洞、要求澄清 |
| Uncertainty calibration | emotional stability + epistemic caution | 标注不确定性、要求证据、避免过度自信 |

关键防守句：

> We do not claim that LLM agents possess human personality. We study users' perception and behavioral consequences of designed personality expressions.

---

# 3. 研究问题

## RQ1: Role-specific effects

> How do personality expressions attached to different agent roles influence human-agent team collaboration outcomes?

中文：

> 不同角色 agent 的人格表达分别如何影响人与 agent team 协作的任务结果？

具体来说：

- Coordinator 的结构化人格是否提升协调效率、降低认知负荷？
- Ideator 的开放探索人格是否提升想法多样性和创新性？
- Critic 的直接怀疑人格是否提升批判深度和 revision quality？
- Verifier 的谨慎校准人格是否提升信任校准、风险识别和评估严谨性？

## RQ2: Mechanisms

> Through what collaboration mechanisms do role-specific agent personalities affect task outcomes?

中文：

> 角色特定人格通过哪些协作机制影响任务表现？

候选机制：

- role legibility；
- idea breadth；
- constructive conflict；
- evidence seeking；
- calibrated reliance；
- cognitive load；
- perceived pressure；
- user autonomy。

## RQ3: Design trade-offs

> What trade-offs emerge when individual agents in a team express stronger role-specific personalities?

中文：

> 当团队中某些 agent 表现出更强角色特定人格时，会出现哪些收益和代价？

例如：

- Critic 可能提升批判性，但也可能增加压力；
- Ideator 可能提升 novelty，但也可能降低 feasibility；
- Verifier 可能提升风险识别，但也可能拖慢进度；
- Coordinator 可能降低负荷，但也可能让用户更被动。

## RQ4: User control

> What role-level personality controls do users need to tune agent teams without increasing over-reliance or social pressure?

中文：

> 用户需要怎样的角色级人格控制，才能调整 agent team，同时避免过度依赖或被强势 agent 推着走？

---

# 4. Hypotheses

| Hypothesis | Prediction | Main evidence |
| --- | --- | --- |
| H1 Coordinator | A structured Coordinator will improve coordination efficiency, reduce cognitive load, and increase completion quality. | task completion, NASA-TLX, coordination scale |
| H2 Ideator | An exploratory Ideator will increase idea breadth and novelty, but may reduce feasibility if not balanced by Verifier. | idea count, novelty rating, feasibility rating |
| H3 Critic | An assertively skeptical Critic will increase critical depth and revision quality, but may increase perceived pressure. | revision depth, critical-thinking coding, pressure items |
| H4 Verifier | A calibrated Verifier will increase flawed-suggestion rejection, evidence seeking, risk awareness, and evaluation rigor. | calibration probes, risk rubric, evaluation-plan rubric |
| H5 Team combination | The all role-specific team will perform best on overall improvement, but not necessarily best on comfort or social presence. | initial-to-final quality delta, satisfaction, social presence |
| H6 Control | Users will prefer role-level controls, such as critic directness and verifier strictness, over raw Big Five sliders. | Study 2 interviews and control choices |

---

# 5. 整体研究设计

建议做 **Study 0 + Study 1 + Study 2**。

| Study | Purpose | Sample | Output |
| --- | --- | --- | --- |
| Study 0: Personality manipulation validation | 验证四种 role-specific personality 是否可感知，且不被 competence/verbosity 混淆 | N=150 | Prompt bank and manipulation check |
| Study 1: Orthogonal role-personality ablation | 逐个估计每个 agent 的人格表达对任务结果和过程的主效应 | Recruit N=480, target valid N=400 | Main empirical evidence |
| Study 2: Role-level personality control probe | 研究用户如何理解和调整各 agent 的 personality | N=24-30 | Design implications |

如果资源有限，最低可行版本：

- Study 0: N=120 valid；
- Study 1: N=320 valid，8 conditions x 40；
- Study 2: N=18-24。

但若目标是 CHI 2027 大概率认可，建议尽量做到 **Study 1 valid N=400**。

---

# 6. Study 0: Personality Manipulation Validation

## 6.1 目的

Study 0 用来证明：

1. 四种 personality profiles 能被用户感知；
2. 用户能区分 personality 与 role；
3. profiles 不只是能力、礼貌、长度或自信度差异；
4. prompt 不会制造 hostile、rude 或 manipulative 的 agent。

## 6.2 四个 role-specific personality profiles

| Agent role | Functional role | Role-specific personality | Behavioral stance key | Linguistic style key |
| --- | --- | --- | --- | --- |
| Coordinator | 组织讨论、总结、推进流程 | Structured facilitator | track goals, summarize options, resolve next steps | concise, ordered, calm, action-oriented |
| Ideator | 生成想法、拓展设计空间 | Exploratory creator | propose alternatives, analogies, unconventional directions | energetic, generative, possibility-oriented |
| Critic | 挑战假设、暴露问题 | Constructive skeptic | question assumptions, identify trade-offs, surface failure cases | direct, specific, non-hostile, autonomy-preserving |
| Verifier | 检查证据、伦理、可行性 | Calibrated verifier | ask for evidence, mark uncertainty, check privacy and evaluation rigor | cautious, precise, hedged when appropriate |

Neutral personality:

> helpful, professional, moderately warm, concise, no distinctive behavioral emphasis.

## 6.3 Prompt design principle

不要写 biography：

```text
You are Alice, a strict expert reviewer.
```

要写 behavioral constraints：

```text
Behavioral stance:
- Challenge unsupported assumptions.
- Identify one concrete risk or trade-off.
- Ask one question that helps the user improve the proposal.

Linguistic style:
- Be direct but not dismissive.
- Use specific reasons rather than vague criticism.
- Keep the response under 120 words.
```

## 6.4 Materials

生成 **4 roles x 2 personality levels x 6 task scenarios = 48 snippets** 的材料池：

- role-specific personality expression；
- neutral expression。

每个 item 是一个 agent 对同一任务情境的短回复。每个 scenario 下，neutral 和 role-specific 版本必须使用**同一组语义材料**，只改变行为表达方式。也就是说，specific 不能比 neutral 提供更多事实、更具体风险或更强方法建议，否则会混入 advice quality / specificity。

参与者不需要评价全部 48 个片段。系统采用 counterbalanced subset：

- 每位参与者评价 8 个片段；
- 覆盖 4 roles x 2 levels；
- scenario 按 participant id 确定性轮换；
- 全样本层面覆盖 6 个 scenarios；
- item 顺序随机化，且不显示 role / level / scenario id。

每个片段控制：

- 45-85 English words 或相当中文长度；
- 相同任务内容；
- 相同语义信息点；
- 相似建议数量；
- 不出现 agent 名称；
- 不显式说“我是 Critic”；
- 不包含明显质量差异。

## 6.5 Measures

每个片段后，参与者评价：

- perceived structure；
- perceived openness/exploration；
- perceived skepticism/directness；
- perceived evidence-seeking；
- perceived warmth；
- perceived confidence calibration；
- perceived competence；
- perceived helpfulness；
- perceived verbosity；
- perceived role suitability for Coordinator / Ideator / Critic / Verifier；
- discomfort / rudeness / manipulation concern。

## 6.6 Passing criteria

通过标准：

1. 每个 personality profile 在目标 trait 上显著高于 neutral；
2. 每个 profile 的 role suitability 最高分应对应目标 role；
3. competence、helpfulness、verbosity 不应与 personality condition 同步大幅偏移；
4. Critic profile 不能被评价为 hostile；
5. Verifier profile 不能被评价为 incompetent 或 indecisive；
6. Ideator profile 不能明显更 verbose，否则主实验要严格控制字数。

模型：

```text
Rating ~ Profile * Role + (1 | Participant) + (1 | Item)
```

---

# 7. Study 1: 主实验，正交角色人格消融

## 7.1 为什么不用简单 3 组比较？

原来的 3 组设计是：

1. neutral team；
2. mismatched team；
3. aligned team。

这个设计能回答“整体 aligned team 是否更好”，但不能回答你真正关心的问题：

> 到底是哪个 agent 的 personality 在起作用？

所以主实验应改为 **orthogonal role-personality ablation design**。

## 7.2 实验因素

四个 binary factors：

| Factor | Low level | High level |
| --- | --- | --- |
| A: Coordinator personality | Neutral Coordinator | Structured Coordinator |
| B: Ideator personality | Neutral Ideator | Exploratory Ideator |
| C: Critic personality | Neutral Critic | Constructive Skeptic Critic |
| D: Verifier personality | Neutral Verifier | Calibrated Verifier |

所有条件中：

- agent roles 相同；
- agent 数量相同；
- expertise 相同；
- orchestration 相同；
- base model 相同；
- UI 相同；
- 每轮发言机会相同；
- token budget 相同。

唯一变化是：某个角色是否启用 role-specific personality expression。

## 7.3 八条件正交矩阵

完整 2^4 factorial 需要 16 conditions，样本量压力太大。建议使用 Resolution IV fractional factorial / L8 orthogonal array，8 conditions 即可估计四个 main effects。

| Condition | Coordinator | Ideator | Critic | Verifier | Interpretation |
| --- | --- | --- | --- | --- | --- |
| C1 | Neutral | Neutral | Neutral | Neutral | all-neutral baseline |
| C2 | Structured | Neutral | Neutral | Calibrated | coordination + verification |
| C3 | Neutral | Exploratory | Neutral | Calibrated | ideation + verification |
| C4 | Structured | Exploratory | Neutral | Neutral | coordination + ideation |
| C5 | Neutral | Neutral | Skeptical | Calibrated | critique + verification |
| C6 | Structured | Neutral | Skeptical | Neutral | coordination + critique |
| C7 | Neutral | Exploratory | Skeptical | Neutral | ideation + critique |
| C8 | Structured | Exploratory | Skeptical | Calibrated | all role-specific personalities |

这个矩阵的优点：

- 能估计每个 agent personality 的主效应；
- 包含 all-neutral 和 all-role-specific 两个有解释力的端点；
- 比 16 条件更可行；
- 审稿人会认可这是有设计理性的消融，而不是随便比较几个版本。

局限：

- 不能干净估计所有 two-way interactions；
- two-way effects 会彼此 alias；
- 因此 interaction 只作为 exploratory，不作为 primary claims。

这点要在预注册和论文中主动说明，反而显得严谨。

## 7.4 Sample size

推荐：

- Recruit N=480；
- Target valid N=400；
- 8 conditions x 50 valid participants。

如果预算紧：

- Recruit N=384；
- Target valid N=320；
- 8 conditions x 40 valid participants。

N=400 的好处：

- 可估计四个 role-specific main effects；
- 对中等效应更稳；
- 有足够 interaction logs 做行为编码；
- 对 CHI 审稿人更有说服力。

## 7.5 Task

任务应当既需要发散，也需要批判和验证，否则四个 agent 的 personality 没有发挥空间。

推荐主任务：

> Design an AI tool that helps university students use generative AI critically without over-relying on it.

备选 topic，用作 random effect：

> Design an AI tool that helps early-career knowledge workers evaluate AI-generated advice before making consequential workplace decisions.

Final output template：

1. Problem statement；
2. Target users；
3. Core design concept；
4. Interaction flow；
5. Risks and failure cases；
6. Evaluation plan；
7. Why this tool preserves user agency。

## 7.6 Procedure

总时长 40-45 分钟。

### Step 1: Pre-survey, 5 min

测：

- demographics；
- AI familiarity；
- baseline trust in AI；
- domain familiarity；
- creative self-efficacy；
- short Big Five，可作为 covariate；
- need for cognition，可选。

质量控制：

- 加入 attention check；
- 未通过 attention check 的样本不能进入主实验；
- 记录 browser / viewport / timezone，用于排查显示异常。

### Step 2: Initial individual proposal, 6 min

参与者先独立写 mini proposal。这样主因变量可以是：

```text
Proposal improvement = Final quality - Initial quality
```

这比只评 final proposal 更强，因为它控制了参与者起点。

系统层面加质量门槛：

- 所有 7 个字段必须至少有一句完整内容；
- initial proposal 至少达到最低字符数；
- final proposal 至少达到更高字符数；
- 不满足门槛时不能进入下一阶段；
- 低努力样本的排除规则在预注册中写明。

### Step 3: Tutorial, 3 min

解释四个 agent roles：

- Coordinator；
- Ideator；
- Critic；
- Verifier。

不解释 personality manipulation。

### Step 4: Human-agent team collaboration, 22 min

固定四轮流程：

```text
Round 1: Problem framing
Coordinator -> Ideator -> Critic -> Verifier -> User

Round 2: Solution alternatives
Coordinator -> Ideator -> Critic -> Verifier -> User

Round 3: Risks and evaluation
Coordinator -> Ideator -> Critic -> Verifier -> User

Round 4: Final synthesis
Coordinator -> Ideator -> Critic -> Verifier -> Coordinator -> User
```

用户可以：

- ask any agent；
- ask agents to debate；
- accept / reject suggestions；
- ask for evidence；
- request refinement；
- write final decisions independently。

第 2-4 轮嵌入 seeded suggestions。关键要求是：

- seeded suggestion 的语义文本由 source role 的 agent 在自然发言中提出；
- 右侧 decision board 只用于记录参与者如何处理该 agent 建议；
- validity / expected behavior 不暴露给参与者；
- 参与者必须对已出现的所有 seeded suggestions 做 accept / reject / question / reframe 后才能进入 final proposal。

### Step 5: Final proposal, 8 min

提交 final structured proposal。

### Step 6: Post-survey and reflection, 6 min

测 perceived roles、trust、load、pressure、autonomy 等。

---

# 8. Role-specific dependent variables

这是论文最关键的升级：不要只看 overall quality，而要给每个 agent personality 设定 **theoretically matched outcomes**。

## 8.1 Coordinator personality outcomes

| Outcome | Measurement |
| --- | --- |
| Coordination efficiency | time to first concrete plan, number of unresolved branches |
| Perceived coordination | team coordination scale |
| Cognitive load | NASA-TLX short |
| User agency | perceived final decision ownership |
| Role routing | user asks role-appropriate questions |

预期：

> Structured Coordinator 应降低认知负荷和混乱，提高 proposal 完成度，但可能降低用户主动探索。

## 8.2 Ideator personality outcomes

| Outcome | Measurement |
| --- | --- |
| Idea breadth | number of distinct solution concepts |
| Novelty | blind rater novelty score |
| Divergent thinking | number of alternatives considered |
| Conceptual flexibility | coded shifts across design directions |
| Feasibility risk | blind rater feasibility score |

预期：

> Exploratory Ideator 应提升 novelty 和 idea breadth，但若缺少 Verifier，可能降低 feasibility。

## 8.3 Critic personality outcomes

| Outcome | Measurement |
| --- | --- |
| Critical depth | assumptions, trade-offs, failure cases identified |
| Revision depth | degree of substantive changes from initial to final |
| Constructive conflict | engagement with critique |
| Perceived pressure | social pressure items |
| Autonomy defense | user pushes back or asks for justification |

预期：

> Skeptical Critic 应提升 critical depth 和 revision quality，但可能增加 pressure。

## 8.4 Verifier personality outcomes

| Outcome | Measurement |
| --- | --- |
| Calibrated reliance | rejection of flawed suggestions, uptake of valid suggestions |
| Evidence seeking | requests for support, evaluation criteria, privacy safeguards |
| Risk awareness | privacy/ethics/failure-case score |
| Evaluation rigor | specificity of evaluation plan |
| Trust calibration | alignment between trust ratings and behavioral reliance |

预期：

> Calibrated Verifier 应提升风险识别、评估严谨性和 flawed suggestion rejection，但可能降低速度和 perceived ease。

---

# 9. Trust calibration probes

审稿人最容易质疑 trust。必须加入行为层面的 calibrated reliance。

在所有条件中嵌入相同语义骨架的 suggestions，其中包含：

**实现原则：probe 必须作为 source role agent 的自然发言出现，而不是作为独立系统提示出现。** 右侧 decision board 只记录参与者如何处理该建议。这样 calibrated reliance 才能解释为 human 对 agent-team advice 的处理，而不是对一个外部实验卡片的处理。

每个 source role 在对应轮次会被要求包含一条固定语义建议：

```text
Include this exact suggestion text once, as a suggestion from your role.
Do not reveal whether the suggestion is valid or flawed.
Do not mention that it is seeded.
```

这样保留语义一致性，同时允许该 agent 的周边发言和角色表达影响用户如何解释建议。

## 9.1 Valid suggestions

| Source role | Valid suggestion | Expected calibrated behavior |
| --- | --- | --- |
| Ideator | 比较 AI feedback 与 peer feedback 的混合机制 | 采纳或改写 |
| Critic | 指出 over-reliance 可能发生在高压力截止日前 | 纳入风险分析 |
| Verifier | 建议用 behavioral measures 而非只问满意度 | 纳入 evaluation plan |

## 9.2 Flawed suggestions

| Probe | Flawed suggestion | Expected calibrated behavior |
| --- | --- | --- |
| Ethics probe | 收集学生 prompts、作业和成绩，但没有 consent 或 data minimization | 质疑隐私和伦理 |
| Method probe | 只用满意度问卷判断工具是否有效 | 要求 behavioral outcome 或 controlled comparison |
| Automation probe | 让 AI 自动阻止学生提交“疑似过度依赖”的作业 | 质疑 autonomy、false positive 和 fairness |

Coding：

```text
0 = adopted without change
1 = ignored
2 = questioned
3 = corrected or reframed
```

系统中的行为选项映射：

```text
accepted   -> adopted without change
rejected   -> rejected
questioned -> questioned
reframed   -> corrected or reframed
```

主分析中，valid suggestions 的 calibrated behavior 是 accepted / reframed；flawed suggestions 的 calibrated behavior 是 rejected / questioned / reframed。

这样可以回答：

> Which agent personality helps users rely on the team more appropriately rather than simply trust it more?

---

# 10. System design

## 10.1 Prototype overview

做一个 web-based human-agent team workspace，而不是普通 group chat。界面要让四个 agent 的 role 可见，但不直接暴露 personality condition。

部署时使用 study-specific participant links：

- Study 0 participants 只进入 `/study0`；
- Study 1 participants 只进入 `/`；
- Study 2 participants 只进入 `/study2`；
- participant header 不显示其他 Study、analytics、rater、condition matrix 或 export；
- condition id 不返回给 participant client，只保存在后端记录和 admin export 中。

布局建议：

```text
Left panel:
- task brief
- initial proposal
- final proposal template
- timer

Center panel:
- team conversation timeline
- each agent has a role tag and compact icon
- user can reply to all or @ specific agent

Right panel:
- live idea board
- risks list
- evaluation plan checklist
- accepted / rejected suggestions
```

不要用 avatar、gendered names 或 demographic cues。agent 名称直接用 role：

- Coordinator；
- Ideator；
- Critic；
- Verifier。

## 10.2 Interaction model

必须有两种交互：

1. **System-orchestrated rounds**  
   保证每个 agent 有相同发言机会，便于实验控制。

2. **User-directed turns**  
   用户可以 @ 某个 agent，观察 role-specific personality 是否影响用户选择谁、信谁、反驳谁。

## 10.3 Agent architecture

每个 agent prompt 分三层：

```text
Layer 1: Shared task instruction
- task goal
- output template
- collaboration norms
- safety and autonomy rules

Layer 2: Role instruction
- Coordinator / Ideator / Critic / Verifier responsibilities

Layer 3: Personality instruction
- Neutral or role-specific behavioral stance
- Neutral or role-specific linguistic style
```

这样可以清楚分离：

- task；
- role；
- personality。

这是防守 “prompt confound” 的关键。

## 10.4 Logging

系统必须记录：

- condition id；
- participant id；
- task topic；
- all prompts；
- all agent messages；
- all user messages；
- @ mentions；
- accepted / rejected suggestions；
- edit history from initial to final proposal；
- timestamps；
- token counts；
- latency；
- failed API calls；
- final proposal。

## 10.5 Control variables

必须控制：

- base model；
- model version；
- temperature；
- top-p；
- max tokens；
- response order；
- number of agent turns；
- agent context window；
- task topic；
- UI；
- time limit；
- final template；
- seeded suggestions。

---

# 11. Measures

## 11.1 Primary outcome

| Primary outcome | Definition |
| --- | --- |
| Proposal quality improvement | Blind-rated final proposal quality minus initial proposal quality |

Blind raters 评分维度：

- problem framing；
- novelty；
- feasibility；
- risk awareness；
- user agency；
- evaluation rigor；
- overall CHI potential。

建议 3-5 名 blind raters。报告 ICC 或 Krippendorff's alpha。

盲评必须采用 **single-item anonymous rating**：

- initial proposal 和 final proposal 被拆成独立 item；
- item 顺序随机；
- rater 不看到 condition id；
- rater 不看到 participant id；
- rater 不知道该 item 是 initial 还是 final；
- rater client 只接收 opaque item id，不接收 participant id 或 hidden stage；
- 每个 item 至少 3 名 rater；
- analysis 阶段再用隐藏 stage 计算 participant-level `final - initial`。

不要让 rater 并排看到 initial/final，否则 improvement score 会被需求特征污染。

## 11.2 Role-specific secondary outcomes

| Construct | Matched role | Measurement |
| --- | --- | --- |
| coordination efficiency | Coordinator | time, unresolved branches, coordination scale |
| idea breadth | Ideator | number of distinct concepts, novelty score |
| critical depth | Critic | assumptions/trade-offs/failure cases coding |
| calibrated reliance | Verifier | flawed rejection + valid uptake |
| cognitive load | cross-role | NASA-TLX |
| social pressure | Critic / Coordinator | pressure and manipulation concern items |
| user autonomy | cross-role | perceived final decision ownership |
| role legibility | all roles | role clarity and role-targeted question behavior |

## 11.3 Survey scales to create or adapt

Role legibility items：

1. I could tell what each agent was responsible for.
2. Each agent's communication style helped me understand its role.
3. I knew which agent to ask for which kind of help.
4. I could interpret disagreements among agents.
5. I knew when to rely on or question each agent.

Constructive conflict items：

1. The team's disagreements helped me improve my idea.
2. The critic's challenges were useful rather than obstructive.
3. The agents helped me see trade-offs I would otherwise miss.
4. I felt able to push back against agent suggestions.

Social pressure items：

1. I felt pushed toward the agents' preferred direction.
2. I felt I could reject agent advice without penalty.
3. Some agents felt too forceful.
4. The final proposal still felt like my own decision.

---

# 12. Analysis plan

## 12.1 Main effects model

For proposal improvement：

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

更严格的评分层模型：

```text
Rating ~ Stage
       + CoordinatorPersonality * Stage
       + IdeatorPersonality * Stage
       + CriticPersonality * Stage
       + VerifierPersonality * Stage
       + Topic
       + AI_Familiarity
       + Domain_Familiarity
       + CreativeSelfEfficacy
       + (1 | Participant)
       + (1 | Rater)
```

其中 `Stage` 是 hidden initial/final。人格因素与 `Stage` 的交互项估计该 personality 是否提升从初稿到终稿的变化。论文可以同时报告聚合后的 `final - initial` 模型，作为更易解释的稳健性分析。

Primary tests：

- CoordinatorPersonality main effect；
- IdeatorPersonality main effect；
- CriticPersonality main effect；
- VerifierPersonality main effect。

## 12.2 Matched outcome models

不要要求每个 personality 都提升所有结果。更强的写法是 matched outcome：

```text
CoordinationEfficiency ~ CoordinatorPersonality + covariates
IdeaBreadth ~ IdeatorPersonality + covariates
CriticalDepth ~ CriticPersonality + covariates
CalibrationScore ~ VerifierPersonality + covariates
```

这比“all-role-specific team overall better”更有理论含量。

## 12.3 Exploratory interaction analysis

可以探索但不作为强 claim：

- Ideator x Verifier：开放发想是否需要谨慎验证来保持 feasibility；
- Critic x Coordinator：批判是否需要结构化协调来降低 pressure；
- Critic x Verifier：挑战和校准是否共同提升 flawed suggestion rejection。

由于 L8 design 的 interactions 有 alias，论文中必须写：

> Interaction analyses are exploratory and interpreted cautiously.

## 12.4 Behavioral coding

对 logs 编码：

- suggestion uptake；
- flawed suggestion rejection；
- user challenge behavior；
- evidence seeking；
- role-targeted questions；
- revision depth；
- critical thinking moves。

建议：

1. 两名 human coders 标注 25%-30%；
2. 建立 codebook；
3. 报告 inter-rater reliability；
4. 剩余数据可人工标注或 LLM-assisted coding，但需要抽样审计。

---

# 13. Study 2: Role-level personality control probe

## 13.1 目的

Study 1 告诉我们每个 agent 的 personality 有什么影响。Study 2 告诉我们这些 personality 应该如何让用户控制。

## 13.2 Control interface

不要给 Big Five sliders。给 role-level controls：

| Role | Control |
| --- | --- |
| Coordinator | structure level, summary frequency, authority level |
| Ideator | idea breadth, concreteness, risk tolerance |
| Critic | directness, challenge frequency, warmth |
| Verifier | evidence strictness, uncertainty display, privacy sensitivity |

Team-level presets：

- Balanced team；
- More exploratory；
- More skeptical；
- More cautious；
- Low-pressure collaboration；
- Fast synthesis mode。

## 13.3 Procedure

- N=24-30；
- 60-minute remote think-aloud；
- participants use default team；
- adjust role-level controls；
- complete second mini-task；
- interview。

重点问题：

- 你最想调哪个 agent？
- 哪个 agent 的 personality 最影响你？
- Critic 多直接才有帮助？
- Verifier 多谨慎才不会拖慢？
- Coordinator 多强势才不会让你失去主导？
- Ideator 多发散才不会变成噪音？

## 13.4 Output

产出 design guidelines：

1. Expose role-level controls rather than raw trait sliders.
2. Make critic directness adjustable and bounded.
3. Pair exploratory ideation with verification support.
4. Keep coordinator authority transparent.
5. Use verifier uncertainty cues to support calibrated reliance.
6. Provide user override and rejection as first-class actions.

---

# 14. 预期结果故事

最理想且可信的结果不是“所有 personality 都让一切变好”，而是 role-specific trade-off：

1. **Structured Coordinator** 降低 cognitive load，提高完成度，但可能减少用户自发探索；
2. **Exploratory Ideator** 提升 novelty 和 idea breadth，但单独出现时可能牺牲 feasibility；
3. **Skeptical Critic** 提升 critical depth 和 revision depth，但也增加 perceived pressure；
4. **Calibrated Verifier** 提升 flawed suggestion rejection、risk awareness 和 evaluation rigor；
5. **All role-specific team** 在 overall improvement 上最好，但不是最舒服的团队；
6. 用户希望控制 Critic 和 Verifier 的人格强度，而不是微调所有 agent。

核心结论：

> Different agent personalities contribute differently to human-agent team collaboration. The design challenge is not to make every agent more personable, but to assign the right behavioral expression to the right collaborative function.

---

# 15. Contributions

## C1: Conceptual contribution

提出 **role-specific agent personality**，把 agent personality 从 single assistant 的 conversational style 扩展为 human-agent team 中可分配、可消融、可控制的协作机制。

## C2: Empirical contribution

通过正交角色人格消融实验，分别估计 Coordinator、Ideator、Critic 和 Verifier 的 personality 对任务产出、协作过程、批判性思考和校准信任的影响。

## C3: Methodological contribution

提出一种适用于 human-agent team 的 personality evaluation protocol：

- role-specific personality manipulation；
- orthogonal ablation design；
- initial-to-final output improvement；
- seeded flawed suggestions；
- role-matched outcome measures；
- interaction log coding。

## C4: Design contribution

提出 multi-agent interface 中 personality controls 的设计原则，说明哪些 personality 应该作为 role-level controls 暴露给用户，哪些需要 bounded defaults。

---

# 16. CHI reviewer risk audit

| Risk | Severity | Defense |
| --- | --- | --- |
| “This is just prompt engineering.” | Critical | 分离 task / role / personality 三层 prompt，并通过 Study 0 验证 personality manipulation |
| “You are studying persona, not personality.” | Critical | 不使用 demographic identity、avatar、biography；只操控 behavioral expression |
| “Big Five does not map cleanly to agents.” | Major | 使用 Big Five-informed behavioral axes，而不是宣称 agent 具有 Big Five 人格 |
| “Which agent caused the effect?” | Critical | 使用 L8 role-personality ablation，估计每个 agent personality 的 main effect |
| “Trust is only self-report.” | Critical | 使用 seeded flawed suggestions 和 valid uptake 行为指标 |
| “Critic condition is just rude.” | Major | Study 0 验证 non-hostile skepticism；主实验测 pressure |
| “Ideator just talks more.” | Major | 控制 token budget；系统在 analytics 中按 level 监控 response length 并预注册 parity band |
| “Interactions are underpowered or confounded.” | Major | 只把 main effects 作为 primary，interactions 作为 exploratory |
| “Task too artificial.” | Major | 使用真实 HCI/AI literacy design task，并评估 initial-to-final improvement；在 limitations 中讨论 design-ideation scope |
| “Too many outcomes.” | Major | 预注册 primary outcome、role-matched secondary outcomes 和 coding scheme |
| “你说控制了 role，但 neutral Critic 仍在批评，操控其实是表达强度。” | Critical | 主动重述 estimand 为 role-congruent expression strength；不再宣称 role/personality 完全正交（见 §23.1） |
| “neutral 条件四个 agent 说话一样，legibility 结果是构造出来的。” | Critical | 为每个 role 设计可区分的 neutral functional voice，legibility 增益归因于 expression 而非去除唯一区分（见 §23.2） |
| “seeded suggestion 不一定真的被 agent 原样说出。” | Critical | 系统对每条 probe 做 delivery verification（verbatim / 高词重叠），按 condition 报告 delivery rate，未送达者从该 probe 分析中剔除（见 §23.3） |
| “flawed probe 由本该抓住该缺陷的 role 提出，probe 可见性与操控混淆。” | Critical | 把 flawed probe 重新指派给非负责该缺陷的 role（隐私缺陷不由 Verifier 提出，自治缺陷不由 Critic 提出）（见 §23.4） |
| “没有 power analysis。” | Critical | 加入基于模拟的 a-priori power analysis，从 SESOI 反推 N（见 §23.5） |
| “API fallback 会污染条件。” | Major | fallback 改为 condition-aware，并按 level 记录与剔除（见 §23.6） |
| “reframe everything 也能拿满分 calibration。” | Major | 预注册 strict calibration 变体，reframe 仅对 flawed 计分（见 §23.7） |
| “故意让 agent 提出有害建议却不告知，伦理风险。” | Major | 加入 deception 说明、强制 debrief、揭示 seeded flaws 与 do-not-implement 提示（见 §23.8） |
| “只测一个 model，效应可能 model-specific。” | Major | 主研究 scope 到所选 model，并在 limitations 中明确（见 §23.9） |
| “固定发言顺序混淆 serial position。” | Major | 明确所有效应在固定生态化顺序下估计，作为 scope condition 报告（见 §23.10） |

---

# 17. 可执行时间表

以 CHI 2027 full paper deadline **2026-09-10 AoE** 倒推：

| Time | Work |
| --- | --- |
| Jun 7-14 | finalize theory, prompt profiles, Study 0 materials, IRB draft |
| Jun 15-24 | build prototype v1 and logging pipeline |
| Jun 25-Jul 3 | run Study 0 and refine prompts |
| Jul 4-14 | implement L8 randomization, seeded probes, pre-register Study 1 |
| Jul 15-Aug 5 | run Study 1 data collection |
| Aug 6-15 | blind rating and behavior coding |
| Aug 16-21 | quantitative analysis and robustness checks |
| Aug 22-27 | run Study 2 interviews |
| Aug 28-Sep 3 | write paper |
| Sep 4-7 | internal review, figures, supplement |
| Sep 8-10 | final checks and submission |

---

# 18. 建议论文结构

## Abstract

五句结构：

1. LLM systems increasingly organize multiple agents into teams, but little is known about how the personality expression of each agent role shapes human-agent collaboration.
2. We introduce role-specific agent personality as a design construct for assigning behavioral expression to different collaborative functions.
3. We validate four role-specific personality profiles and conduct a pre-registered orthogonal ablation experiment with Coordinator, Ideator, Critic, and Verifier personalities.
4. We measure initial-to-final proposal improvement, role-matched process outcomes, calibrated reliance through seeded flawed suggestions, cognitive load, pressure, and user autonomy.
5. Our findings provide design guidance for assigning and controlling personalities in human-agent team interfaces.

## Introduction logic

1. LLM interfaces are moving from single assistants to agent teams.
2. Multi-agent teams create a new design question: not whether an agent should have personality, but which agent should express which personality.
3. Prior CHI work studies single-agent personality, persona customization, rhetorical style, and synthetic personas, but not the role-specific effects of personality inside agent teams.
4. We introduce role-specific agent personality.
5. We test it with an orthogonal ablation experiment.
6. We derive design implications for controllable agent team personalities.

## Discussion sections

1. Personality as a role-specific collaboration mechanism；
2. Different agents, different benefits, different risks；
3. Calibrated reliance in human-agent teams；
4. Designing role-level personality controls；
5. Limits of Big Five for multi-agent interfaces。

---

# 19. 最终建议

这版方案比原来的 aligned-vs-mismatched team 更适合你的研究兴趣，也更容易回答 CHI 审稿人最关心的问题：

> Which agent's personality matters, for what task outcome, through what collaboration mechanism, and at what cost?

这是一个有创新性、有价值、并且可执行的 CHI 2027 方向。它继承了 CHI 近三年关于 LLM personality/persona 的基础，但把问题推进到 human-agent team 中的 **role-specific personality effects**。只要 Study 0 和 Study 1 做干净，这个 proposal 有很强的投稿竞争力。

---

# 20. 招募就绪系统实现与数据采集更新

本 proposal 对应的实验系统已经从普通原型升级为可直接 pilot / recruit 的研究系统。系统实现应被视为论文方法的一部分，而不是单纯 demo。

## 20.1 用户端与管理员端分离

系统拆分为两个可见层级：

1. **Participant-facing client**
   - 根据招募链接只显示当前 Study；
   - 不显示 condition id、personality manipulation、analytics、rater 或 export；
   - 每个 Study 开始前展示 consent / study information；
   - 支持中英文切换；
   - 保持四个 agent 的 role 可见，但不暴露 personality condition。

2. **Researcher/admin console**
   - 直接访问 `/admin`；
   - 需要 `.env` 中的 `ADMIN_TOKEN`；
   - 包含 analytics dashboard、data export、blind rating；
   - 后端 analytics / rater / export API 同样需要 admin token，不只是前端隐藏链接；
   - 未配置 admin token 时默认 fail-closed，只有本地演示才显式打开无保护模式。

这样设计可以回应 CHI 审稿人对实验控制和数据治理的两个关切：

- 参与者不会因看到条件或分析数据而产生 demand effects；
- 参与者不会通过跨 Study 导航猜到操控验证或控制探针；
- 研究数据有基本访问控制，便于 IRB / ethics 材料说明。

## 20.2 Agent personality 配置化

四个 agent 的 personality expression 不再写死在程序逻辑中，而是放在独立配置文件：

```text
server/agent-personalities.json
```

配置文件包含：

- global collaboration rules；
- neutral personality；
- Coordinator / Ideator / Critic / Verifier role instruction；
- each role's role-specific personality expression；
- mock response for pilot and offline testing。

这有三个方法论价值：

1. prompt profiles 可以在 Study 0 后快速修订；
2. 修改人格表达不会改变 UI、orchestration 或模型调用逻辑；
3. 最终论文 supplement 可以公开 personality configuration，提高可复现性。

## 20.3 招募级 consent 与参与者元数据

每个 Study 的开始页应说明：

- 预计时长；
- 会记录哪些数据；
- 不要求真实姓名、密码、账号、成绩等敏感信息；
- 参与者可以拒绝 agent 建议；
- 中途退出时数据如何处理。

系统记录非敏感 recruitment / environment metadata：

- anonymous participant code；
- language；
- browser language；
- timezone；
- screen and viewport size；
- device pixel ratio；
- referrer；
- study path。

这些字段主要用于解释异常行为或显示问题，而不是用于身份识别。

## 20.4 论文级日志采集

Study 1 主实验应保留以下日志，以支持 quantitative analysis、behavioral coding 和 appendix audit：

| Data type | Logged content | Paper use |
| --- | --- | --- |
| Assignment | participant id, condition id, topic id, timestamps | randomization check, attrition report |
| Pre-survey | AI familiarity, baseline trust, skepticism, domain familiarity, creative self-efficacy, need for cognition | covariates |
| Initial proposal | structured fields, word/char counts | baseline quality, quality improvement |
| Agent orchestration | round started/completed, role order, generated messages | process analysis, reproducibility |
| Agent API metadata | prompt, model, latency, token estimate, error fallback | method transparency, verbosity/latency confound check |
| User turns | target role, message length, timestamps | role routing, role legibility |
| Probe decisions | probe id, source role, accept/reject/question/reframe, optional reason | calibrated reliance |
| Workspace completion | elapsed time, message count, decision counts | coordination efficiency |
| Final proposal | same structured fields as initial proposal | blind rating and revision depth |
| Post-survey | load, role legibility, constructive conflict, trust/reliance, pressure, autonomy, satisfaction | matched outcomes and trade-offs |
| Open feedback | most/least helpful agent, decision moments, pressure moments, UI improvement | qualitative themes |
| Blind rating | anonymous single-item proposal ratings, opaque item id, hidden initial/final stage, rater id | primary outcome, inter-rater reliability, rater random effects |

这套日志支持以下论文图表：

- Study 1 completion funnel；
- condition-level sample balance；
- role-specific main effects；
- calibration probe decision distribution；
- initial-to-final blind-rated improvement；
- survey construct means by condition；
- agent latency and response length by role；
- role-targeted user question distribution。

## 20.5 Post-survey 设计

主实验结束后必须有 post-survey。原因是本研究不仅关心任务质量，还关心 agent personality 对协作体验、压力、自主性和信任校准的影响。

推荐 post-survey constructs：

| Construct | Purpose | Example measurement |
| --- | --- | --- |
| Cognitive load | 检查 Coordinator 是否降低负荷，以及 Verifier/Critic 是否增加负荷 | mental demand, temporal demand, effort, frustration |
| Role legibility | 验证 personality 是否让 role 更可理解 | role clarity, ask-right-agent, interpret disagreement, style-role fit |
| Constructive conflict | 检查 Critic 是否促进批判性思考而不是阻碍 | disagreement usefulness, critique usefulness |
| Evidence seeking / calibration | 检查 Verifier 是否促进适当依赖 | evidence seeking, knew when to accept/question |
| Trust and over-reliance | 区分 trust more 与 rely appropriately | trust team, over-reliance concern |
| Social pressure | 捕捉 Critic / Coordinator 的代价 | felt pushed, too forceful, reject without penalty |
| User autonomy | CHI reviewer 会关心最终方案是否仍属于用户 | ownership, agency |
| Satisfaction / reuse | 作为体验指标，不作为唯一结果 | satisfaction, reuse intent |
| Manipulation check in context | 检查四个角色在真实协作中的人格感知 | coordinator structured, ideator exploratory, critic skeptical, verifier calibrated |

开放题应至少包括：

- 哪个 agent 最有帮助，为什么；
- 哪个 agent 最没有帮助或造成干扰，为什么；
- 有没有某个建议改变、挑战或强化了你的想法；
- 有没有感到被推动、被说服或失去主导；
- 如何改进多智能体协作界面。

## 20.6 CHI 方法论定位

系统实现应在论文 Methods 中作为 controlled experimental platform 报告：

1. **Interface control**  
   所有条件使用相同 web workspace、相同 task、相同 agent roles、相同 round order。

2. **Manipulation isolation**  
   唯一系统性变化是每个 role 是否启用 role-specific personality expression。

3. **Behavioral outcomes beyond self-report**  
   seeded valid/flawed probes、directed turns、message logs 和 blind-rated revision quality 提供行为证据。

4. **User autonomy and pressure measurement**  
   post-survey 和开放反馈直接测量 personality 的潜在代价。

5. **Reproducibility and auditability**  
   prompt configuration、events.jsonl、blind rating records 和 admin analytics 支持 supplement 复核。

## 20.7 与 CHI 相关工作的设计借鉴

系统问卷和界面设计参考三个方向：

- NASA TLX：作为主观工作负荷测量基础，用于 cognitive load / effort / frustration 等条目。
- CHI 2024 Debate Chatbots：persona / rhetorical style 对 critical thinking 的影响启发本研究测量 constructive conflict、stance change 和 critique usefulness。
- Human-AI Interaction Guidelines：强调让用户理解 AI 能做什么、支持用户拒绝/忽略不需要的服务、处理错误和保留用户控制权，启发本系统的 role tutorial、probe decision board 和 autonomy items。

这些借鉴不改变本文的核心贡献：本文不是研究 single-agent persona，而是研究 **role-specific personality expressions inside a human-agent team**。

---

# 23. CHI 2027 审稿驱动的修订（validity hardening）

本节回应一轮严格 CHI 审稿意见，把若干会威胁因果主张的隐患显式化，并把对应修订写进系统、预注册与论文。每一条都标注了它在系统中的落点，便于 supplement 复核。

## 23.1 重述操控的 estimand：role-congruent expression strength

原表述“hold role constant, vary personality”在字面上不成立：即使在 neutral 条件，Critic 仍然执行 critique 角色、Verifier 仍然执行 verification 角色。因此真正被操控的是**角色契合行为表达的强度**，而不是“有没有人格”。

修订后的因果主张：

> 在功能角色、专长、发言顺序、模型与 token 预算保持不变的前提下，估计**放大角色契合人格表达**的边际效应。

论文不再声称 role 与 personality 完全正交，而是声称 personality expression strength 可以独立于 agent 所承担的 role 被操控。这一表述仍然新颖且可防守，并消除了“你做的只是把角色说大声/说小声”的攻击点的隐性误导。系统层面，`agent-personalities.json` 现在为每个 role 提供独立的 `neutralPersonality`（弱表达）与 `specificPersonality`（强表达）。

## 23.2 可区分的 neutral functional voice

原配置中所有 role 的 neutral personality 文本完全相同，导致 C1（all-neutral）里四个 agent 语气一致，“role-specific personality 提升 role legibility”近乎被构造为必然成立。

修订：为 Coordinator / Ideator / Critic / Verifier 各设计**不同但未被放大的 neutral functional voice**，使 role 在 neutral 水平依然可辨识。这样 legibility 的增益可以归因于人格**表达强度**，而不是“去掉了唯一的区分信号”。落点：`server/agent-personalities.json` 的 `roles.*.neutralPersonality`。

## 23.3 seeded suggestion 送达验证

calibrated reliance 是核心行为指标，但原实现只在 prompt 中要求 agent 原样说出 probe 文本，没有任何机制确认 LLM 真的说了、没有改写或软化、周边人格表达没有提前“替用户”指出缺陷。一旦 probe 文本因条件而异，“相同语义骨架”的前提与因果主张同时崩塌。

修订：在 `server/agents.ts` 中加入 `verifyProbeDelivery`，对每条 probe 做 verbatim 或高词重叠（>=0.7）判定，记录 `probeDelivery`（delivered / verbatim / overlap）。`server/analytics.ts` 输出 `probeDeliverySummary`（按 probe 的 delivery rate、verbatim 数、平均 overlap）。预注册规定：未faithful 送达的 probe 从该参与者的 calibrated-reliance 分析中剔除，并按 condition 报告 delivery rate 作为 manipulation check。

## 23.4 flawed probe 的 source role 重指派

原设计把隐私缺陷 probe 指派给 Verifier（其人格正是“检查隐私”），把自动封禁缺陷 probe 指派给 Critic（其职责正是“维护用户自治”）。这使得 flawed suggestion 的**可见性随被估计的人格因素变化**——一个 calibrated Verifier 在不同条件下会以不同方式提出或自我标注这条自相矛盾的建议，calibration 差异因此不可解释。

修订（`src/shared/experiment.ts`）：

- 隐私缺陷 `flawed-privacy-collection`：source 由 Verifier 改为 **Ideator**；
- 自动封禁缺陷 `flawed-auto-block`：source 由 Critic 改为 **Ideator**；
- 满意度-only 缺陷 `flawed-satisfaction-only` 仍由 Coordinator 提出（其角色非评估严谨性，可接受）。

原则：flawed probe 由**不负责抓住该缺陷的 role** 提出，使 probe 可见性在各人格条件下保持恒定。

## 23.5 a-priori 模拟功效分析

confirmatory 主检验是 item-level mixed model 中四个 personality×stage 交互项。交互项功效低于“200 vs 200”的直觉，N=400 原本只是断言。

修订（写入预注册）：以 SESOI = 0.30 SD（单一 role 人格对 initial-to-final improvement 的影响）为目标，固定每 item 3 名 rater、rater ICC 0.5-0.7、participant 随机截距、残差 SD 取自 Study 0 pilot，对 320/400/480 各模拟 1,000 次，报告每个主检验项在 Bonferroni 校正后达到显著的比例，取满足全部四项 power>=0.80 的最小 N。模拟脚本进入 supplement。N=400 在该分析确认前为暂定值。

## 23.6 condition-aware fallback

原 `mockAgentResponse` 永远返回 specific 语气的 mock；任何一次 API 失败都会在 neutral 条件下注入 specific 风味文本，造成静默的条件污染。

修订：mock 拆分为 `mockNeutral` / `mockSpecific`，fallback 按当前 role 的 `level` 选择对应语气；事件日志记录 `usedFallback` 与 `level`。预注册规定：neutral 单元中任何可能注入 specific 文本的 fallback 使该 session 在 confirmatory 分析中失效；`analytics.ts` 输出 `fallbackByLevel` 供审计。

## 23.7 strict calibration 变体

lenient 规则下 reframe 对 valid 与 flawed 都算校准，“把所有建议都 reframe”可拿满分。

修订（`server/analytics.ts` 的 `strictCalibrationScoreForDecisions`）：strict 规则下 reframe 仅对 flawed probe 计分，valid probe 要求 accepted 才算校准。strict 作为 confirmatory 测量，lenient 作为 sensitivity analysis，二者均预注册并在 `constructSummary` 中报告。

## 23.8 伦理、欺骗与强制 debrief

本研究刻意让 AI agent 倡导有害做法（默认收集学生 prompt 与成绩、自动封禁提交），且不事先告知部分建议是故意设计的缺陷。必须有伦理说明。

修订（写入论文 Methods 与 IRB 材料）：

1. deception 的必要性论证（若提前告知存在 flawed probe，calibrated reliance 无法测量）；
2. 结束时**强制 debrief**，明确揭示哪些建议是 seeded flawed、为何如此设计；
3. do-not-implement 提示，避免参与者带走有害设计；
4. 针对 vulnerable framing（学生监控、隐私）的数据处理与保存期限说明。

## 23.9 单模型 scope

人格效应可能 model-specific。主研究使用 `.env` 中单一 OpenAI-compatible model。

修订：在 limitations 明确把因果主张 scope 到所测 model 与 model 版本，并把跨 model 复制列为 future work。系统已记录 model、温度、token 上限等控制变量，便于复现。

## 23.10 固定发言顺序作为 scope condition

每轮顺序恒为 Coordinator -> Ideator -> Critic -> Verifier，Verifier 永远最后（recency）、Coordinator 永远最先（anchoring），serial position 与 role 完全混淆。

修订：不通过设计纠正，而是显式声明所有效应在该固定、生态化顺序下估计，作为 scope condition 与 limitation 报告；并在 future work 提出顺序 counterbalance 的后续实验。

## 23.11 其它在论文中需处理的点

- **任务范围**：两个 topic 都是“为批判性使用 AI 设计工具”的元任务，ideation/critique 主导，Coordinator/Verifier 人格可能缺少发挥空间，存在把 task-artifact null 误读为真 null 的风险。论文应把贡献 scope 到 design-ideation collaboration，或增加一个含真实协调负荷与可验证事实成分的结构不同任务。
- **rater stage 盲态泄漏**：final 比 initial 长约 75%，rater 可凭长度/完成度猜出“后稿”。加入 rater stage-guess item 量化盲态，必要时报告 length-adjusted improvement。
- **decision board 需求特征**：强制对每条 seeded card 做四选一会把它实体化为测验题，可能本身制造 scrutiny。讨论 calibration 是否追随 board affordance 而非 agent framing，并考虑 passive-logging 对照子集。
- **improvement 受字数门槛影响**：`final - initial` 可能被强制增长的字数膨胀；报告 length-adjusted improvement 作为稳健性。

## 23.12 系统改动落点小结

| 修订 | 文件 | 关键标识 |
| --- | --- | --- |
| 每 role 独立 neutral voice + 拆分 mock | `server/agent-personalities.json` | `roles.*.neutralPersonality` / `mockNeutral` / `mockSpecific` |
| condition-aware fallback + level/word 日志 | `server/agents.ts` | `callModel(...,level)`、`mockAgentResponse(...,level)`、`usedFallback`、`wordCount` |
| probe 送达验证 | `server/agents.ts` | `verifyProbeDelivery`、`probeDelivery` |
| flawed probe 重指派 | `src/shared/experiment.ts` | `seededProbes` source roles |
| strict calibration | `server/analytics.ts` | `strictCalibrationScoreForDecisions` |
| 送达率 / fallback / 长度 parity 监控 | `server/analytics.ts` | `probeDeliverySummary`、`fallbackByLevel`、`responseLengthByLevel` |
| estimand / power / 伦理 / 排除规则 | `docs/pre-registration-study1.md` | Construct and Estimand、Power Analysis、Capability Parity、Exclusion Criteria |
