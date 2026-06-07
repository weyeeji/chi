import type { AgentMessage, Arm, Language, ProbeCard, PublicProbeCard, Role } from "../src/shared/experiment.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  collaborationRounds,
  finalProposalFields,
  probesForTopic,
  roleLabels,
  taskTopics
} from "../src/shared/experiment.js";
import { appendEvent, blockArm, getParticipant, newId } from "./storage.js";

type PersonalityConfig = {
  globalRules: string[];
  roles: Record<Role, {
    roleInstruction: string[];
    neutralPersonality: string[];
    specificPersonality: string[];
    mockNeutral: Record<Language, string>;
    mockSpecific: Record<Language, string>;
  }>;
};

function readPersonalityConfig(): PersonalityConfig {
  const candidates = [
    new URL("./agent-personalities.json", import.meta.url),
    new URL("../../server/agent-personalities.json", import.meta.url)
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(fileURLToPath(candidate), "utf8")) as PersonalityConfig;
    } catch {
      // Try the next runtime location. Source and compiled server files live at different depths.
    }
  }
  throw new Error("Could not find agent-personalities.json");
}

const personalityConfig = readPersonalityConfig();

interface AgentRequest {
  participantId: string;
  lang: Language;
  blockIndex: number;
  roundIndex?: number;
  targetRole?: Role | "all";
  userMessage?: string;
  messages: AgentMessage[];
  initialProposal?: Record<string, string>;
}

