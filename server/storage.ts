import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Arm, BlockPlan, Language, ProbeDecision } from "../src/shared/experiment.js";
import { sequences } from "../src/shared/experiment.js";

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
export const dataDir = path.join(rootDir, "data");
const participantsDir = path.join(dataDir, "participants");
const ratingsDir = path.join(dataDir, "ratings");
const eventLogPath = path.join(dataDir, "events.jsonl");

// One collaboration block as stored on the participant record. arm/topicId come from the
// assigned counterbalance sequence; proposals and the per-block survey are filled in as
// the participant progresses through that block.
export interface BlockRecord extends BlockPlan {
  initialProposal?: Record<string, string>;
  finalProposal?: Record<string, string>;
  blockSurvey?: Record<string, unknown>;
}

export interface ParticipantRecord {
  id: string;
  lang: Language;
  sequenceId: string;
  blocks: BlockRecord[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  consent?: Record<string, unknown>;
  recruitment?: Record<string, unknown>;
  browserInfo?: Record<string, unknown>;
  preSurvey?: Record<string, unknown>;
  finalSurvey?: Record<string, unknown>;
  status?: string;
}

export interface EventRecord {
  id: string;
  participantId?: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

// A blind rating targets a single anonymous proposal item (one block, one stage).
export interface BlindRating {
  id: string;
  participantId: string;
  blockIndex: number;
  stage: "initial" | "final";
  raterId: string;
  createdAt: string;
  itemId: string;
  ratings: Record<string, number>;
  notes?: string;
}

export interface ProbeDecisionEvent {
  probeId: string;
  decision: ProbeDecision;
}

export async function ensureStorage() {
  await fs.mkdir(participantsDir, { recursive: true });
  await fs.mkdir(ratingsDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(eventLogPath);
  } catch {
    await fs.writeFile(eventLogPath, "", "utf8");
  }
}

export function newId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function participantPath(id: string) {
  return path.join(participantsDir, `${id}.json`);
}

function ratingPath(id: string) {
  return path.join(ratingsDir, `${id}.json`);
}

export async function listParticipants(): Promise<ParticipantRecord[]> {
  await ensureStorage();
  const names = await fs.readdir(participantsDir);
  const records = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => JSON.parse(await fs.readFile(path.join(participantsDir, name), "utf8")) as ParticipantRecord)
  );
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Round-robin assignment over the four counterbalance sequences, keeping the assigned
// (committed) counts balanced. At small N this guarantees an even spread of arm orders
// and arm-to-topic mappings.
async function nextSequence() {
  const participants = await listParticipants();
  const counts = new Map(sequences.map((sequence) => [sequence.id, 0]));
  const committedStatuses = new Set([
    "pre_completed",
    "block_in_progress",
    "block_completed",
    "completed"
  ]);
  for (const participant of participants) {
    if (participant.completedAt || committedStatuses.has(participant.status ?? "")) {
      counts.set(participant.sequenceId, (counts.get(participant.sequenceId) ?? 0) + 1);
    }
  }
  const min = Math.min(...Array.from(counts.values()));
  const candidates = sequences.filter((sequence) => counts.get(sequence.id) === min);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function createParticipant(input: {
  lang: Language;
  consent?: Record<string, unknown>;
  recruitment?: Record<string, unknown>;
  browserInfo?: Record<string, unknown>;
  sequenceId?: string;
}): Promise<ParticipantRecord> {
  await ensureStorage();
  const sequence = input.sequenceId
    ? sequences.find((item) => item.id === input.sequenceId) ?? (await nextSequence())
    : await nextSequence();
  const now = new Date().toISOString();
  const record: ParticipantRecord = {
    id: newId("p"),
    lang: input.lang,
    sequenceId: sequence.id,
    blocks: sequence.blocks.map((block) => ({ ...block })),
    consent: input.consent,
    recruitment: input.recruitment,
    browserInfo: input.browserInfo,
    createdAt: now,
    updatedAt: now,
    status: "created"
  };
  await saveParticipant(record);
  await appendEvent({
    id: newId("event"),
    participantId: record.id,
    type: "participant_created",
    createdAt: now,
    payload: {
      sequenceId: record.sequenceId,
      blocks: record.blocks.map((block) => ({ index: block.index, arm: block.arm, topicId: block.topicId }))
    }
  });
  return record;
}

export function blockArm(participant: ParticipantRecord, blockIndex: number): Arm {
  return participant.blocks.find((block) => block.index === blockIndex)?.arm ?? "neutral";
}

export async function getParticipant(id: string): Promise<ParticipantRecord | undefined> {
  await ensureStorage();
  try {
    return JSON.parse(await fs.readFile(participantPath(id), "utf8")) as ParticipantRecord;
  } catch {
    return undefined;
  }
}

export async function saveParticipant(record: ParticipantRecord): Promise<ParticipantRecord> {
  await ensureStorage();
  const updated = { ...record, updatedAt: new Date().toISOString() };
  await fs.writeFile(participantPath(record.id), JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

export async function updateParticipant(id: string, patch: Partial<ParticipantRecord>): Promise<ParticipantRecord | undefined> {
  const existing = await getParticipant(id);
  if (!existing) return undefined;
  const merged = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await saveParticipant(merged);
  return merged;
}

export async function appendEvent(event: EventRecord): Promise<EventRecord> {
  await ensureStorage();
  await fs.appendFile(eventLogPath, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function listEvents(): Promise<EventRecord[]> {
  await ensureStorage();
  const raw = await fs.readFile(eventLogPath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EventRecord);
}

export async function saveRating(input: Omit<BlindRating, "id" | "createdAt">): Promise<BlindRating> {
  await ensureStorage();
  const rating: BlindRating = {
    ...input,
    id: newId("rating"),
    createdAt: new Date().toISOString()
  };
  await fs.writeFile(ratingPath(rating.id), JSON.stringify(rating, null, 2), "utf8");
  await appendEvent({
    id: newId("event"),
    participantId: input.participantId,
    type: "blind_rating_saved",
    createdAt: rating.createdAt,
    payload: { ratingId: rating.id, raterId: rating.raterId, itemId: rating.itemId, stage: rating.stage }
  });
  return rating;
}

export async function listRatings(): Promise<BlindRating[]> {
  await ensureStorage();
  const names = await fs.readdir(ratingsDir);
  const ratings = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => JSON.parse(await fs.readFile(path.join(ratingsDir, name), "utf8")) as BlindRating)
  );
  return ratings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getExportPaths() {
  return {
    dataDir,
    participantsDir,
    ratingsDir,
    eventLogPath
  };
}
