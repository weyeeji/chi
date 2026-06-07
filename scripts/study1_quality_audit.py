#!/usr/bin/env python3
"""Audit recruitment, blind-rating coverage, reliability, and paired contrasts
for the within-subjects agent-team personality study.

The script uses only the Python standard library so it can run on the study
server without extra setup. It reads local JSON records from data/.

Data model (see src/shared/experiment.ts and server/storage.ts):
- Each participant has two blocks; each block has an arm ("neutral" | "specific"),
  a topicId, an initialProposal, a finalProposal, and a blockSurvey.
- Blind ratings target an opaque item id keyed by (participant, blockIndex, stage).
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import os
from pathlib import Path
from statistics import mean, pstdev
from typing import Any


RATER_DIMENSIONS = [
    "problemFraming",
    "novelty",
    "feasibility",
    "riskAwareness",
    "userAgency",
    "evaluationRigor",
    "overallChiPotential",
]

PROPOSAL_FIELDS = ["problem", "users", "concept", "flow", "risks", "evaluation", "agency"]

SEQUENCES = ["S1", "S2", "S3", "S4"]

MIN_INITIAL_CHARS = 280
MIN_FINAL_CHARS = 480


def load_json_dir(directory: Path) -> list[dict[str, Any]]:
    if not directory.exists():
        return []
    records = []
    for path in sorted(directory.glob("*.json")):
        with path.open("r", encoding="utf-8") as handle:
            records.append(json.load(handle))
    return records


def proposal_issues(proposal: Any, min_chars: int) -> list[str]:
    if not isinstance(proposal, dict):
        return ["not_object"]
    missing = [key for key in PROPOSAL_FIELDS if len(str(proposal.get(key, "")).strip()) < 18]
    total_chars = sum(len(str(proposal.get(key, "")).strip()) for key in PROPOSAL_FIELDS)
    issues = [f"{key}_too_short" for key in missing]
    if total_chars < min_chars:
        issues.append(f"chars_{total_chars}_lt_{min_chars}")
    return issues


def blind_item_id(participant_id: str, block_index: int, stage: str) -> str:
    salt = os.environ.get("BLIND_ITEM_SALT", "agent-team-personality-ab-v1")
    digest = hashlib.sha256(f"{salt}:{participant_id}:{block_index}:{stage}".encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")[:18]


def ordered_squared_distance(values: list[float]) -> float:
    return sum((left - right) ** 2 for left in values for right in values)


def krippendorff_alpha(groups: list[list[float]]) -> float | None:
    usable = [group for group in groups if len(group) >= 2]
    values = [value for group in usable for value in group]
    if len(usable) < 2 or len(values) < 3:
        return None
    observed = sum(ordered_squared_distance(group) / (len(group) - 1) for group in usable)
    expected = ordered_squared_distance(values) / (len(values) - 1)
    if expected == 0:
        return None
    return 1 - observed / expected


def score_mean(scores: dict[str, Any]) -> float | None:
    values = [float(scores[key]) for key in RATER_DIMENSIONS if isinstance(scores.get(key), (int, float))]
    return mean(values) if values else None


def paired_summary(pairs: list[tuple[float, float]]) -> dict[str, Any]:
    """pairs: list of (specific, neutral). Returns mean difference and Cohen's dz."""
    diffs = [specific - neutral for specific, neutral in pairs]
    if not diffs:
        return {"n": 0, "meanDiff": None, "dz": None}
    md = mean(diffs)
    # Sample SD of the differences.
    sd = pstdev(diffs) * (len(diffs) / (len(diffs) - 1)) ** 0.5 if len(diffs) > 1 else 0.0
    return {
        "n": len(diffs),
        "meanSpecific": mean(s for s, _ in pairs),
        "meanNeutral": mean(n for _, n in pairs),
        "meanDiff": round(md, 3),
        "dz": round(md / sd, 3) if sd > 0 else None,
    }


def item_quality_mean(rating_rows: list[dict[str, Any]], participant_id: str, block_index: int, stage: str) -> float | None:
    item_id = blind_item_id(participant_id, block_index, stage)
    values = [
        score_mean(row["ratings"])
        for row in rating_rows
        if row["itemId"] == item_id and isinstance(row.get("ratings"), dict)
    ]
    values = [value for value in values if value is not None]
    return mean(values) if values else None


