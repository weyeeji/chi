# Pre-Registration Draft

## Study Title

Role-Specific Agent Personality in Human-Agent Team Collaboration: A Within-Subjects Study

## Research Questions

- **RQ1 (Output & reliance).** Compared with a neutral-personality agent team, does a role-specific-personality team improve the human collaborator's task output quality and calibrated reliance on seeded suggestions?
- **RQ2 (Experience & cost).** How does role-specific personality affect the collaboration experience — role legibility, cognitive load, constructive conflict, perceived pressure, and user autonomy — and what trade-offs does it introduce?

## Design

A within-subjects (repeated-measures) A/B design. Each participant completes **two collaboration blocks** with the same four-role team (Coordinator, Ideator, Critic, Verifier):

- one block with a **neutral** personality expression for every agent;
- one block with a **role-specific** personality expression for every agent.

The two blocks use two matched design briefs (Topic A: student AI literacy; Topic B: workplace AI advice). Arm order and the arm-to-topic mapping are counterbalanced over four sequences (S1–S4), assigned round-robin by intake order.

In both arms the agents' functional role, expertise, count, orchestration, turn order, model, token budget, and UI are identical. The only systematic change is whether each role uses its role-specific personality expression.

## Construct and Estimand

The manipulation varies the **expression strength of a role-congruent behavioral style**, not the presence versus absence of a functional role. In both arms all four agents retain their role instruction (the Critic still critiques, the Verifier still checks). The neutral arm expresses each role in a flat, distinguishable-but-un-amplified voice; the specific arm amplifies the role-congruent behavioral stance and linguistic style.

The causal estimand is the **within-participant marginal effect of amplified role-congruent personality expression**, holding functional role, expertise, turn order, model, and token budget constant. We do not claim that role and personality are fully orthogonal; we claim that personality expression strength is manipulable independently of which role an agent performs. Because each participant is their own control, between-person variation in skill, motivation, and AI familiarity is differenced out.

## Target Sample

Target valid sample: **16–20 participants** (each contributing one neutral and one specific block). With paired observations and an anticipated medium-to-large within-person effect on the primary outcomes, this sample supports interpretable paired effect-size estimates. We report effect sizes with bootstrap confidence intervals rather than relying on a single significance threshold, in line with CHI guidance on small-sample reporting.

Counterbalance balance target: each of the four sequences assigned to at least four participants where possible.

## Valid Sample Criteria

A participant is valid if all criteria are met:

- consent accepted;
- pre-survey submitted; attention check passed (selected exactly 5 on the instructed item);
- **both** blocks: initial proposal submitted and passing the content gate (every field ≥ 18 characters, ≥ 280 total characters);
- **both** blocks: all revealed seeded suggestions handled (accept / reject / question / reframe);
- **both** blocks: final proposal submitted and passing the content gate (every field ≥ 18 characters, ≥ 480 total characters);
- both block surveys and the final comparison survey submitted;
- no condition-incongruent fallback: any API fallback in a neutral block that could inject specific-voiced text invalidates that participant for confirmatory analysis (the system logs `usedFallback` and `arm` per turn).

## Exclusion Criteria

Exclude before outcome analysis:

- failed attention check;
- a proposal that is nonsensical, copied from instructions, or off-domain;
- completion time below one third of the intended minimum;
- missing agent logs for one or more orchestrated rounds in either block;
- seeded-suggestion delivery failure: the system verifies (verbatim or high lexical overlap) that each seeded suggestion was emitted by its source agent. A probe not faithfully delivered is excluded from that participant's calibrated-reliance analysis for that probe; delivery rate is reported per probe and per arm.

All exclusions are reported with counts by sequence.

## Primary Outcomes

1. **Blind-rated proposal improvement** (per block): final-minus-initial mean rubric score. Initial and final proposals are rated as anonymous single items; raters never see the arm, the topic-arm mapping, the participant id, or whether an item is initial or final. Each item receives at least three independent ratings. Rubric dimensions: problem framing, novelty, feasibility, risk awareness, user agency, evaluation rigor, overall CHI potential. Report inter-rater reliability (Krippendorff's α).
2. **Calibrated reliance** (per block): proportion of seeded suggestions handled in line with their true validity.

## Primary Tests

Per-participant paired contrasts (specific block minus neutral block):

1. proposal improvement;
2. calibrated reliance (strict scoring);
3. role legibility;
4. perceived pressure.

For each, report the mean paired difference, paired Cohen's dz, a bootstrap 95% CI, and a Wilcoxon signed-rank test (preferred at small N; paired t as a sensitivity check).

## Calibrated Reliance Scoring

Each topic carries four matched seeded suggestions (two valid, two flawed) embedded in source-role agent turns during rounds 2–3. The decision board records participant handling.

- **Lenient (sensitivity):** valid = accepted or reframed; flawed = rejected, questioned, or reframed.
- **Strict (confirmatory):** flawed = rejected, questioned, or reframed; valid requires outright acceptance. Guards against "reframe everything" scoring as perfectly calibrated.

Flawed suggestions are sourced from roles **not** charged with catching that flaw (the privacy flaw from the Ideator, the weak-evaluation flaw from the Coordinator), so probe visibility does not vary with the personality manipulation. The two topics use a one-to-one matched probe set so calibration scores are comparable across blocks.

## Secondary Outcomes (paired contrasts)

- cognitive load (NASA-TLX short);
- role legibility;
- constructive conflict;
- perceived pressure;
- user autonomy (ownership, reject-without-penalty);
- in-context perceived-personality items (manipulation check: the specific arm should read as more structured / exploratory / skeptical / calibrated).

## Robustness and Confound Checks

- **Mixed model (exploratory):** `Rating ~ Stage * Arm + Topic + (1|Participant) + (1|Rater)` to confirm the paired contrast is robust to topic and rater variation.
- **Order effect:** block order entered as a covariate to check for practice/fatigue.
- **Response-length parity:** mean agent response length (words) compared between arms within each role; pre-registered band ±15% of the neutral mean. If violated, length is entered as a covariate.
- **Manipulation check:** the specific arm must score higher than the neutral arm on the matched in-context personality items (paired difference > 0); otherwise the manipulation is treated as ineffective.
- **Fallback audit:** `fallbackByArm` reported; any specific-voiced fallback in a neutral block invalidates that session for confirmatory analysis.
- **Rater stage-blinding:** the final proposal is longer than the initial; we report a length-adjusted improvement as a robustness analysis.

## Multiple Testing

Four primary tests; report with confidence intervals and standardized effect sizes. Secondary outcomes are interpreted as supporting evidence. Any interaction or moderator analysis is exploratory and labelled as such.

## Ethics

The study deliberately seeds flawed suggestions (default collection of private data; satisfaction/confidence-only evaluation) without prior disclosure, because forewarning would make calibrated reliance unmeasurable. A **mandatory debrief** reveals which suggestions were seeded flawed and why, with a do-not-implement note. No real names, grades, or sensitive identity data are collected.

## Transparency Materials

The anonymized supplement should include:

- prompt/personality configuration (`server/agent-personalities.json`);
- the two topics and the matched seeded-suggestion list (`src/shared/experiment.ts`);
- survey text (pre-survey, block survey, final comparison survey);
- counterbalance sequence table;
- behavioral codebook;
- blind-rating rubric;
- analysis code, including the quality-audit script (sample gates, coverage, duplicate ratings, reliability, paired contrasts);
- de-identified aggregate data or a synthetic dataset if raw text cannot be shared.
