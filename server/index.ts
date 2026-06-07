import "dotenv/config";
import express from "express";
import cors from "cors";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  finalProposalFields,
  raterDimensions,
  taskTopics
} from "../src/shared/experiment.js";
import { buildAnalytics } from "./analytics.js";
import { generateDirectTurn, generateRound } from "./agents.js";
import {
  appendEvent,
  createParticipant,
  ensureStorage,
  getExportPaths,
  getParticipant,
  listEvents,
  listParticipants,
  listRatings,
  newId,
  saveRating,
  type ParticipantRecord,
  updateParticipant
} from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function findProjectRoot(startDir: string) {
  const candidates = [
    path.resolve(startDir, ".."),
    path.resolve(startDir, "../..")
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, "package.json"))) ?? path.resolve(startDir, "..");
}
const rootDir = findProjectRoot(__dirname);

const app = express();
app.use(express.json({ limit: "4mb" }));
const configuredOrigins = process.env.CLIENT_ORIGIN?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (configuredOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  }
}));

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expected = process.env.ADMIN_TOKEN;
  const provided = req.header("x-admin-token") || req.query.adminToken;
  if (!expected) {
    if (process.env.ALLOW_UNPROTECTED_ADMIN === "true") return next();
    return res.status(503).json({
      error: "ADMIN_TOKEN is not configured. Set ADMIN_TOKEN, or set ALLOW_UNPROTECTED_ADMIN=true only for local demos."
    });
  }
  if (provided === expected) {
    return next();
  }
  return res.status(401).json({ error: "Admin token required" });
}

function badRequest(message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
}

// The arm (neutral/specific) is the only field a participant must never see, since it is
// the manipulation. Topics and sequence ids are not informative on their own.
function publicParticipant(participant: ParticipantRecord) {
  return {
    ...participant,
    blocks: participant.blocks.map(({ arm: _arm, ...block }) => block)
  };
}

const protectedParticipantKeys = new Set([
  "id",
  "sequenceId",
  "blocks",
  "createdAt",
  "updatedAt"
]);

function proposalQualityIssues(proposal: unknown, minChars: number) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return ["proposal must be an object"];
  }
  const record = proposal as Record<string, unknown>;
  const fieldText = (key: string) => {
    const value = record[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const missing = finalProposalFields.filter((field) => fieldText(field.key).length < 18);
  const totalChars = finalProposalFields
    .map((field) => fieldText(field.key).length)
    .reduce((sum, value) => sum + value, 0);
  const issues = missing.map((field) => `${field.key} is too short`);
  if (totalChars < minChars) issues.push(`proposal has ${totalChars} chars; expected at least ${minChars}`);
  return issues;
}

const MIN_INITIAL_CHARS = 280;
const MIN_FINAL_CHARS = 480;

function validateRatingRecord(record: unknown, expectedKeys: string[], label: string) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw badRequest(`${label} ratings must be an object`);
  }
  const ratings = record as Record<string, unknown>;
  const missing = expectedKeys.filter((key) => !Number.isInteger(ratings[key]) || Number(ratings[key]) < 1 || Number(ratings[key]) > 7);
  if (missing.length) {
    throw badRequest(`${label} ratings missing valid 1-7 scores for: ${missing.join(", ")}`);
  }
}

// PATCH body for a single block: persists the block's initial/final proposal or survey by
// merging into the participant's block array. arm and topicId are immutable.
const blockPatchSchema = z.object({
  blockIndex: z.number().int().min(1).max(2),
  initialProposal: z.record(z.string(), z.string()).optional(),
  finalProposal: z.record(z.string(), z.string()).optional(),
  blockSurvey: z.record(z.string(), z.unknown()).optional()
});

