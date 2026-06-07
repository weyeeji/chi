// Shared experiment contract for the within-subjects A/B study of agent-team personality.
//
// Design summary (see Proposal.md):
// Each participant completes TWO collaboration blocks with a four-agent team. In one
// block every agent uses a NEUTRAL personality expression; in the other block every
// agent uses a ROLE-SPECIFIC personality expression. Arm order and arm-to-topic mapping
// are counterbalanced across participants. Each participant is their own control, which
// is what makes the study analyzable and publishable with a small sample (target N<=20).

export type Language = "en" | "zh";
export type Role = "coordinator" | "ideator" | "critic" | "verifier";
export type Arm = "neutral" | "specific";
export type ProbeValidity = "valid" | "flawed";
export type ProbeDecision = "accepted" | "rejected" | "questioned" | "reframed";

export interface BlockPlan {
  index: number; // 1 or 2, the order in which the participant sees the block
  arm: Arm;
  topicId: string;
}

export interface Sequence {
  id: string;
  blocks: BlockPlan[];
}

export interface AgentMessage {
  id: string;
  role: Role | "user" | "system";
  content: string;
  createdAt: string;
  round?: number;
  block?: number;
  targetRole?: Role | "all";
  latencyMs?: number;
  tokenEstimate?: number;
}

