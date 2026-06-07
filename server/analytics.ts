import { createHash } from "node:crypto";
import type { Condition, ProbeDecision } from "../src/shared/experiment.js";
import { conditions, raterDimensions, seededProbes } from "../src/shared/experiment.js";
import { listEvents, listParticipants, listRatings, type BlindRating, type EventRecord, type ParticipantRecord } from "./storage.js";

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageRecord(record: Record<string, number>) {
  return mean(Object.values(record).filter((value) => Number.isFinite(value)));
}

function blindItemId(participantId: string, stage: "initial" | "final") {
  const salt = process.env.BLIND_ITEM_SALT ?? "role-specific-agent-personality-lab-v1";
  return createHash("sha256").update(`${salt}:${participantId}:${stage}`).digest("base64url").slice(0, 18);
}

function expandedRatingRows(ratings: BlindRating[]) {
  return ratings.flatMap((rating) => {
    if (rating.stage && rating.ratings) {
      return [{
        itemId: rating.itemId ?? blindItemId(rating.participantId, rating.stage),
        participantId: rating.participantId,
        stage: rating.stage,
        raterId: rating.raterId || "anonymous",
        ratings: rating.ratings
      }];
    }
    const legacy = [];
    if (rating.initial) {
      legacy.push({
        itemId: blindItemId(rating.participantId, "initial"),
        participantId: rating.participantId,
        stage: "initial" as const,
        raterId: rating.raterId || "anonymous",
        ratings: rating.initial
      });
    }
    if (rating.final) {
      legacy.push({
        itemId: blindItemId(rating.participantId, "final"),
        participantId: rating.participantId,
        stage: "final" as const,
        raterId: rating.raterId || "anonymous",
        ratings: rating.final
      });
    }
    return legacy;
  });
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

function conditionFactors(condition: Condition) {
  return {
    coordinator: condition.coordinator === "specific" ? 1 : 0,
    ideator: condition.ideator === "specific" ? 1 : 0,
    critic: condition.critic === "specific" ? 1 : 0,
    verifier: condition.verifier === "specific" ? 1 : 0
  };
}

function participantSurveyScore(participant: ParticipantRecord, keys: string[]) {
  const survey = participant.postSurvey ?? {};
  const values = keys.map((key) => Number(survey[key])).filter((value) => Number.isFinite(value));
  return mean(values);
}

function ratingsByParticipant(ratings: BlindRating[]) {
  const grouped = new Map<string, BlindRating[]>();
  for (const rating of ratings) {
    const list = grouped.get(rating.participantId) ?? [];
    list.push(rating);
    grouped.set(rating.participantId, list);
  }
  return grouped;
}

function ratingImprovement(ratings: BlindRating[]) {
  const stageMean = (stage: "initial" | "final") => {
    const values = ratings
      .map((rating) => {
        if (rating.stage === stage && rating.ratings) return averageRecord(rating.ratings);
        if (stage === "initial" && rating.initial) return averageRecord(rating.initial);
        if (stage === "final" && rating.final) return averageRecord(rating.final);
        return null;
      })
      .filter((value): value is number => value !== null);
    return mean(values);
  };
  const initial = stageMean("initial");
  const final = stageMean("final");
  if (initial === null || final === null) return null;
  return final - initial;
}

function probeDecisions(events: EventRecord[]) {
  return events
    .filter((event) => event.type === "probe_decision")
    .map((event) => ({
      participantId: event.participantId,
      ...(event.payload as { probeId?: string; decision?: ProbeDecision })
    }))
    .filter((event) => event.probeId && event.decision);
}

function calibrationScoreForDecisions(decisions: Array<{ probeId?: string; decision?: ProbeDecision }>) {
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

// M1: strict calibration variant. "reframed" is lenient because a participant who
// reframes everything scores 100% under the lenient rule. The strict rule credits
// reframe only for flawed probes (reframing a flaw is a corrective act), and for
// valid probes requires outright acceptance/adoption.
function strictCalibrationScoreForDecisions(decisions: Array<{ probeId?: string; decision?: ProbeDecision }>) {
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
    .map((event) => {
      const payload = event.payload as {
        message?: { role?: string; latencyMs?: number; tokenEstimate?: number; round?: number };
        level?: "neutral" | "specific";
        usedFallback?: boolean;
        wordCount?: number;
        probeDelivery?: Array<{ probeId: string; validity: string; delivered: boolean; verbatim: boolean; overlap: number }>;
      };
      return { ...payload, message: payload.message };
    })
    .filter((row): row is {
      message: { role: string; latencyMs?: number; tokenEstimate?: number; round?: number };
      level?: "neutral" | "specific";
      usedFallback?: boolean;
      wordCount?: number;
      probeDelivery?: Array<{ probeId: string; validity: string; delivered: boolean; verbatim: boolean; overlap: number }>;
    } => Boolean(row.message?.role));
}

export async function buildAnalytics() {
  const [participants, events, ratings] = await Promise.all([listParticipants(), listEvents(), listRatings()]);
  const study1 = participants.filter((participant) => participant.study === "study1");
  const study0 = participants.filter((participant) => participant.study === "study0");
  const study2 = participants.filter((participant) => participant.study === "study2");
  const ratingMap = ratingsByParticipant(ratings);
  const ratingRows = expandedRatingRows(ratings);
  const decisions = probeDecisions(events);
  const agentMessageRows = agentMessages(events);

  const conditionSummary = conditions.map((condition) => {
    const group = study1.filter((participant) => participant.conditionId === condition.id);
    const groupRatings = group.flatMap((participant) => ratingMap.get(participant.id) ?? []);
    const probeEvents = decisions.filter((event) => group.some((participant) => participant.id === event.participantId));
    const flawed = probeEvents.filter((event) => seededProbes.find((probe) => probe.id === event.probeId)?.validity === "flawed");
    const valid = probeEvents.filter((event) => seededProbes.find((probe) => probe.id === event.probeId)?.validity === "valid");
    const flawedGood = flawed.filter((event) => event.decision === "rejected" || event.decision === "questioned" || event.decision === "reframed").length;
    const validGood = valid.filter((event) => event.decision === "accepted" || event.decision === "reframed").length;
    return {
      conditionId: condition.id,
      n: group.length,
      completed: group.filter((participant) => participant.completedAt).length,
      improvement: ratingImprovement(groupRatings),
      cognitiveLoad: mean(group.map((participant) => participantSurveyScore(participant, ["mentalDemand", "temporalDemand", "effort", "frustration"]) ?? NaN).filter((value) => Number.isFinite(value))),
      roleLegibility: mean(group.map((participant) => participantSurveyScore(participant, ["roleClarity", "askRightAgent", "interpretDisagreement", "styleRoleFit"]) ?? NaN).filter((value) => Number.isFinite(value))),
      pressure: mean(group.map((participant) => participantSurveyScore(participant, ["feltPushed", "tooForceful", "overRelianceConcern"]) ?? NaN).filter((value) => Number.isFinite(value))),
      autonomy: mean(group.map((participant) => Number(participant.postSurvey?.ownership)).filter((value) => Number.isFinite(value))),
      calibration: probeEvents.length ? (flawedGood + validGood) / probeEvents.length : null
    };
  });

  const participantMetrics = study1.map((participant) => ({
    participantId: participant.id,
    conditionId: participant.conditionId,
    factors: participant.condition ? conditionFactors(participant.condition) : null,
    improvement: ratingImprovement(ratingMap.get(participant.id) ?? []),
    cognitiveLoad: participantSurveyScore(participant, ["mentalDemand", "temporalDemand", "effort", "frustration"]),
    roleLegibility: participantSurveyScore(participant, ["roleClarity", "askRightAgent", "interpretDisagreement", "styleRoleFit"]),
    pressure: participantSurveyScore(participant, ["feltPushed", "tooForceful", "overRelianceConcern"]),
    autonomy: Number(participant.postSurvey?.ownership) || null,
    calibration: calibrationScoreForDecisions(decisions.filter((event) => event.participantId === participant.id)),
    strictCalibration: strictCalibrationScoreForDecisions(decisions.filter((event) => event.participantId === participant.id))
  }));

  const roleMainEffects = ["coordinator", "ideator", "critic", "verifier"].map((role) => {
    const high = participantMetrics.filter((metric) => metric.factors?.[role as keyof ReturnType<typeof conditionFactors>] === 1);
    const low = participantMetrics.filter((metric) => metric.factors?.[role as keyof ReturnType<typeof conditionFactors>] === 0);
    const highImprovement = mean(high.map((metric) => metric.improvement ?? NaN).filter((value) => Number.isFinite(value)));
    const lowImprovement = mean(low.map((metric) => metric.improvement ?? NaN).filter((value) => Number.isFinite(value)));
    return {
      role,
      nHigh: high.length,
      nLow: low.length,
      improvementHigh: highImprovement,
      improvementLow: lowImprovement,
      improvementDiff: highImprovement !== null && lowImprovement !== null ? highImprovement - lowImprovement : null,
      matchedOutcome: role === "coordinator"
        ? {
          high: mean(high.map((metric) => metric.cognitiveLoad ?? NaN).filter((value) => Number.isFinite(value))),
          low: mean(low.map((metric) => metric.cognitiveLoad ?? NaN).filter((value) => Number.isFinite(value))),
          label: "Cognitive load, lower is better"
        }
        : role === "ideator"
          ? { high: highImprovement, low: lowImprovement, label: "Blind-rated improvement" }
          : role === "critic"
            ? {
              high: mean(high.map((metric) => metric.pressure ?? NaN).filter((value) => Number.isFinite(value))),
              low: mean(low.map((metric) => metric.pressure ?? NaN).filter((value) => Number.isFinite(value))),
              label: "Perceived pressure"
            }
            : {
              high: mean(high.map((metric) => metric.calibration ?? NaN).filter((value) => Number.isFinite(value))),
              low: mean(low.map((metric) => metric.calibration ?? NaN).filter((value) => Number.isFinite(value))),
              label: "Calibration score"
            }
    };
  });

  const manipulationCheck = study0.flatMap((participant) => {
    const ratings = Array.isArray(participant.study0Ratings) ? participant.study0Ratings : [];
    return ratings.map((rating) => ({ participantId: participant.id, ...rating as Record<string, unknown> }));
  });

  const probeSummary = seededProbes.map((probe) => {
    const related = decisions.filter((event) => event.probeId === probe.id);
    return {
      probeId: probe.id,
      title: probe.title,
      validity: probe.validity,
      n: related.length,
      accepted: related.filter((event) => event.decision === "accepted").length,
      rejected: related.filter((event) => event.decision === "rejected").length,
      questioned: related.filter((event) => event.decision === "questioned").length,
      reframed: related.filter((event) => event.decision === "reframed").length
    };
  });

  const completionFunnel = [
    { stage: "created", count: study1.length },
    { stage: "pre_survey", count: study1.filter((participant) => participant.preSurvey).length },
    { stage: "initial_proposal", count: study1.filter((participant) => participant.initialProposal).length },
    { stage: "workspace_completed", count: study1.filter((participant) => participant.status === "workspace_completed" || participant.finalProposal || participant.completedAt).length },
    { stage: "final_proposal", count: study1.filter((participant) => participant.finalProposal).length },
    { stage: "post_survey", count: study1.filter((participant) => participant.postSurvey).length },
    { stage: "completed", count: study1.filter((participant) => participant.completedAt).length }
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

  // M2: capability/verbosity parity check. If "specific" turns are systematically
  // longer than "neutral" turns for a role, response length confounds the personality
  // manipulation. Pre-register a parity criterion and, if violated, covary out length.
  const responseLengthByLevel = ["coordinator", "ideator", "critic", "verifier"].map((role) => {
    const group = agentMessageRows.filter((row) => row.message.role === role && Number.isFinite(Number(row.wordCount)));
    const neutral = group.filter((row) => row.level === "neutral").map((row) => Number(row.wordCount));
    const specific = group.filter((row) => row.level === "specific").map((row) => Number(row.wordCount));
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

  // C3: probe-delivery monitor. The calibrated-reliance contribution assumes each
  // seeded suggestion reaches the participant verbatim. Report delivery rate per probe
  // and an agent fallback count so contaminated turns can be flagged or excluded.
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
  const fallbackByLevel = {
    neutral: agentMessageRows.filter((row) => row.usedFallback && row.level === "neutral").length,
    specific: agentMessageRows.filter((row) => row.usedFallback && row.level === "specific").length
  };

  const directedTurnSummary = summarizeBy(
    events
      .filter((event) => event.type === "direct_turn_started")
      .map((event) => String((event.payload as { targetRole?: string }).targetRole ?? "unknown"))
  );

  const expectedRatingItems = study1
    .filter((participant) => participant.initialProposal && participant.finalProposal)
    .flatMap((participant) => (["initial", "final"] as const).map((stage) => ({
      itemId: blindItemId(participant.id, stage),
      displayId: `item-${blindItemId(participant.id, stage).slice(0, 10)}`,
      participantId: participant.id,
      stage
    })));
  const itemRaterSets = new Map<string, Set<string>>();
  for (const row of ratingRows) {
    const set = itemRaterSets.get(row.itemId) ?? new Set<string>();
    set.add(row.raterId.trim().toLowerCase());
    itemRaterSets.set(row.itemId, set);
  }
  const ratingCoverage = expectedRatingItems.map((item) => {
    const ratedCount = itemRaterSets.get(item.itemId)?.size ?? 0;
    return {
      ...item,
      ratedCount,
      neededRatings: Math.max(0, 3 - ratedCount)
    };
  });

  const ratingReliability = raterDimensions.map((dimension) => {
    const groups = expectedRatingItems.map((item) =>
      ratingRows
        .filter((row) => row.itemId === item.itemId)
        .map((row) => Number(row.ratings[dimension.key]))
        .filter((value) => Number.isFinite(value))
    );
    return {
      key: dimension.key,
      label: dimension.labelEn,
      alpha: krippendorffAlphaInterval(groups),
      itemsWithTwoOrMoreRatings: groups.filter((group) => group.length >= 2).length
    };
  });

  const raterSummary = Array.from(ratingRows.reduce((map, row) => {
    const key = row.raterId || "anonymous";
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries())
    .map(([raterId, count]) => ({ raterId, count }))
    .sort((a, b) => b.count - a.count || a.raterId.localeCompare(b.raterId));

  const constructSummary = [
    { key: "cognitiveLoad", label: "Cognitive load", mean: mean(participantMetrics.map((metric) => metric.cognitiveLoad ?? NaN).filter((value) => Number.isFinite(value))) },
    { key: "roleLegibility", label: "Role legibility", mean: mean(participantMetrics.map((metric) => metric.roleLegibility ?? NaN).filter((value) => Number.isFinite(value))) },
    { key: "pressure", label: "Perceived pressure", mean: mean(participantMetrics.map((metric) => metric.pressure ?? NaN).filter((value) => Number.isFinite(value))) },
    { key: "autonomy", label: "User autonomy", mean: mean(participantMetrics.map((metric) => metric.autonomy ?? NaN).filter((value) => Number.isFinite(value))) },
    { key: "calibration", label: "Behavioral calibration (lenient)", mean: mean(participantMetrics.map((metric) => metric.calibration ?? NaN).filter((value) => Number.isFinite(value))) },
    { key: "strictCalibration", label: "Behavioral calibration (strict)", mean: mean(participantMetrics.map((metric) => metric.strictCalibration ?? NaN).filter((value) => Number.isFinite(value))) }
  ];

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      participants: participants.length,
      study0: study0.length,
      study1: study1.length,
      study2: study2.length,
      completedStudy1: study1.filter((participant) => participant.completedAt).length,
      ratings: ratings.length,
      fullyRatedBlindItems: ratingCoverage.filter((item) => item.ratedCount >= 3).length,
      expectedBlindItems: ratingCoverage.length,
      events: events.length
    },
    conditionSummary,
    roleMainEffects,
    probeSummary,
    probeDeliverySummary,
    fallbackByLevel,
    responseLengthByLevel,
    completionFunnel,
    eventTypeSummary,
    agentRoleSummary,
    directedTurnSummary,
    constructSummary,
    ratingCoverage,
    ratingReliability,
    raterSummary,
    manipulationCheck,
    participantMetrics
  };
}