function applyBlockPatch(existing: ParticipantRecord, body: unknown): Partial<ParticipantRecord> {
  const patch = blockPatchSchema.parse(body);
  const block = existing.blocks.find((item) => item.index === patch.blockIndex);
  if (!block) throw badRequest(`Block ${patch.blockIndex} not found for this participant`);
  if (patch.initialProposal) {
    const issues = proposalQualityIssues(patch.initialProposal, MIN_INITIAL_CHARS);
    if (issues.length) throw badRequest(`Initial proposal failed quality gate: ${issues.join("; ")}`);
  }
  if (patch.finalProposal) {
    const issues = proposalQualityIssues(patch.finalProposal, MIN_FINAL_CHARS);
    if (issues.length) throw badRequest(`Final proposal failed quality gate: ${issues.join("; ")}`);
  }
  const blocks = existing.blocks.map((item) =>
    item.index === patch.blockIndex
      ? {
        ...item,
        ...(patch.initialProposal ? { initialProposal: patch.initialProposal } : {}),
        ...(patch.finalProposal ? { finalProposal: patch.finalProposal } : {}),
        ...(patch.blockSurvey ? { blockSurvey: patch.blockSurvey } : {})
      }
      : item
  );
  return { blocks };
}

function validateParticipantPatch(existing: ParticipantRecord, body: unknown): Partial<ParticipantRecord> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Participant patch must be an object");
  }
  const raw = body as Record<string, unknown>;
  // Block-scoped update.
  if ("blockIndex" in raw) {
    const blockPatch = applyBlockPatch(existing, raw);
    const status = typeof raw.status === "string" ? raw.status : undefined;
    return status ? { ...blockPatch, status } : blockPatch;
  }
  // Participant-scoped update (pre-survey, final survey, status, completion).
  const patch = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !protectedParticipantKeys.has(key))
  ) as Partial<ParticipantRecord>;
  const next = { ...existing, ...patch };
  if (patch.preSurvey || next.status === "pre_completed") {
    if (Number(next.preSurvey?.attentionCheck) !== 5) {
      throw badRequest("Attention check failed; expected preSurvey.attentionCheck to equal 5");
    }
  }
  if (next.status === "completed") {
    if (!next.finalSurvey) throw badRequest("Completion requires finalSurvey");
    for (const block of next.blocks) {
      const issues = proposalQualityIssues(block.finalProposal, MIN_FINAL_CHARS);
      if (issues.length) throw badRequest(`Completion requires a valid final proposal for block ${block.index}: ${issues.join("; ")}`);
    }
  }
  return patch;
}

const eventSchema = z.object({
  participantId: z.string().min(1),
  type: z.string().min(1).max(96).regex(/^[A-Za-z0-9_:-]+$/).default("client_event"),
  payload: z.record(z.string(), z.unknown()).default({})
});

const ratingInputSchema = z.object({
  itemId: z.string().min(1),
  raterId: z.preprocess((value) => String(value ?? "").trim() || "anonymous", z.string().min(1).max(80)),
  ratings: z.record(z.string(), z.number().int().min(1).max(7)),
  notes: z.string().max(4000).optional()
});

function blindItemId(participantId: string, blockIndex: number, stage: "initial" | "final") {
  const salt = process.env.BLIND_ITEM_SALT ?? "agent-team-personality-ab-v1";
  return createHash("sha256").update(`${salt}:${participantId}:${blockIndex}:${stage}`).digest("base64url").slice(0, 18);
}

