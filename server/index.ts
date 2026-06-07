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
  manipulationDimensions,
  raterDimensions,
  roles,
  seededProbes,
  study0Materials,
  taskTopics,
  type PersonalityLevel,
  type Role,
  type Study
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

function publicParticipant<T extends { condition?: unknown; conditionId?: unknown }>(participant: T) {
  const { condition: _condition, conditionId: _conditionId, ...publicRecord } = participant;
  return publicRecord;
}

const protectedParticipantKeys = new Set([
  "id",
  "study",
  "condition",
  "conditionId",
  "topicId",
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

function study0DimensionKeys() {
  return [
    ...manipulationDimensions.map((dimension) => dimension.key),
    ...roles.map((role) => `suitable_${role}`)
  ];
}

function validateStudy0Ratings(value: unknown) {
  if (!Array.isArray(value)) throw badRequest("Study 0 ratings must be an array");
  if (value.length !== 8) throw badRequest("Study 0 submission must contain exactly 8 counterbalanced items");
  const itemIds = new Set(study0Materials.map((item) => item.id));
  const pairs = new Set<string>();
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw badRequest("Study 0 rating rows must be objects");
    const record = row as Record<string, unknown>;
    const itemId = String(record.itemId ?? "");
    const role = record.role as Role;
    const level = record.level as PersonalityLevel;
    if (!itemIds.has(itemId)) throw badRequest(`Unknown Study 0 item: ${itemId}`);
    if (seen.has(itemId)) throw badRequest(`Duplicate Study 0 item: ${itemId}`);
    seen.add(itemId);
    if (!roles.includes(role)) throw badRequest(`Invalid Study 0 role: ${String(role)}`);
    if (level !== "neutral" && level !== "specific") throw badRequest(`Invalid Study 0 level: ${String(level)}`);
    pairs.add(`${role}:${level}`);
    validateRatingRecord(record.ratings, study0DimensionKeys(), `Study 0 item ${itemId}`);
  }
  if (pairs.size !== 8) throw badRequest("Study 0 ratings must cover every role x level pair exactly once");
}

function proposalMinChars(study: Study, key: "initialProposal" | "finalProposal") {
  if (study === "study1" && key === "initialProposal") return 320;
  if (study === "study1" && key === "finalProposal") return 560;
  if (study === "study2" && key === "initialProposal") return 260;
  return 0;
}

function validateParticipantPatch(existing: ParticipantRecord, body: unknown): Partial<ParticipantRecord> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Participant patch must be an object");
  }
  const patch = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([key]) => !protectedParticipantKeys.has(key))
  ) as Partial<ParticipantRecord>;
  const next = { ...existing, ...patch };

  if (patch.preSurvey || next.status === "pre_completed") {
    if (Number(next.preSurvey?.attentionCheck) !== 5) {
      throw badRequest("Attention check failed; expected preSurvey.attentionCheck to equal 5");
    }
  }
  if (patch.initialProposal || next.status === "initial_completed") {
    const issues = proposalQualityIssues(next.initialProposal, proposalMinChars(existing.study, "initialProposal"));
    if (issues.length) throw badRequest(`Initial proposal failed quality gate: ${issues.join("; ")}`);
  }
  if (patch.finalProposal || next.status === "final_completed") {
    const issues = proposalQualityIssues(next.finalProposal, proposalMinChars(existing.study, "finalProposal"));
    if (issues.length) throw badRequest(`Final proposal failed quality gate: ${issues.join("; ")}`);
  }
  if (patch.study0Ratings) {
    if (existing.study !== "study0") throw badRequest("study0Ratings can only be saved for Study 0 participants");
    validateStudy0Ratings(patch.study0Ratings);
  }
  if (next.status === "completed" && existing.study === "study1") {
    if (!next.postSurvey) throw badRequest("Study 1 completion requires postSurvey");
    const finalIssues = proposalQualityIssues(next.finalProposal, proposalMinChars(existing.study, "finalProposal"));
    if (finalIssues.length) throw badRequest(`Study 1 completion requires a valid final proposal: ${finalIssues.join("; ")}`);
  }
  return patch;
}

const eventSchema = z.object({
  participantId: z.string().min(1),
  study: z.enum(["study0", "study1", "study2"]).optional(),
  type: z.string().min(1).max(96).regex(/^[A-Za-z0-9_:-]+$/).default("client_event"),
  payload: z.record(z.string(), z.unknown()).default({})
});

const ratingInputSchema = z.object({
  itemId: z.string().min(1),
  raterId: z.preprocess((value) => String(value ?? "").trim() || "anonymous", z.string().min(1).max(80)),
  ratings: z.record(z.string(), z.number().int().min(1).max(7)),
  notes: z.string().max(4000).optional()
});

