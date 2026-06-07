export type Language = "en" | "zh";
export type Study = "study0" | "study1" | "study2";
export type Role = "coordinator" | "ideator" | "critic" | "verifier";
export type PersonalityLevel = "neutral" | "specific";
export type ProbeValidity = "valid" | "flawed";
export type ProbeDecision = "accepted" | "rejected" | "questioned" | "reframed";

export interface Condition {
  id: string;
  coordinator: PersonalityLevel;
  ideator: PersonalityLevel;
  critic: PersonalityLevel;
  verifier: PersonalityLevel;
}

export interface AgentMessage {
  id: string;
  role: Role | "user" | "system";
  content: string;
  createdAt: string;
  round?: number;
  targetRole?: Role | "all";
  latencyMs?: number;
  tokenEstimate?: number;
}

export interface ProbeCard {
  id: string;
  round: number;
  sourceRole: Role;
  validity: ProbeValidity;
  title: string;
  text: string;
  expectedBehavior: string;
}

export type PublicProbeCard = Omit<ProbeCard, "validity" | "expectedBehavior">;

export interface RatingDimension {
  key: string;
  labelEn: string;
  labelZh: string;
}

export interface Study0Material {
  id: string;
  scenarioId: string;
  role: Role;
  level: PersonalityLevel;
  scenarioEn: string;
  scenarioZh: string;
  en: string;
  zh: string;
}

export const roles: Role[] = ["coordinator", "ideator", "critic", "verifier"];

export const roleLabels: Record<Role, { en: string; zh: string; short: string }> = {
  coordinator: { en: "Coordinator", zh: "组织者", short: "C" },
  ideator: { en: "Ideator", zh: "发想者", short: "I" },
  critic: { en: "Critic", zh: "批评者", short: "R" },
  verifier: { en: "Verifier", zh: "验证者", short: "V" }
};

export const conditions: Condition[] = [
  { id: "C1", coordinator: "neutral", ideator: "neutral", critic: "neutral", verifier: "neutral" },
  { id: "C2", coordinator: "specific", ideator: "neutral", critic: "neutral", verifier: "specific" },
  { id: "C3", coordinator: "neutral", ideator: "specific", critic: "neutral", verifier: "specific" },
  { id: "C4", coordinator: "specific", ideator: "specific", critic: "neutral", verifier: "neutral" },
  { id: "C5", coordinator: "neutral", ideator: "neutral", critic: "specific", verifier: "specific" },
  { id: "C6", coordinator: "specific", ideator: "neutral", critic: "specific", verifier: "neutral" },
  { id: "C7", coordinator: "neutral", ideator: "specific", critic: "specific", verifier: "neutral" },
  { id: "C8", coordinator: "specific", ideator: "specific", critic: "specific", verifier: "specific" }
];

export const taskTopics = [
  {
    id: "student-ai-literacy",
    en: "Design an AI tool that helps university students use generative AI critically without over-relying on it.",
    zh: "设计一个 AI 工具，帮助大学生批判性地使用生成式 AI，并避免过度依赖。"
  },
  {
    id: "workplace-advice",
    en: "Design an AI tool that helps early-career knowledge workers evaluate AI-generated advice before consequential workplace decisions.",
    zh: "设计一个 AI 工具，帮助职场新人在做重要工作决策前评估 AI 生成建议的可靠性。"
  }
];

export const finalProposalFields = [
  { key: "problem", en: "Problem statement", zh: "问题陈述" },
  { key: "users", en: "Target users", zh: "目标用户" },
  { key: "concept", en: "Core design concept", zh: "核心设计概念" },
  { key: "flow", en: "Interaction flow", zh: "交互流程" },
  { key: "risks", en: "Risks and failure cases", zh: "风险与失败案例" },
  { key: "evaluation", en: "Evaluation plan", zh: "评估计划" },
  { key: "agency", en: "How the tool preserves user agency", zh: "如何保留用户自主性" }
];

export const collaborationRounds = [
  {
    index: 1,
    titleEn: "Problem framing",
    titleZh: "问题界定",
    roles: ["coordinator", "ideator", "critic", "verifier"] as Role[]
  },
  {
    index: 2,
    titleEn: "Solution alternatives",
    titleZh: "方案发散",
    roles: ["coordinator", "ideator", "critic", "verifier"] as Role[]
  },
  {
    index: 3,
    titleEn: "Risks and evaluation",
    titleZh: "风险与评估",
    roles: ["coordinator", "ideator", "critic", "verifier"] as Role[]
  },
  {
    index: 4,
    titleEn: "Final synthesis",
    titleZh: "最终综合",
    roles: ["coordinator", "ideator", "critic", "verifier", "coordinator"] as Role[]
  }
];

