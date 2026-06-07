import { createHash } from "node:crypto";
import type { Arm, ProbeDecision } from "../src/shared/experiment.js";
import { raterDimensions, seededProbes, perceivedPersonalityDimensions } from "../src/shared/experiment.js";
import { listEvents, listParticipants, listRatings, type BlindRating, type EventRecord, type ParticipantRecord } from "./storage.js";

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sd(values: number[]) {
  if (values.length < 2) return null;
  const m = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Paired-difference summary: given per-participant (specific, neutral) pairs, report the
// mean within-participant difference, its SD, and a paired Cohen's dz effect size. This is
// the workhorse statistic for the within-subjects design and is robust at small N.
function pairedSummary(pairs: Array<{ specific: number; neutral: number }>) {
  const diffs = pairs.map((pair) => pair.specific - pair.neutral);
  if (!diffs.length) return { n: 0, meanSpecific: null, meanNeutral: null, meanDiff: null, sdDiff: null, dz: null };
  const meanDiff = mean(diffs);
  const sdDiff = sd(diffs);
  return {
    n: diffs.length,
    meanSpecific: mean(pairs.map((pair) => pair.specific)),
    meanNeutral: mean(pairs.map((pair) => pair.neutral)),
    meanDiff,
    sdDiff,
    dz: meanDiff !== null && sdDiff && sdDiff > 0 ? Number((meanDiff / sdDiff).toFixed(3)) : null
  };
}

function averageRecord(record: Record<string, number>) {
  return mean(Object.values(record).filter((value) => Number.isFinite(value)));
}

function blindItemId(participantId: string, blockIndex: number, stage: "initial" | "final") {
  const salt = process.env.BLIND_ITEM_SALT ?? "agent-team-personality-ab-v1";
  return createHash("sha256").update(`${salt}:${participantId}:${blockIndex}:${stage}`).digest("base64url").slice(0, 18);
}

function orderedSquaredDistance(values: number[]) {
  let sum = 0;
  for (const left of values) {
    for (const right of values) {
      sum += (left - right) ** 2;
    }
  }
  return sum;
}

function krippendorffAlphaInterval(groups: number[][]) {
  const usable = groups.filter((group) => group.length >= 2);
  const values = usable.flat();
  if (usable.length < 2 || values.length < 3) return null;
  const observed = usable
    .map((group) => orderedSquaredDistance(group) / (group.length - 1))
    .reduce((sum, value) => sum + value, 0);
  const expected = orderedSquaredDistance(values) / (values.length - 1);
  if (expected === 0) return null;
  return 1 - observed / expected;
}

// Mean blind-rated quality for one (participant, block, stage) item, averaged over raters
// and rubric dimensions.
function itemMeanRating(ratings: BlindRating[], participantId: string, blockIndex: number, stage: "initial" | "final") {
  const itemId = blindItemId(participantId, blockIndex, stage);
  const values = ratings
    .filter((rating) => rating.itemId === itemId && rating.ratings)
    .map((rating) => averageRecord(rating.ratings))
    .filter((value): value is number => value !== null);
  return mean(values);
}

function blockImprovement(ratings: BlindRating[], participantId: string, blockIndex: number) {
  const initial = itemMeanRating(ratings, participantId, blockIndex, "initial");
  const final = itemMeanRating(ratings, participantId, blockIndex, "final");
  if (initial === null || final === null) return null;
  return final - initial;
}

function probeDecisions(events: EventRecord[]) {
  return events
    .filter((event) => event.type === "probe_decision")
    .map((event) => ({
      participantId: event.participantId,
      ...(event.payload as { probeId?: string; decision?: ProbeDecision; blockIndex?: number })
    }))
    .filter((event) => event.probeId && event.decision);
}

// Lenient calibration: valid suggestions credited when accepted or reframed; flawed
// suggestions credited when rejected, questioned, or reframed.
function calibrationScore(decisions: Array<{ probeId?: string; decision?: ProbeDecision }>) {
  if (!decisions.length) return null;
  let good = 0;
  for (const decision of decisions) {
    const probe = seededProbes.find((item) => item.id === decision.probeId);
    if (!probe) continue;
    if (probe.validity === "flawed" && ["rejected", "questioned", "reframed"].includes(decision.decision ?? "")) good += 1;
    if (probe.validity === "valid" && ["accepted", "reframed"].includes(decision.decision ?? "")) good += 1;
  }
  return good / decisions.length;
}

// Strict calibration: reframe credited only for flawed suggestions; valid suggestions
// require outright acceptance. Guards against "reframe everything" scoring as calibrated.
function strictCalibrationScore(decisions: Array<{ probeId?: string; decision?: ProbeDecision }>) {
  if (!decisions.length) return null;
  let good = 0;
  for (const decision of decisions) {
    const probe = seededProbes.find((item) => item.id === decision.probeId);
    if (!probe) continue;
    if (probe.validity === "flawed" && ["rejected", "questioned", "reframed"].includes(decision.decision ?? "")) good += 1;
    if (probe.validity === "valid" && decision.decision === "accepted") good += 1;
  }
  return good / decisions.length;
}

function summarizeBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function agentMessages(events: EventRecord[]) {
  return events
    .filter((event) => event.type === "agent_message")
    .map((event) => event.payload as {
      message?: { role?: string; latencyMs?: number; tokenEstimate?: number };
      arm?: Arm;
      usedFallback?: boolean;
      wordCount?: number;
      probeDelivery?: Array<{ probeId: string; validity: string; delivered: boolean; verbatim: boolean; overlap: number }>;
    })
    .filter((row): row is {
      message: { role: string; latencyMs?: number; tokenEstimate?: number };
      arm?: Arm;
      usedFallback?: boolean;
      wordCount?: number;
      probeDelivery?: Array<{ probeId: string; validity: string; delivered: boolean; verbatim: boolean; overlap: number }>;
    } => Boolean(row.message?.role));
}

// Per-participant, per-block survey score over a set of keys, read from the block survey.
function blockSurveyScore(participant: ParticipantRecord, blockIndex: number, keys: string[]) {
  const survey = participant.blocks.find((block) => block.index === blockIndex)?.blockSurvey ?? {};
  const values = keys.map((key) => Number(survey[key])).filter((value) => Number.isFinite(value));
  return mean(values);
}

const LOAD_KEYS = ["mentalDemand", "temporalDemand", "effort", "frustration"];
const LEGIBILITY_KEYS = ["roleClarity", "askRightAgent", "interpretDisagreement", "styleRoleFit"];
const PRESSURE_KEYS = ["feltPushed", "tooForceful", "overRelianceConcern"];
const AUTONOMY_KEYS = ["ownership", "rejectWithoutPenalty"];
const CONFLICT_KEYS = ["constructiveConflict", "critiqueUseful"];

export async function buildAnalytics() {
  const [participants, events, ratings] = await Promise.all([listParticipants(), listEvents(), listRatings()]);
  const decisions = probeDecisions(events);
  const agentMessageRows = agentMessages(events);

  // For each participant, build the per-arm metric pair (specific block vs neutral block).
  const participantPairs = participants.map((participant) => {
    const armBlock = (arm: Arm) => participant.blocks.find((block) => block.arm === arm);
    const specificBlock = armBlock("specific");
    const neutralBlock = armBlock("neutral");

    const metricsForBlock = (blockIndex?: number) => {
      if (blockIndex === undefined) return null;
      const decisionsHere = decisions.filter((d) => d.participantId === participant.id && d.blockIndex === blockIndex);
      return {
        improvement: blockImprovement(ratings, participant.id, blockIndex),
        finalQuality: itemMeanRating(ratings, participant.id, blockIndex, "final"),
        cognitiveLoad: blockSurveyScore(participant, blockIndex, LOAD_KEYS),
        roleLegibility: blockSurveyScore(participant, blockIndex, LEGIBILITY_KEYS),
        pressure: blockSurveyScore(participant, blockIndex, PRESSURE_KEYS),
        autonomy: blockSurveyScore(participant, blockIndex, AUTONOMY_KEYS),
        constructiveConflict: blockSurveyScore(participant, blockIndex, CONFLICT_KEYS),
        calibration: calibrationScore(decisionsHere),
        strictCalibration: strictCalibrationScore(decisionsHere)
      };
    };

    return {
      participantId: participant.id,
      sequenceId: participant.sequenceId,
      completed: Boolean(participant.completedAt),
      specific: metricsForBlock(specificBlock?.index),
      neutral: metricsForBlock(neutralBlock?.index)
    };
  });

  // Paired contrasts for every primary and secondary outcome.
  const metricKeys = [
    "improvement",
    "finalQuality",
    "calibration",
    "strictCalibration",
    "cognitiveLoad",
    "roleLegibility",
    "pressure",
    "autonomy",
    "constructiveConflict"
  ] as const;
  const pairedContrasts = metricKeys.map((key) => {
    const pairs = participantPairs
      .map((pair) => {
        const specific = pair.specific?.[key];
        const neutral = pair.neutral?.[key];
        if (specific === null || specific === undefined || neutral === null || neutral === undefined) return null;
        return { specific, neutral };
      })
      .filter((pair): pair is { specific: number; neutral: number } => pair !== null);
    return { key, ...pairedSummary(pairs) };
  });

  // In-context perceived-personality manipulation check, paired by participant.
  const perceivedChecks = perceivedPersonalityDimensions.map((dimension) => {
    const pairs = participants
      .map((participant) => {
        const specific = blockSurveyScore(participant, participant.blocks.find((b) => b.arm === "specific")?.index ?? -1, [dimension.key]);
        const neutral = blockSurveyScore(participant, participant.blocks.find((b) => b.arm === "neutral")?.index ?? -1, [dimension.key]);
        if (specific === null || neutral === null) return null;
        return { specific, neutral };
      })
      .filter((pair): pair is { specific: number; neutral: number } => pair !== null);
    return { key: dimension.key, label: dimension.labelEn, ...pairedSummary(pairs) };
  });

  // Probe decision distribution, split by arm so reviewers can see whether calibrated
  // handling differs between neutral and specific blocks.
  const probeSummary = seededProbes.map((probe) => {
    const related = decisions.filter((event) => event.probeId === probe.id);
    const countDecision = (rows: typeof related, decision: ProbeDecision) =>
      rows.filter((event) => event.decision === decision).length;
    return {
      probeId: probe.id,
      title: probe.title,
      topicId: probe.topicId,
      validity: probe.validity,
      sourceRole: probe.sourceRole,
      n: related.length,
      accepted: countDecision(related, "accepted"),
      rejected: countDecision(related, "rejected"),
      questioned: countDecision(related, "questioned"),
      reframed: countDecision(related, "reframed")
    };
  });

  const completionFunnel = [
    { stage: "created", count: participants.length },
    { stage: "pre_survey", count: participants.filter((p) => p.preSurvey).length },
    { stage: "block1_final", count: participants.filter((p) => p.blocks.find((b) => b.index === 1)?.finalProposal).length },
    { stage: "block2_final", count: participants.filter((p) => p.blocks.find((b) => b.index === 2)?.finalProposal).length },
    { stage: "final_survey", count: participants.filter((p) => p.finalSurvey).length },
    { stage: "completed", count: participants.filter((p) => p.completedAt).length }
  ];

  const eventTypeSummary = summarizeBy(events.map((event) => event.type));

  const agentRoleSummary = ["coordinator", "ideator", "critic", "verifier"].map((role) => {
    const group = agentMessageRows.filter((row) => row.message.role === role);
    return {
      role,
      n: group.length,
      meanLatencyMs: mean(group.map((row) => Number(row.message.latencyMs)).filter((value) => Number.isFinite(value))),
      meanTokenEstimate: mean(group.map((row) => Number(row.message.tokenEstimate)).filter((value) => Number.isFinite(value)))
    };
  });

  // Capability/verbosity parity check, by role and arm. If specific turns are
  // systematically longer than neutral turns, length confounds the manipulation.
  const responseLengthByArm = ["coordinator", "ideator", "critic", "verifier"].map((role) => {
    const group = agentMessageRows.filter((row) => row.message.role === role && Number.isFinite(Number(row.wordCount)));
    const neutral = group.filter((row) => row.arm === "neutral").map((row) => Number(row.wordCount));
    const specific = group.filter((row) => row.arm === "specific").map((row) => Number(row.wordCount));
    const neutralMean = mean(neutral);
    const specificMean = mean(specific);
    return {
      role,
      nNeutral: neutral.length,
      nSpecific: specific.length,
      meanWordsNeutral: neutralMean,
      meanWordsSpecific: specificMean,
      wordDiff: neutralMean !== null && specificMean !== null ? specificMean - neutralMean : null
    };
  });

  // Probe-delivery monitor: each seeded suggestion should reach the participant verbatim.
  const probeDeliveryRows = agentMessageRows.flatMap((row) => row.probeDelivery ?? []);
  const probeDeliverySummary = seededProbes.map((probe) => {
    const related = probeDeliveryRows.filter((row) => row.probeId === probe.id);
    return {
      probeId: probe.id,
      title: probe.title,
      validity: probe.validity,
      sourceRole: probe.sourceRole,
      n: related.length,
      delivered: related.filter((row) => row.delivered).length,
      verbatim: related.filter((row) => row.verbatim).length,
      deliveryRate: related.length ? related.filter((row) => row.delivered).length / related.length : null,
      meanOverlap: mean(related.map((row) => Number(row.overlap)).filter((value) => Number.isFinite(value)))
    };
  });
  const fallbackByArm = {
    neutral: agentMessageRows.filter((row) => row.usedFallback && row.arm === "neutral").length,
    specific: agentMessageRows.filter((row) => row.usedFallback && row.arm === "specific").length
  };

  const directedTurnSummary = summarizeBy(
    events
      .filter((event) => event.type === "direct_turn_started")
      .map((event) => String((event.payload as { targetRole?: string }).targetRole ?? "unknown"))
  );

  // Blind-rating coverage and reliability over all expected items (4 per completed-ish
  // participant: 2 blocks x initial/final).
  const expectedRatingItems = participants
    .flatMap((participant) =>
      participant.blocks.flatMap((block) => {
        if (!block.initialProposal || !block.finalProposal) return [];
        return (["initial", "final"] as const).map((stage) => ({
          itemId: blindItemId(participant.id, block.index, stage),
          displayId: `item-${blindItemId(participant.id, block.index, stage).slice(0, 10)}`,
          participantId: participant.id,
          blockIndex: block.index,
          stage
        }));
      })
    );
  const itemRaterSets = new Map<string, Set<string>>();
  for (const rating of ratings) {
    const set = itemRaterSets.get(rating.itemId) ?? new Set<string>();
    set.add((rating.raterId || "anonymous").trim().toLowerCase());
    itemRaterSets.set(rating.itemId, set);
  }
  const ratingCoverage = expectedRatingItems.map((item) => {
    const ratedCount = itemRaterSets.get(item.itemId)?.size ?? 0;
    return { ...item, ratedCount, neededRatings: Math.max(0, 3 - ratedCount) };
  });

  const ratingReliability = raterDimensions.map((dimension) => {
    const groups = expectedRatingItems.map((item) =>
      ratings
        .filter((rating) => rating.itemId === item.itemId && rating.ratings)
        .map((rating) => Number(rating.ratings[dimension.key]))
        .filter((value) => Number.isFinite(value))
    );
    return {
      key: dimension.key,
      label: dimension.labelEn,
      alpha: krippendorffAlphaInterval(groups),
      itemsWithTwoOrMoreRatings: groups.filter((group) => group.length >= 2).length
    };
  });

  const raterSummary = Array.from(ratings.reduce((map, rating) => {
    const key = rating.raterId || "anonymous";
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries())
    .map(([raterId, count]) => ({ raterId, count }))
    .sort((a, b) => b.count - a.count || a.raterId.localeCompare(b.raterId));

  const sequenceBalance = summarizeBy(participants.map((p) => p.sequenceId));

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      participants: participants.length,
      completed: participants.filter((p) => p.completedAt).length,
      ratings: ratings.length,
      fullyRatedBlindItems: ratingCoverage.filter((item) => item.ratedCount >= 3).length,
      expectedBlindItems: ratingCoverage.length,
      events: events.length
    },
    pairedContrasts,
    perceivedChecks,
    probeSummary,
    probeDeliverySummary,
    fallbackByArm,
    responseLengthByArm,
    completionFunnel,
    sequenceBalance,
    eventTypeSummary,
    agentRoleSummary,
    directedTurnSummary,
    ratingCoverage,
    ratingReliability,
    raterSummary,
    participantPairs
  };
}