function blindItemId(participantId: string, stage: "initial" | "final") {
  const salt = process.env.BLIND_ITEM_SALT ?? "role-specific-agent-personality-lab-v1";
  return createHash("sha256").update(`${salt}:${participantId}:${stage}`).digest("base64url").slice(0, 18);
}

function buildBlindRatingItems(participants: ParticipantRecord[], ratings: Awaited<ReturnType<typeof listRatings>>) {
  const raterSets = new Map<string, Set<string>>();
  for (const rating of ratings) {
    const key = rating.itemId ?? (rating.stage ? blindItemId(rating.participantId, rating.stage) : undefined);
    if (!key) continue;
    const set = raterSets.get(key) ?? new Set<string>();
    set.add((rating.raterId || "anonymous").trim().toLowerCase());
    raterSets.set(key, set);
  }
  return participants
    .filter((participant) =>
      participant.study === "study1" &&
      participant.initialProposal &&
      participant.finalProposal &&
      !proposalQualityIssues(participant.initialProposal, proposalMinChars("study1", "initialProposal")).length &&
      !proposalQualityIssues(participant.finalProposal, proposalMinChars("study1", "finalProposal")).length
    )
    .flatMap((participant) => (["initial", "final"] as const).map((stage) => {
      const itemId = blindItemId(participant.id, stage);
      const topic = taskTopics.find((item) => item.id === participant.topicId) ?? taskTopics[0];
      const ratedCount = raterSets.get(itemId)?.size ?? 0;
      return {
        itemId,
        displayId: `item-${itemId.slice(0, 10)}`,
        participantId: participant.id,
        stage,
        topic: topic.en,
        topicZh: topic.zh,
        createdAt: participant.createdAt,
        ratedCount,
        neededRatings: Math.max(0, 3 - ratedCount),
        proposal: stage === "initial" ? participant.initialProposal : participant.finalProposal
      };
    }));
}

const participantSchema = z.object({
  study: z.enum(["study0", "study1", "study2"]),
  lang: z.enum(["en", "zh"]).default("zh"),
  consent: z.record(z.string(), z.unknown()).optional(),
  recruitment: z.record(z.string(), z.unknown()).optional(),
  browserInfo: z.record(z.string(), z.unknown()).optional(),
  conditionId: z.string().optional(),
  topicId: z.string().optional()
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: process.env.AGENT_MODEL,
    agentMode: process.env.AGENT_MODE,
    hasAgentKey: Boolean(process.env.AGENT_API_KEY)
  });
});

app.get("/api/public-config", (_req, res) => {
  res.json({
    probes: seededProbes.map(({ expectedBehavior: _expectedBehavior, validity: _validity, ...publicProbe }) => publicProbe)
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
      study: participant.study,
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
    if (input.study && input.study !== participant.study) {
      return res.status(400).json({ error: "Event study does not match participant study" });
    }
    const event = await appendEvent({
      id: newId("event"),
      participantId: participant.id,
      study: participant.study,
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
    .map(({ participantId: _participantId, stage: _stage, createdAt: _createdAt, ...publicItem }) => publicItem);
  res.json({
    items
  });
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
      (rating.itemId ?? (rating.stage ? blindItemId(rating.participantId, rating.stage) : "")) === input.itemId &&
      (rating.raterId || "anonymous").trim().toLowerCase() === normalizedRater
    );
    if (duplicate) return res.status(409).json({ error: "This rater has already rated this item" });
    const rating = await saveRating({
      itemId: item.itemId,
      participantId: item.participantId,
      stage: item.stage,
      raterId: input.raterId,
      ratings: input.ratings,
      notes: input.notes
    });
    res.json({
      rating: {
        id: rating.id,
        itemId: rating.itemId,
        raterId: rating.raterId,
        createdAt: rating.createdAt
      }
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
  sendCsv(res, "participants.csv", participants.map((participant) => ({
    id: participant.id,
    study: participant.study,
    lang: participant.lang,
    conditionId: participant.conditionId,
    topicId: participant.topicId,
    status: participant.status,
    createdAt: participant.createdAt,
    completedAt: participant.completedAt,
    participantCode: participant.recruitment?.participantCode,
    preSurvey: participant.preSurvey,
    postSurvey: participant.postSurvey,
    initialProposal: participant.initialProposal,
    finalProposal: participant.finalProposal
  })));
});

app.get("/api/export/events.csv", requireAdmin, async (_req, res) => {
  const events = await listEvents();
  sendCsv(res, "events.csv", events.map((event) => ({
    id: event.id,
    participantId: event.participantId,
    study: event.study,
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
    stage: rating.stage,
    raterId: rating.raterId,
    createdAt: rating.createdAt,
    ratings: rating.ratings,
    initial: rating.initial,
    final: rating.final,
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
