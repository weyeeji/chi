#!/usr/bin/env python3
"""Audit Study 1 recruitment, blind-rating coverage, and reliability.

The script intentionally uses only the Python standard library so it can run on
the study server without extra setup. It reads local JSON records from data/.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
from statistics import mean
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

PROPOSAL_FIELDS = [
    "problem",
    "users",
    "concept",
    "flow",
    "risks",
    "evaluation",
    "agency",
]

CONDITIONS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]


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


def blind_item_id(participant_id: str, stage: str) -> str:
    salt = os.environ.get("BLIND_ITEM_SALT", "role-specific-agent-personality-lab-v1")
    digest = hashlib.sha256(f"{salt}:{participant_id}:{stage}".encode("utf-8")).digest()
    import base64

    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")[:18]


def expand_ratings(ratings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for rating in ratings:
        participant_id = str(rating.get("participantId", ""))
        rater_id = str(rating.get("raterId") or "anonymous").strip().lower()
        stage = rating.get("stage")
        if stage in {"initial", "final"} and isinstance(rating.get("ratings"), dict):
            rows.append(
                {
                    "itemId": rating.get("itemId") or blind_item_id(participant_id, stage),
                    "participantId": participant_id,
                    "stage": stage,
                    "raterId": rater_id,
                    "ratings": rating["ratings"],
                }
            )
            continue
        for legacy_stage in ("initial", "final"):
            legacy_scores = rating.get(legacy_stage)
            if isinstance(legacy_scores, dict):
                rows.append(
                    {
                        "itemId": blind_item_id(participant_id, legacy_stage),
                        "participantId": participant_id,
                        "stage": legacy_stage,
                        "raterId": rater_id,
                        "ratings": legacy_scores,
                    }
                )
    return rows


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--min-raters", type=int, default=3)
    parser.add_argument("--write-item-csv")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    participants = load_json_dir(data_dir / "participants")
    ratings = load_json_dir(data_dir / "ratings")

    study1 = [record for record in participants if record.get("study") == "study1"]
    completed = [record for record in study1 if record.get("completedAt") or record.get("status") == "completed"]
    valid = []
    invalid_reasons: dict[str, int] = {}
    for participant in study1:
        reasons = []
        if participant.get("preSurvey", {}).get("attentionCheck") != 5:
            reasons.append("attention")
        if proposal_issues(participant.get("initialProposal"), 320):
            reasons.append("initial_proposal")
        if proposal_issues(participant.get("finalProposal"), 560):
            reasons.append("final_proposal")
        if not participant.get("postSurvey"):
            reasons.append("post_survey")
        if reasons:
            for reason in reasons:
                invalid_reasons[reason] = invalid_reasons.get(reason, 0) + 1
        else:
            valid.append(participant)

    rating_rows = expand_ratings(ratings)
    expected_items = [
        {
            "itemId": blind_item_id(participant["id"], stage),
            "participantId": participant["id"],
            "conditionId": participant.get("conditionId"),
            "stage": stage,
        }
        for participant in study1
        if participant.get("initialProposal") and participant.get("finalProposal")
        for stage in ("initial", "final")
    ]

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

    item_means: dict[tuple[str, str], list[float]] = {}
    for row in rating_rows:
        value = score_mean(row["ratings"])
        if value is not None:
            item_means.setdefault((row["participantId"], row["stage"]), []).append(value)

    participant_deltas = []
    for participant in study1:
        initial_values = item_means.get((participant["id"], "initial"), [])
        final_values = item_means.get((participant["id"], "final"), [])
        if len(initial_values) >= args.min_raters and len(final_values) >= args.min_raters:
            participant_deltas.append(
                {
                    "participantId": participant["id"],
                    "conditionId": participant.get("conditionId"),
                    "initialMean": mean(initial_values),
                    "finalMean": mean(final_values),
                    "delta": mean(final_values) - mean(initial_values),
                }
            )

    if args.write_item_csv:
        with Path(args.write_item_csv).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=["itemId", "participantId", "conditionId", "stage", "ratedCount", "neededRatings"],
            )
            writer.writeheader()
            writer.writerows(coverage)

    summary = {
        "participants": {
            "study1_created": len(study1),
            "study1_completed": len(completed),
            "study1_valid_by_quality_gates": len(valid),
            "invalid_reasons": invalid_reasons,
            "condition_counts_valid": {
                condition: sum(1 for participant in valid if participant.get("conditionId") == condition)
                for condition in CONDITIONS
            },
        },
        "blind_rating": {
            "rating_files": len(ratings),
            "rating_rows": len(rating_rows),
            "expected_items": len(expected_items),
            "items_with_min_raters": sum(1 for item in coverage if item["ratedCount"] >= args.min_raters),
            "duplicate_item_rater_pairs": duplicate_ratings,
            "reliability_alpha_interval": reliability,
            "participant_deltas_with_min_raters": len(participant_deltas),
        },
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