export interface ProbeCard {
  id: string;
  topicId: string;
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

export const roles: Role[] = ["coordinator", "ideator", "critic", "verifier"];

export const roleLabels: Record<Role, { en: string; zh: string; short: string }> = {
  coordinator: { en: "Coordinator", zh: "组织者", short: "C" },
  ideator: { en: "Ideator", zh: "发想者", short: "I" },
  critic: { en: "Critic", zh: "批评者", short: "R" },
  verifier: { en: "Verifier", zh: "验证者", short: "V" }
};

export const armLabels: Record<Arm, { en: string; zh: string }> = {
  neutral: { en: "Neutral-personality team", zh: "中性人格团队" },
  specific: { en: "Role-specific-personality team", zh: "角色特定人格团队" }
};

// Two matched design topics. Both are open design briefs that require ideation,
// critique, and verification, so all four roles have room to act in both blocks.
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

export const topicA = taskTopics[0].id;
export const topicB = taskTopics[1].id;

// Counterbalance: 2 arm orders x 2 arm-to-topic mappings = 4 sequences. Assigned
// round-robin by participant intake order so the sample stays balanced at small N.
export const sequences: Sequence[] = [
  {
    id: "S1",
    blocks: [
      { index: 1, arm: "neutral", topicId: topicA },
      { index: 2, arm: "specific", topicId: topicB }
    ]
  },
  {
    id: "S2",
    blocks: [
      { index: 1, arm: "specific", topicId: topicA },
      { index: 2, arm: "neutral", topicId: topicB }
    ]
  },
  {
    id: "S3",
    blocks: [
      { index: 1, arm: "neutral", topicId: topicB },
      { index: 2, arm: "specific", topicId: topicA }
    ]
  },
  {
    id: "S4",
    blocks: [
      { index: 1, arm: "specific", topicId: topicB },
      { index: 2, arm: "neutral", topicId: topicA }
    ]
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

// Three orchestrated rounds per block. Fewer rounds than a single-block design so the
// two-block within-subjects session stays within ~55 minutes.
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
  }
];

// Each topic carries a MATCHED set of four seeded suggestions: two valid, two flawed.
// The two topics share the same structure (same source roles, same validity, same round
// placement) so calibrated-reliance scores are comparable across the two blocks.
//
// Flawed-probe sourcing principle: a flaw is never voiced by the role responsible for
// catching it, so probe visibility does not vary with the personality manipulation.
// The privacy flaw and the weak-evaluation flaw are therefore sourced from the Ideator
// and the Coordinator, never the Verifier or the Critic.
export const seededProbes: ProbeCard[] = [
  // ---- Topic A: student AI literacy ----
  {
    id: "A-valid-peer-ai-feedback",
    topicId: topicA,
    round: 2,
    sourceRole: "ideator",
    validity: "valid",
    title: "Hybrid feedback comparison",
    text: "Compare AI feedback with peer feedback so students can see where the two sources agree, diverge, and require human judgment.",
    expectedBehavior: "Adopt or adapt into the concept."
  },
  {
    id: "A-flawed-privacy-collection",
    topicId: topicA,
    round: 2,
    sourceRole: "ideator",
    validity: "flawed",
    title: "Default prompt and grade collection",
    text: "Collect students' prompts, assignments, and grades by default so the system can judge whether they over-relied on AI.",
    expectedBehavior: "Question or reject because consent, data minimization, and privacy are missing."
  },
  {
    id: "A-valid-behavioral-measures",
    topicId: topicA,
    round: 3,
    sourceRole: "verifier",
    validity: "valid",
    title: "Behavioral evaluation measures",
    text: "Evaluate the tool with behavioral outcomes such as unsupported AI uptake, revision depth, and evidence-seeking, not only satisfaction.",
    expectedBehavior: "Include in the evaluation plan."
  },
  {
    id: "A-flawed-satisfaction-only",
    topicId: topicA,
    round: 3,
    sourceRole: "coordinator",
    validity: "flawed",
    title: "Satisfaction-only evaluation",
    text: "Use only a post-task satisfaction survey to decide whether the tool reduces over-reliance.",
    expectedBehavior: "Question or reframe with behavioral and comparative measures."
  },
  // ---- Topic B: workplace AI advice ----
  {
    id: "B-valid-second-opinion",
    topicId: topicB,
    round: 2,
    sourceRole: "ideator",
    validity: "valid",
    title: "Second-opinion comparison",
    text: "Let workers compare the AI's recommendation with a second independent source so they can see where the two agree and where human judgment is needed.",
    expectedBehavior: "Adopt or adapt into the concept."
  },
  {
    id: "B-flawed-keylogging-collection",
    topicId: topicB,
    round: 2,
    sourceRole: "ideator",
    validity: "flawed",
    title: "Default capture of work documents",
    text: "Capture the worker's emails, documents, and decisions by default so the system can score how much they relied on the AI.",
    expectedBehavior: "Question or reject because consent, data minimization, and confidentiality are missing."
  },
  {
    id: "B-valid-decision-tracking",
    topicId: topicB,
    round: 3,
    sourceRole: "verifier",
    validity: "valid",
    title: "Decision-quality evaluation",
    text: "Evaluate the tool with decision-quality outcomes such as corrected recommendations and evidence requests, not only how confident users feel.",
    expectedBehavior: "Include in the evaluation plan."
  },
  {
    id: "B-flawed-confidence-only",
    topicId: topicB,
    round: 3,
    sourceRole: "coordinator",
    validity: "flawed",
    title: "Confidence-only evaluation",
    text: "Use only a self-reported confidence rating to decide whether the tool improves workplace decisions.",
    expectedBehavior: "Question or reframe with decision-quality and comparative measures."
  }
];

export function probesForTopic(topicId: string): ProbeCard[] {
  return seededProbes.filter((probe) => probe.topicId === topicId);
}

// Blind-rating dimensions for the proposal quality rubric.
export const raterDimensions: RatingDimension[] = [
  { key: "problemFraming", labelEn: "Problem framing", labelZh: "问题界定" },
  { key: "novelty", labelEn: "Novelty", labelZh: "创新性" },
  { key: "feasibility", labelEn: "Feasibility", labelZh: "可行性" },
  { key: "riskAwareness", labelEn: "Risk awareness", labelZh: "风险意识" },
  { key: "userAgency", labelEn: "User agency", labelZh: "用户自主性" },
  { key: "evaluationRigor", labelEn: "Evaluation rigor", labelZh: "评估严谨性" },
  { key: "overallChiPotential", labelEn: "Overall CHI potential", labelZh: "整体 CHI 潜力" }
];

// In-context perceived-personality items, asked after EACH block, used as a within-block
// manipulation check (does the specific arm read as more structured / exploratory /
// skeptical / calibrated than the neutral arm?).
export const perceivedPersonalityDimensions: RatingDimension[] = [
  { key: "coordinatorStructured", labelEn: "The Coordinator was structured and process-oriented", labelZh: "组织者结构化、善于推进流程" },
  { key: "ideatorExploratory", labelEn: "The Ideator was exploratory and broadened the design space", labelZh: "发想者开放、善于拓展方案" },
  { key: "criticSkeptical", labelEn: "The Critic was direct and challenged assumptions", labelZh: "批评者直接、会挑战假设" },
  { key: "verifierCalibrated", labelEn: "The Verifier was cautious and evidence/uncertainty-oriented", labelZh: "验证者谨慎、重视证据与不确定性" }
];