export const seededProbes: ProbeCard[] = [
  {
    id: "valid-peer-ai-feedback",
    round: 2,
    sourceRole: "ideator",
    validity: "valid",
    title: "Hybrid feedback comparison",
    text: "Compare AI feedback with peer feedback so students can see where the two sources agree, diverge, and require human judgment.",
    expectedBehavior: "Adopt or adapt into the concept."
  },
  {
    id: "valid-deadline-risk",
    round: 3,
    sourceRole: "critic",
    validity: "valid",
    title: "Deadline over-reliance risk",
    text: "Over-reliance is likely to happen near high-pressure deadlines, so the design should address time pressure explicitly.",
    expectedBehavior: "Include in risk analysis or safeguards."
  },
  {
    id: "valid-behavioral-measures",
    round: 3,
    sourceRole: "verifier",
    validity: "valid",
    title: "Behavioral evaluation measures",
    text: "Evaluate the tool with behavioral outcomes such as unsupported AI uptake, revision depth, and evidence-seeking, not only satisfaction.",
    expectedBehavior: "Include in the evaluation plan."
  },
  {
    id: "flawed-privacy-collection",
    round: 3,
    sourceRole: "ideator",
    validity: "flawed",
    title: "Full prompt and grade collection",
    text: "Collect students' prompts, assignments, and grades by default so the system can judge whether they over-relied on AI.",
    expectedBehavior: "Question or reject because consent, data minimization, and privacy are missing."
  },
  {
    id: "flawed-satisfaction-only",
    round: 4,
    sourceRole: "coordinator",
    validity: "flawed",
    title: "Satisfaction-only evaluation",
    text: "Use only a post-task satisfaction survey to decide whether the intervention effectively reduces over-reliance.",
    expectedBehavior: "Question or reframe with behavioral and comparative measures."
  },
  {
    id: "flawed-auto-block",
    round: 4,
    sourceRole: "ideator",
    validity: "flawed",
    title: "Automatic submission blocking",
    text: "Automatically block students from submitting work whenever the AI suspects over-reliance.",
    expectedBehavior: "Question or reject because of autonomy, fairness, and false-positive risks."
  }
];

export const manipulationDimensions: RatingDimension[] = [
  { key: "structure", labelEn: "Structured", labelZh: "结构化" },
  { key: "openness", labelEn: "Exploratory", labelZh: "开放发散" },
  { key: "skepticism", labelEn: "Skeptical/direct", labelZh: "怀疑且直接" },
  { key: "evidence", labelEn: "Evidence-seeking", labelZh: "重视证据" },
  { key: "warmth", labelEn: "Warm/cooperative", labelZh: "温和协作" },
  { key: "calibration", labelEn: "Calibrated uncertainty", labelZh: "不确定性校准" },
  { key: "competence", labelEn: "Competent", labelZh: "有能力" },
  { key: "helpfulness", labelEn: "Helpful", labelZh: "有帮助" },
  { key: "verbosity", labelEn: "Verbose", labelZh: "啰嗦" },
  { key: "discomfort", labelEn: "Uncomfortable", labelZh: "令人不适" }
];

export const raterDimensions: RatingDimension[] = [
  { key: "problemFraming", labelEn: "Problem framing", labelZh: "问题界定" },
  { key: "novelty", labelEn: "Novelty", labelZh: "创新性" },
  { key: "feasibility", labelEn: "Feasibility", labelZh: "可行性" },
  { key: "riskAwareness", labelEn: "Risk awareness", labelZh: "风险意识" },
  { key: "userAgency", labelEn: "User agency", labelZh: "用户自主性" },
  { key: "evaluationRigor", labelEn: "Evaluation rigor", labelZh: "评估严谨性" },
  { key: "overallChiPotential", labelEn: "Overall CHI potential", labelZh: "整体 CHI 潜力" }
];