// Build the anonymous blind-rating worklist. Each completed-enough block contributes an
// initial and a final item. Raters never see arm, topic-arm mapping, participant id, or
// whether the item is the initial or final draft.
function buildBlindRatingItems(participants: ParticipantRecord[], ratings: Awaited<ReturnType<typeof listRatings>>) {
  const raterSets = new Map<string, Set<string>>();
  for (const rating of ratings) {
    const set = raterSets.get(rating.itemId) ?? new Set<string>();
    set.add((rating.raterId || "anonymous").trim().toLowerCase());
    raterSets.set(rating.itemId, set);
  }
  return participants.flatMap((participant) =>
    participant.blocks.flatMap((block) => {
      if (
        !block.initialProposal || !block.finalProposal ||
        proposalQualityIssues(block.initialProposal, MIN_INITIAL_CHARS).length ||
        proposalQualityIssues(block.finalProposal, MIN_FINAL_CHARS).length
      ) {
        return [];
      }
      const topic = taskTopics.find((item) => item.id === block.topicId) ?? taskTopics[0];
      return (["initial", "final"] as const).map((stage) => {
        const itemId = blindItemId(participant.id, block.index, stage);
        const ratedCount = raterSets.get(itemId)?.size ?? 0;
        return {
          itemId,
          displayId: `item-${itemId.slice(0, 10)}`,
          participantId: participant.id,
          blockIndex: block.index,
          stage,
          topic: topic.en,
          topicZh: topic.zh,
          ratedCount,
          neededRatings: Math.max(0, 3 - ratedCount),
          proposal: stage === "initial" ? block.initialProposal : block.finalProposal
        };
      });
    })
  );
}

const participantSchema = z.object({
  lang: z.enum(["en", "zh"]).default("zh"),
  consent: z.record(z.string(), z.unknown()).optional(),
  recruitment: z.record(z.string(), z.unknown()).optional(),
  browserInfo: z.record(z.string(), z.unknown()).optional(),
  sequenceId: z.string().optional()
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: process.env.AGENT_MODEL,
    agentMode: process.env.AGENT_MODE,
    hasAgentKey: Boolean(process.env.AGENT_API_KEY)
  });
});

app.get("/api/admin/health", requireAdmin, (_req, res) => {
  res.json({
    ok: true,
    analyticsProtected: Boolean(process.env.ADMIN_TOKEN),
    model: process.env.AGENT_MODEL,
    agentMode: process.env.AGENT_MODE
  });
});