def calibration_score(decisions: list[dict[str, Any]], probe_validity: dict[str, str], strict: bool) -> float | None:
    if not decisions:
        return None
    good = 0
    for decision in decisions:
        validity = probe_validity.get(decision.get("probeId", ""))
        choice = decision.get("decision")
        if validity == "flawed" and choice in {"rejected", "questioned", "reframed"}:
            good += 1
        elif validity == "valid":
            if strict and choice == "accepted":
                good += 1
            elif not strict and choice in {"accepted", "reframed"}:
                good += 1
    return good / len(decisions)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--min-raters", type=int, default=3)
    parser.add_argument("--write-item-csv")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    participants = load_json_dir(data_dir / "participants")
    ratings = load_json_dir(data_dir / "ratings")
    events = []
    event_log = data_dir / "events.jsonl"
    if event_log.exists():
        with event_log.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    events.append(json.loads(line))

    completed = [p for p in participants if p.get("completedAt") or p.get("status") == "completed"]

    # Validity gates (per participant): attention check + both blocks have valid proposals.
    valid = []
    invalid_reasons: dict[str, int] = {}
    for participant in participants:
        reasons = []
        if (participant.get("preSurvey") or {}).get("attentionCheck") != 5:
            reasons.append("attention")
        for block in participant.get("blocks", []):
            if proposal_issues(block.get("initialProposal"), MIN_INITIAL_CHARS):
                reasons.append(f"block{block.get('index')}_initial")
            if proposal_issues(block.get("finalProposal"), MIN_FINAL_CHARS):
                reasons.append(f"block{block.get('index')}_final")
        if not participant.get("finalSurvey"):
            reasons.append("final_survey")
        if reasons:
            for reason in reasons:
                invalid_reasons[reason] = invalid_reasons.get(reason, 0) + 1
        else:
            valid.append(participant)

    # Blind rating coverage.
    rating_rows = [
        {"itemId": r.get("itemId"), "raterId": str(r.get("raterId") or "anonymous").strip().lower(), "ratings": r.get("ratings")}
        for r in ratings
        if r.get("itemId") and isinstance(r.get("ratings"), dict)
    ]
    expected_items = []
    for participant in participants:
        for block in participant.get("blocks", []):
            if block.get("initialProposal") and block.get("finalProposal"):
                for stage in ("initial", "final"):
                    expected_items.append(
                        {
                            "itemId": blind_item_id(participant["id"], block["index"], stage),
                            "participantId": participant["id"],
                            "blockIndex": block["index"],
                            "arm": block.get("arm"),
                            "stage": stage,
                        }
                    )
    raters_by_item: dict[str, set[str]] = {}
    for row in rating_rows:
        raters_by_item.setdefault(row["itemId"], set()).add(row["raterId"])
    coverage = [
        {
            **item,
            "ratedCount": len(raters_by_item.get(item["itemId"], set())),
            "neededRatings": max(0, args.min_raters - len(raters_by_item.get(item["itemId"], set()))),
        }
        for item in expected_items
    ]

    duplicate_ratings = 0
    seen_pairs = set()
    for row in rating_rows:
        pair = (row["itemId"], row["raterId"])
        if pair in seen_pairs:
            duplicate_ratings += 1
        seen_pairs.add(pair)

    reliability = {}
    for dimension in RATER_DIMENSIONS:
        groups = []
        for item in expected_items:
            groups.append(
                [
                    float(row["ratings"][dimension])
                    for row in rating_rows
                    if row["itemId"] == item["itemId"] and isinstance(row["ratings"].get(dimension), (int, float))
                ]
            )
        reliability[dimension] = krippendorff_alpha(groups)

    # Paired improvement contrast (specific block vs neutral block per participant).
    improvement_pairs: list[tuple[float, float]] = []
    for participant in participants:
        arm_block = {b.get("arm"): b for b in participant.get("blocks", [])}
        spec, neut = arm_block.get("specific"), arm_block.get("neutral")
        if not spec or not neut:
            continue
        spec_imp_i = item_quality_mean(rating_rows, participant["id"], spec["index"], "initial")
        spec_imp_f = item_quality_mean(rating_rows, participant["id"], spec["index"], "final")
        neut_imp_i = item_quality_mean(rating_rows, participant["id"], neut["index"], "initial")
        neut_imp_f = item_quality_mean(rating_rows, participant["id"], neut["index"], "final")
        if None not in (spec_imp_i, spec_imp_f, neut_imp_i, neut_imp_f):
            improvement_pairs.append(((spec_imp_f - spec_imp_i), (neut_imp_f - neut_imp_i)))

    # Paired calibration contrast from probe_decision events.
    probe_validity = {
        "A-valid-peer-ai-feedback": "valid", "A-flawed-privacy-collection": "flawed",
        "A-valid-behavioral-measures": "valid", "A-flawed-satisfaction-only": "flawed",
        "B-valid-second-opinion": "valid", "B-flawed-keylogging-collection": "flawed",
        "B-valid-decision-tracking": "valid", "B-flawed-confidence-only": "flawed",
    }
    decisions_by_pb: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for event in events:
        if event.get("type") == "probe_decision":
            payload = event.get("payload", {})
            key = (event.get("participantId"), payload.get("blockIndex"))
            decisions_by_pb.setdefault(key, []).append(payload)
    calibration_pairs: list[tuple[float, float]] = []
    for participant in participants:
        arm_block = {b.get("arm"): b for b in participant.get("blocks", [])}
        spec, neut = arm_block.get("specific"), arm_block.get("neutral")
        if not spec or not neut:
            continue
        spec_cal = calibration_score(decisions_by_pb.get((participant["id"], spec["index"]), []), probe_validity, strict=True)
        neut_cal = calibration_score(decisions_by_pb.get((participant["id"], neut["index"]), []), probe_validity, strict=True)
        if spec_cal is not None and neut_cal is not None:
            calibration_pairs.append((spec_cal, neut_cal))

    if args.write_item_csv:
        with Path(args.write_item_csv).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=["itemId", "participantId", "blockIndex", "arm", "stage", "ratedCount", "neededRatings"],
            )
            writer.writeheader()
            writer.writerows(coverage)

    summary = {
        "participants": {
            "created": len(participants),
            "completed": len(completed),
            "valid_by_quality_gates": len(valid),
            "invalid_reasons": invalid_reasons,
            "sequence_counts": {
                seq: sum(1 for p in participants if p.get("sequenceId") == seq) for seq in SEQUENCES
            },
        },
        "blind_rating": {
            "rating_files": len(ratings),
            "rating_rows": len(rating_rows),
            "expected_items": len(expected_items),
            "items_with_min_raters": sum(1 for item in coverage if item["ratedCount"] >= args.min_raters),
            "duplicate_item_rater_pairs": duplicate_ratings,
            "reliability_alpha_interval": reliability,
        },
        "paired_contrasts": {
            "improvement_specific_vs_neutral": paired_summary(improvement_pairs),
            "calibration_strict_specific_vs_neutral": paired_summary(calibration_pairs),
        },
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