interface AgentResponse {
  messages: AgentMessage[];
  probes: PublicProbeCard[];
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function topicForBlock(participant: Awaited<ReturnType<typeof getParticipant>>, blockIndex: number) {
  const topicId = participant?.blocks.find((block) => block.index === blockIndex)?.topicId;
  return taskTopics.find((item) => item.id === topicId) ?? taskTopics[0];
}

function formatProposal(proposal: Record<string, string> | undefined, lang: Language) {
  if (!proposal) return lang === "zh" ? "尚未提供。" : "Not provided yet.";
  return finalProposalFields
    .map((field) => {
      const label = lang === "zh" ? field.zh : field.en;
      return `${label}: ${proposal[field.key] || ""}`;
    })
    .join("\n");
}

function recentConversation(messages: AgentMessage[]) {
  return messages
    .slice(-18)
    .map((message) => `${message.role.toUpperCase()}${message.targetRole ? ` -> ${message.targetRole}` : ""}: ${message.content}`)
    .join("\n");
}

function buildSystemPrompt(input: {
  role: Role;
  lang: Language;
  arm: Arm;
  topic: string;
  roundIndex?: number;
  direct: boolean;
  userMessage?: string;
  initialProposal?: Record<string, string>;
  messages: AgentMessage[];
  probesForRole?: ProbeCard[];
}) {
  const personality = input.arm === "specific"
    ? personalityConfig.roles[input.role].specificPersonality.join("\n")
    : personalityConfig.roles[input.role].neutralPersonality.join("\n");
  const languageRule = input.lang === "zh"
    ? "Respond in Simplified Chinese. Keep role labels and measurement terms readable when useful."
    : "Respond in English.";
  const roundInstruction = input.direct
    ? "This is a user-directed turn. Answer the user's request from your role's perspective."
    : `This is system-orchestrated round ${input.roundIndex}. Contribute only what your role should contribute in this round.`;
  const probeInstruction = input.probesForRole?.length
    ? [
      "Seeded suggestion requirement for experimental control:",
      ...input.probesForRole.map((probe) => `- Include this exact suggestion text once, as a suggestion from your role: "${probe.text}"`),
      "Do not reveal whether the suggestion is valid or flawed. Do not mention that it is seeded."
    ].join("\n")
    : "";

  return [
    ...personalityConfig.globalRules,
    languageRule,
    "",
    `Visible role: ${roleLabels[input.role].en}.`,
    personalityConfig.roles[input.role].roleInstruction.join("\n"),
    personality,
    "",
    `Task: ${input.topic}`,
    `Initial proposal:\n${formatProposal(input.initialProposal, input.lang)}`,
    `Recent conversation:\n${recentConversation(input.messages) || "No prior conversation."}`,
    probeInstruction,
    roundInstruction,
    input.userMessage ? `User request: ${input.userMessage}` : ""
  ].filter(Boolean).join("\n");
}

async function callModel(systemPrompt: string, role: Role, lang: Language, arm: Arm): Promise<string> {
  if (process.env.AGENT_MODE === "mock" || !process.env.AGENT_API_KEY) {
    return mockAgentResponse(role, lang, arm);
  }
  const baseUrl = (process.env.AGENT_API_BASE_URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AGENT_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.AGENT_MODEL,
      temperature: Number(process.env.AGENT_TEMPERATURE ?? 0.7),
      max_tokens: Number(process.env.AGENT_MAX_TOKENS ?? 360),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Provide your next contribution now." }
      ]
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API failed: ${response.status} ${text.slice(0, 240)}`);
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || mockAgentResponse(role, lang, arm);
}

// Arm-aware fallback: a mock must match the block's arm so a failed API call in the
// neutral arm never injects specific-voiced text (which would silently contaminate the
// within-subjects contrast). Fallbacks are logged with the arm so they can be audited.
function mockAgentResponse(role: Role, lang: Language, arm: Arm) {
  const roleConfig = personalityConfig.roles[role];
  return arm === "specific" ? roleConfig.mockSpecific[lang] : roleConfig.mockNeutral[lang];
}

// Verify that a seeded probe's text was actually emitted by the agent. The
// calibrated-reliance measure assumes the probe reaches the participant verbatim; LLMs
// may paraphrase, soften, or drop it, which would confound the analysis.
function normalizeForMatch(text: string) {
  return text.toLowerCase().replace(/[\s\p{P}]+/gu, " ").trim();
}

function tokenOverlapRatio(probeText: string, content: string) {
  const probeTokens = normalizeForMatch(probeText).split(" ").filter((token) => token.length > 3);
  if (!probeTokens.length) return 1;
  const haystack = new Set(normalizeForMatch(content).split(" "));
  const hits = probeTokens.filter((token) => haystack.has(token)).length;
  return hits / probeTokens.length;
}

function verifyProbeDelivery(probe: ProbeCard, content: string) {
  const normalizedProbe = normalizeForMatch(probe.text);
  const normalizedContent = normalizeForMatch(content);
  const verbatim = normalizedContent.includes(normalizedProbe);
  const overlap = tokenOverlapRatio(probe.text, content);
  const delivered = verbatim || overlap >= 0.7;
  return { probeId: probe.id, validity: probe.validity, delivered, verbatim, overlap: Number(overlap.toFixed(2)) };
}

export async function generateRound(input: AgentRequest): Promise<AgentResponse> {
  const participant = await getParticipant(input.participantId);
  if (!participant) throw new Error("Participant not found");
  const arm = blockArm(participant, input.blockIndex);
  const round = collaborationRounds.find((item) => item.index === input.roundIndex);
  if (!round) throw new Error("Invalid round");
  const topicConfig = topicForBlock(participant, input.blockIndex);
  const topic = input.lang === "zh" ? topicConfig.zh : topicConfig.en;
  const generated: AgentMessage[] = [];
  const roundProbes = probesForTopic(topicConfig.id).filter((probe) => probe.round === round.index);
  const embeddedProbeIds = new Set<string>();

  for (const role of round.roles) {
    const probesForRole = roundProbes.filter((probe) => probe.sourceRole === role && !embeddedProbeIds.has(probe.id));
    probesForRole.forEach((probe) => embeddedProbeIds.add(probe.id));
    const prompt = buildSystemPrompt({
      role,
      lang: input.lang,
      arm,
      topic,
      roundIndex: round.index,
      direct: false,
      initialProposal: input.initialProposal,
      messages: [...input.messages, ...generated],
      probesForRole
    });
    const started = Date.now();
    let content: string;
    let error: string | undefined;
    let usedFallback = false;
    try {
      content = await callModel(prompt, role, input.lang, arm);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      content = mockAgentResponse(role, input.lang, arm);
      usedFallback = true;
    }
    const probeDelivery = probesForRole.map((probe) => verifyProbeDelivery(probe, content));
    const message: AgentMessage = {
      id: newId("msg"),
      role,
      content,
      createdAt: new Date().toISOString(),
      round: round.index,
      block: input.blockIndex,
      latencyMs: Date.now() - started,
      tokenEstimate: estimateTokens(content)
    };
    generated.push(message);
    await appendEvent({
      id: newId("event"),
      participantId: input.participantId,
      type: "agent_message",
      createdAt: message.createdAt,
      payload: {
        message,
        prompt,
        blockIndex: input.blockIndex,
        arm,
        topicId: topicConfig.id,
        usedFallback,
        wordCount: content.trim().split(/\s+/).filter(Boolean).length,
        probeDelivery,
        error
      }
    });
  }

  const probes = roundProbes
    .map(({ validity: _validity, expectedBehavior: _expectedBehavior, ...probe }) => probe);
  if (probes.length) {
    await appendEvent({
      id: newId("event"),
      participantId: input.participantId,
      type: "seeded_probes_revealed",
      createdAt: new Date().toISOString(),
      payload: { blockIndex: input.blockIndex, roundIndex: round.index, probeIds: probes.map((probe) => probe.id) }
    });
  }
  return { messages: generated, probes };
}

export async function generateDirectTurn(input: AgentRequest): Promise<AgentResponse> {
  const participant = await getParticipant(input.participantId);
  if (!participant) throw new Error("Participant not found");
  const targetRoles = input.targetRole && input.targetRole !== "all"
    ? [input.targetRole]
    : (["coordinator", "ideator", "critic", "verifier"] as Role[]);
  const arm = blockArm(participant, input.blockIndex);
  const topicConfig = topicForBlock(participant, input.blockIndex);
  const topic = input.lang === "zh" ? topicConfig.zh : topicConfig.en;
  const generated: AgentMessage[] = [];

  if (input.userMessage?.trim()) {
    await appendEvent({
      id: newId("event"),
      participantId: input.participantId,
      type: "user_message",
      createdAt: new Date().toISOString(),
      payload: { content: input.userMessage, targetRole: input.targetRole ?? "all", blockIndex: input.blockIndex }
    });
  }

  for (const role of targetRoles) {
    const prompt = buildSystemPrompt({
      role,
      lang: input.lang,
      arm,
      topic,
      direct: true,
      userMessage: input.userMessage,
      initialProposal: input.initialProposal,
      messages: [...input.messages, ...generated]
    });
    const started = Date.now();
    let content: string;
    let error: string | undefined;
    let usedFallback = false;
    try {
      content = await callModel(prompt, role, input.lang, arm);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      content = mockAgentResponse(role, input.lang, arm);
      usedFallback = true;
    }
    const message: AgentMessage = {
      id: newId("msg"),
      role,
      content,
      createdAt: new Date().toISOString(),
      block: input.blockIndex,
      targetRole: input.targetRole ?? "all",
      latencyMs: Date.now() - started,
      tokenEstimate: estimateTokens(content)
    };
    generated.push(message);
    await appendEvent({
      id: newId("event"),
      participantId: input.participantId,
      type: "agent_message",
      createdAt: message.createdAt,
      payload: {
        message,
        prompt,
        blockIndex: input.blockIndex,
        arm,
        topicId: topicConfig.id,
        usedFallback,
        wordCount: content.trim().split(/\s+/).filter(Boolean).length,
        direct: true,
        error
      }
    });
  }
  return { messages: generated, probes: [] };
}