app.post("/api/participants", async (req, res, next) => {
  try {
    const input = participantSchema.parse(req.body);
    const participant = await createParticipant(input);
    res.json({ participant: publicParticipant(participant) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/participants/:id", async (req, res) => {
  const participant = await getParticipant(req.params.id);
  if (!participant) return res.status(404).json({ error: "Participant not found" });
  res.json({ participant: publicParticipant(participant) });
});

app.patch("/api/participants/:id", async (req, res, next) => {
  try {
    const existing = await getParticipant(req.params.id);
    if (!existing) return res.status(404).json({ error: "Participant not found" });
    const patch = validateParticipantPatch(existing, req.body);
    const participant = await updateParticipant(req.params.id, patch);
    if (!participant) return res.status(404).json({ error: "Participant not found" });
    await appendEvent({
      id: newId("event"),
      participantId: participant.id,
      type: "participant_updated",
      createdAt: new Date().toISOString(),
      payload: { keys: Object.keys(patch) }
    });
    res.json({ participant: publicParticipant(participant) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/events", async (req, res, next) => {
  try {
    const input = eventSchema.parse(req.body);
    const participant = await getParticipant(input.participantId);
    if (!participant) return res.status(404).json({ error: "Participant not found" });
    const event = await appendEvent({
      id: newId("event"),
      participantId: participant.id,
      type: input.type,
      createdAt: new Date().toISOString(),
      payload: input.payload
    });
    res.json({ event });
  } catch (error) {
    next(error);
  }
});

app.post("/api/agent/round", async (req, res, next) => {
  try {
    const result = await generateRound(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/agent/direct", async (req, res, next) => {
  try {
    const result = await generateDirectTurn(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/analytics", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await buildAnalytics());
  } catch (error) {
    next(error);
  }
});

app.get("/api/rater/items", requireAdmin, async (_req, res) => {
  const [participants, ratings] = await Promise.all([listParticipants(), listRatings()]);
  const items = buildBlindRatingItems(participants, ratings)
    .sort((a, b) => a.ratedCount - b.ratedCount || a.displayId.localeCompare(b.displayId))
    .map(({ participantId: _participantId, blockIndex: _blockIndex, stage: _stage, ...publicItem }) => publicItem);
  res.json({ items });
});

app.post("/api/rater/ratings", requireAdmin, async (req, res, next) => {
  try {
    const input = ratingInputSchema.parse(req.body);
    validateRatingRecord(input.ratings, raterDimensions.map((dimension) => dimension.key), "Blind rating");
    const [participants, ratings] = await Promise.all([listParticipants(), listRatings()]);
    const items = buildBlindRatingItems(participants, ratings);
    const item = items.find((candidate) => candidate.itemId === input.itemId);
    if (!item) return res.status(404).json({ error: "Blind rating item not found" });
    const normalizedRater = input.raterId.trim().toLowerCase();
    const duplicate = ratings.some((rating) =>
      rating.itemId === input.itemId && (rating.raterId || "anonymous").trim().toLowerCase() === normalizedRater
    );
    if (duplicate) return res.status(409).json({ error: "This rater has already rated this item" });
    const rating = await saveRating({
      itemId: item.itemId,
      participantId: item.participantId,
      blockIndex: item.blockIndex,
      stage: item.stage,
      raterId: input.raterId,
      ratings: input.ratings,
      notes: input.notes
    });
    res.json({
      rating: { id: rating.id, itemId: rating.itemId, raterId: rating.raterId, createdAt: rating.createdAt }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/export/participants", requireAdmin, async (_req, res) => {
  const participants = await listParticipants();
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(participants, null, 2));
});

app.get("/api/export/events", requireAdmin, (_req, res) => {
  res.download(getExportPaths().eventLogPath, "events.jsonl");
});

app.get("/api/export/analytics", requireAdmin, async (_req, res, next) => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(await buildAnalytics(), null, 2));
  } catch (error) {
    next(error);
  }
});

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCsv(res: express.Response, filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

app.get("/api/export/participants.csv", requireAdmin, async (_req, res) => {
  const participants = await listParticipants();
  // One row per (participant, block) so each arm is a separate analyzable line.
  sendCsv(res, "participants.csv", participants.flatMap((participant) =>
    participant.blocks.map((block) => ({
      participantId: participant.id,
      lang: participant.lang,
      sequenceId: participant.sequenceId,
      blockIndex: block.index,
      arm: block.arm,
      topicId: block.topicId,
      status: participant.status,
      createdAt: participant.createdAt,
      completedAt: participant.completedAt,
      participantCode: participant.recruitment?.participantCode,
      preSurvey: participant.preSurvey,
      blockSurvey: block.blockSurvey,
      finalSurvey: participant.finalSurvey,
      initialProposal: block.initialProposal,
      finalProposal: block.finalProposal
    }))
  ));
});

app.get("/api/export/events.csv", requireAdmin, async (_req, res) => {
  const events = await listEvents();
  sendCsv(res, "events.csv", events.map((event) => ({
    id: event.id,
    participantId: event.participantId,
    type: event.type,
    createdAt: event.createdAt,
    payload: event.payload
  })));
});

app.get("/api/export/ratings.csv", requireAdmin, async (_req, res) => {
  const ratings = await listRatings();
  sendCsv(res, "ratings.csv", ratings.map((rating) => ({
    id: rating.id,
    itemId: rating.itemId,
    participantId: rating.participantId,
    blockIndex: rating.blockIndex,
    stage: rating.stage,
    raterId: rating.raterId,
    createdAt: rating.createdAt,
    ratings: rating.ratings,
    notes: rating.notes
  })));
});

const distDir = path.join(rootDir, "dist");
app.use(express.static(distDir));
app.get(/^\/(?!api).*/, (_req, res, next) => {
  res.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) next();
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = error && typeof error === "object" && "status" in error && typeof error.status === "number"
    ? error.status
    : error instanceof z.ZodError
      ? 400
      : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? 8787);
await ensureStorage();
app.listen(port, () => {
  console.log(`Experiment server running on http://localhost:${port}`);
});