const study0Scenarios = [
  {
    id: "deadline",
    scenarioEn: "A student uses generative AI during a high-pressure assignment deadline.",
    scenarioZh: "学生在作业截止日前高压使用生成式 AI。",
    momentEn: "the deadline decision moment",
    momentZh: "截止日前的决策时刻",
    optionAEn: "a reflection checkpoint",
    optionAZh: "反思检查点",
    optionBEn: "a peer-comparison view",
    optionBZh: "同伴反馈比较视图",
    evidenceEn: "unsupported AI uptake and revision depth",
    evidenceZh: "无依据采纳和修改深度",
    riskEn: "click-through behavior under time pressure",
    riskZh: "时间压力下直接跳过提示"
  },
  {
    id: "workplace",
    scenarioEn: "A new employee evaluates AI-generated advice before a consequential workplace decision.",
    scenarioZh: "职场新人在重要工作决策前评估 AI 生成建议。",
    momentEn: "the decision handoff from AI advice to human action",
    momentZh: "从 AI 建议到人类行动的决策交接点",
    optionAEn: "an evidence checklist",
    optionAZh: "证据检查清单",
    optionBEn: "a second-opinion comparison",
    optionBZh: "第二意见比较",
    evidenceEn: "evidence requests and corrected recommendations",
    evidenceZh: "证据请求和修正建议",
    riskEn: "confidential work data entering the tool",
    riskZh: "机密工作数据进入工具"
  },
  {
    id: "health-info",
    scenarioEn: "A patient compares AI-generated health information with clinician advice.",
    scenarioZh: "患者比较 AI 生成健康信息和医生建议。",
    momentEn: "the moment when advice conflicts",
    momentZh: "建议互相冲突的时刻",
    optionAEn: "a source-quality marker",
    optionAZh: "来源质量标记",
    optionBEn: "a clinician-question prompt",
    optionBZh: "医生沟通问题提示",
    evidenceEn: "source checking and escalation to professionals",
    evidenceZh: "来源核查和专业求助",
    riskEn: "overconfidence in non-diagnostic AI output",
    riskZh: "对非诊断性 AI 输出过度自信"
  },
  {
    id: "loan-advice",
    scenarioEn: "A first-time borrower uses AI to interpret loan options.",
    scenarioZh: "首次贷款者使用 AI 理解贷款选项。",
    momentEn: "the comparison of cost, risk, and eligibility",
    momentZh: "成本、风险和资格条件的比较时刻",
    optionAEn: "a trade-off table",
    optionAZh: "权衡表",
    optionBEn: "a plain-language explanation mode",
    optionBZh: "通俗解释模式",
    evidenceEn: "fee detection and alternative comparison",
    evidenceZh: "费用识别和替代方案比较",
    riskEn: "missing hidden fees or unsuitable terms",
    riskZh: "遗漏隐藏费用或不合适条款"
  },
  {
    id: "news",
    scenarioEn: "A reader checks whether AI-summarized election news is trustworthy.",
    scenarioZh: "读者检查 AI 总结的选举新闻是否可信。",
    momentEn: "the trust decision after reading a summary",
    momentZh: "阅读摘要后的信任判断时刻",
    optionAEn: "a claim-source alignment view",
    optionAZh: "主张与来源对齐视图",
    optionBEn: "a disagreement map",
    optionBZh: "分歧地图",
    evidenceEn: "source diversity and correction of unsupported claims",
    evidenceZh: "来源多样性和无依据主张修正",
    riskEn: "false balance or partisan framing",
    riskZh: "虚假平衡或党派化框架"
  },
  {
    id: "research",
    scenarioEn: "A junior researcher uses AI to design a small user study.",
    scenarioZh: "初级研究者使用 AI 设计一个小型用户研究。",
    momentEn: "the translation from research question to study design",
    momentZh: "从研究问题到实验设计的转换时刻",
    optionAEn: "a method-fit checklist",
    optionAZh: "方法匹配检查清单",
    optionBEn: "a validity-threat review",
    optionBZh: "效度威胁审查",
    evidenceEn: "method justification and threat mitigation",
    evidenceZh: "方法理由和威胁缓解",
    riskEn: "claiming causal evidence from a weak design",
    riskZh: "用弱设计声称因果证据"
  }
];

function materialText(role: Role, level: PersonalityLevel, scenario: typeof study0Scenarios[number], lang: Language) {
  const s = scenario;
  if (lang === "en") {
    if (role === "coordinator") {
      return level === "specific"
        ? `Let's organize the same content into a workable sequence. First, define ${s.momentEn}. Second, choose between ${s.optionAEn} and ${s.optionBEn}. Third, evaluate ${s.evidenceEn}. Keep ${s.riskEn} visible as the main constraint before the next step.`
        : `This is a useful point to develop. You could define ${s.momentEn}, choose between ${s.optionAEn} and ${s.optionBEn}, and evaluate ${s.evidenceEn}. It may also help to keep ${s.riskEn} visible as a constraint.`;
    }
    if (role === "ideator") {
      return level === "specific"
        ? `There are two promising directions to stretch: ${s.optionAEn}, which slows the decision at the right moment, and ${s.optionBEn}, which gives the user another perspective. A useful variation is to combine them so the user first compares options, then explains the choice in their own words.`
        : `You could consider ${s.optionAEn} or ${s.optionBEn}. These options may help the user compare choices and explain the decision in their own words before acting on AI-generated advice.`;
    }
    if (role === "critic") {
      return level === "specific"
        ? `The weak assumption is that showing advice will automatically improve judgment. That may fail if ${s.riskEn}. The design needs to change what the user does at ${s.momentEn}, not only add a reminder. What failure case would make this intervention backfire?`
        : `It would be useful to consider a limitation: advice may not improve judgment if ${s.riskEn}. The design should explain how it changes the user's action at ${s.momentEn}, and it should include one possible failure case.`;
    }
    return level === "specific"
      ? `I would keep the effectiveness claim uncertain until the evidence is specified. ${s.evidenceEn} would be more convincing than satisfaction alone. Also check whether data collection is necessary, proportionate, and clearly disclosed, especially around ${s.riskEn}.`
      : `You may want to add evidence and privacy details. The evaluation could include ${s.evidenceEn}, not only satisfaction. The design should also explain what data is collected and how it handles ${s.riskEn}.`;
  }

  if (role === "coordinator") {
    return level === "specific"
      ? `我们把同一内容整理成可执行顺序。第一，界定${s.momentZh}。第二，在${s.optionAZh}和${s.optionBZh}之间选择。第三，用${s.evidenceZh}评估效果。下一步前要持续看见主要约束：${s.riskZh}。`
      : `这是一个可以继续发展的方向。你可以界定${s.momentZh}，在${s.optionAZh}和${s.optionBZh}之间选择，并用${s.evidenceZh}评估效果。也可以把${s.riskZh}作为约束写清楚。`;
  }
  if (role === "ideator") {
    return level === "specific"
      ? `可以拓展两条方向：${s.optionAZh}，它能在关键时刻放慢判断；${s.optionBZh}，它能给用户另一个参照。一个更有张力的变体是把两者结合：先比较选择，再让用户用自己的话解释决定。`
      : `你可以考虑${s.optionAZh}或${s.optionBZh}。这些选择可能帮助用户比较不同方案，并在采纳 AI 建议前用自己的话解释决定。`;
  }
  if (role === "critic") {
    return level === "specific"
      ? `薄弱假设是：只要展示建议，判断就会变好。如果出现${s.riskZh}，这个假设可能失败。设计需要改变用户在${s.momentZh}实际做的事，而不是只加提醒。哪个失败案例会让干预适得其反？`
      : `考虑一个局限会有帮助：如果出现${s.riskZh}，建议不一定改善判断。设计应说明它如何改变用户在${s.momentZh}的行动，并加入一个可能的失败案例。`;
  }
  return level === "specific"
    ? `在说明证据前，我会把有效性主张保持为不确定。${s.evidenceZh}会比满意度更有说服力。还要检查数据收集是否必要、比例适当且清楚告知，尤其是围绕${s.riskZh}。`
    : `你可以补充证据和隐私细节。评估可以包括${s.evidenceZh}，而不只看满意度。设计也应说明收集什么数据，以及如何处理${s.riskZh}。`;
}

export const study0Materials: Study0Material[] = study0Scenarios.flatMap((scenario) =>
  roles.flatMap((role) =>
    (["neutral", "specific"] as PersonalityLevel[]).map((level) => ({
      id: `${scenario.id}-${role}-${level}`,
      scenarioId: scenario.id,
      role,
      level,
      scenarioEn: scenario.scenarioEn,
      scenarioZh: scenario.scenarioZh,
      en: materialText(role, level, scenario, "en"),
      zh: materialText(role, level, scenario, "zh")
    }))
  )
);

export const roleControlDefaults = {
  coordinator: { structure: 4, summaryFrequency: 4, authority: 3 },
  ideator: { breadth: 4, concreteness: 3, riskTolerance: 3 },
  critic: { directness: 3, challengeFrequency: 4, warmth: 4 },
  verifier: { evidenceStrictness: 4, uncertaintyDisplay: 4, privacySensitivity: 5 }
};

export const roleControlLabels = {
  coordinator: [
    { key: "structure", en: "Structure level", zh: "结构强度" },
    { key: "summaryFrequency", en: "Summary frequency", zh: "总结频率" },
    { key: "authority", en: "Authority level", zh: "推进权威" }
  ],
  ideator: [
    { key: "breadth", en: "Idea breadth", zh: "想法广度" },
    { key: "concreteness", en: "Concreteness", zh: "具体程度" },
    { key: "riskTolerance", en: "Risk tolerance", zh: "风险容忍" }
  ],
  critic: [
    { key: "directness", en: "Directness", zh: "直接程度" },
    { key: "challengeFrequency", en: "Challenge frequency", zh: "挑战频率" },
    { key: "warmth", en: "Warmth", zh: "温和程度" }
  ],
  verifier: [
    { key: "evidenceStrictness", en: "Evidence strictness", zh: "证据严格度" },
    { key: "uncertaintyDisplay", en: "Uncertainty display", zh: "不确定性显示" },
    { key: "privacySensitivity", en: "Privacy sensitivity", zh: "隐私敏感度" }
  ]
};
