# Study 1 Pre-Registration Draft

## Study Title

Role-Specific Agent Personality in Human-Agent Team Collaboration

## Primary Research Question

Which role-specific agent personality expressions improve human-agent team collaboration, and through which role-matched outcomes?

## Design

Study 1 uses an L8 fractional factorial ablation design with four binary factors:

- Coordinator: neutral vs structured facilitator
- Ideator: neutral vs exploratory creator
- Critic: neutral vs constructive skeptic
- Verifier: neutral vs calibrated verifier

The eight conditions estimate main effects. Two-way interactions are exploratory because the L8 design aliases interaction terms.

## Construct and Estimand

The manipulation varies the **expression strength of a role-congruent behavioral style**, not the presence versus absence of a functional role. In every condition all four agents retain their functional role instruction (the Critic still critiques, the Verifier still checks). The "neutral" level expresses that role in a flat, un-amplified voice; the "specific" level amplifies the role-congruent behavioral stance and linguistic style.

The causal estimand for each factor is therefore the marginal effect of amplified role-congruent personality expression, holding functional role, expertise, turn order, model, and token budget constant. We do not claim that role and personality are fully orthogonal; we claim that personality expression strength is manipulable independently of which role an agent performs.

## Power Analysis

The confirmatory tests are the four personality-by-stage interaction terms in the item-level mixed model. Power is determined by simulation rather than asserted.

- Smallest effect size of interest (SESOI): a personality-by-stage interaction equal to 0.30 SD on the 1-7 blind-rating scale (a one-third standard-deviation shift in initial-to-final improvement attributable to a single role's personality).
- Assumptions to be fixed before data collection: 3 ratings per item, rater random-effect ICC in the 0.5-0.7 range, participant random intercept, residual SD estimated from Study 0 pilot ratings.
- Procedure: simulate the full mixed model 1,000 times at candidate sample sizes (320, 400, 480) under the L8 assignment, recover each of the four personality-by-stage terms, and report power as the proportion of simulations with a significant term at the Bonferroni-adjusted alpha for four primary tests.
- Decision rule: select the smallest N achieving at least 0.80 power for all four primary terms at the SESOI. The target of 400 valid participants (50 per condition) is provisional and will be confirmed or revised by this simulation before recruitment.
- The simulation script is included in the supplement.

## Target Sample

Target valid sample: 400 participants, 50 per condition.

Minimum acceptable valid sample for submission: 320 participants, 40 per condition.

Recruitment should continue until valid-sample quotas, not only created-session quotas, are balanced across conditions.

## Valid Sample Criteria

A participant is valid if all criteria are met:

- consent accepted;
- pre-survey submitted;
- attention check passed by selecting exactly 5 on the instructed item;
- initial proposal submitted and passed the minimum content gate: all seven fields contain at least 18 characters, with at least 320 total characters;
- all four collaboration rounds completed;
- all revealed seeded suggestions handled with accept, reject, question, or reframe;
- final proposal submitted and passed the minimum content gate: all seven fields contain at least 18 characters, with at least 560 total characters;
- post-survey submitted;
- no technical failure invalidates the agent condition assignment;
- no agent turn used a condition-incongruent fallback. The system logs `usedFallback` and `level` per turn; any fallback in a neutral cell that could inject specific-voiced text invalidates the session for confirmatory analysis.

## Exclusion Criteria

Exclude before outcome analysis:

- failed attention check;
- duplicate participant code, keeping the first complete valid session unless a documented technical failure occurred;
- initial or final proposal that is nonsensical, copied from instructions, or not in the task domain;
- completion time below one third of the intended minimum duration;
- missing agent logs for one or more system-orchestrated rounds;
- agent API fallback in more than one role turn, unless the analysis is explicitly marked as a robustness check;
- seeded-suggestion delivery failure: the system verifies (verbatim or high lexical overlap) that each seeded suggestion was actually emitted by its source agent. Participants for whom a probe was not faithfully delivered are excluded from the calibrated-reliance analysis for that probe, and delivery rate is reported per probe and per condition as a manipulation check.

All exclusions will be reported with counts by condition.

## Primary Outcome

Blind-rated proposal improvement.

Initial and final proposals are rated as anonymous single items. Raters do not see condition id, participant id, or whether an item is initial or final. The rater client receives only an opaque item id; participant id and stage are resolved server-side after submission. The primary improvement score is final minus initial at the participant level after aggregating rater scores.

Rating dimensions:

- problem framing
- novelty
- feasibility
- risk awareness
- user agency
- evaluation rigor
- overall CHI potential

Each item should receive at least three independent ratings. Report inter-rater reliability using ICC or Krippendorff's alpha. Items below the three-rater threshold are retained for monitoring but excluded from confirmatory participant-level improvement analyses unless otherwise stated as sensitivity analysis.

## Primary Model

Item-level mixed model:

```text
Rating ~ Stage
       + CoordinatorPersonality * Stage
       + IdeatorPersonality * Stage
       + CriticPersonality * Stage
       + VerifierPersonality * Stage
       + Topic
       + AI_Familiarity
       + Domain_Familiarity
       + CreativeSelfEfficacy
       + (1 | Participant)
       + (1 | Rater)
```

The primary tests are the four personality-by-stage terms. These estimate whether a role-specific personality changes improvement from initial to final proposal.

Participant-level robustness model:

```text
Improvement ~ CoordinatorPersonality
            + IdeatorPersonality
            + CriticPersonality
            + VerifierPersonality
            + InitialQuality
            + Topic
            + AI_Familiarity
            + Domain_Familiarity
            + CreativeSelfEfficacy
```

## Role-Matched Secondary Outcomes

Coordinator:

- cognitive load;
- time to workspace completion;
- unresolved branch count from behavioral coding;
- role-targeted coordination questions.

Ideator:

- distinct concept count;
- blind-rated novelty;
- conceptual flexibility from behavioral coding.

Critic:

- critical depth;
- revision depth;
- constructive conflict;
- perceived pressure.

Verifier:

- calibrated reliance score;
- evidence seeking;
- risk awareness;
- evaluation rigor.

## Calibrated Reliance

Seeded suggestions are embedded in source-role agent turns during rounds 2-4. The decision board records participant handling.

Valid suggestions count as calibrated when accepted or reframed. Flawed suggestions count as calibrated when rejected, questioned, or reframed. This is the lenient scoring rule.

A strict scoring rule is also pre-registered to guard against a participant who reframes everything scoring as perfectly calibrated: under the strict rule, reframe counts as calibrated only for flawed suggestions, and valid suggestions require outright acceptance. Both lenient and strict calibration are reported; the strict variant is the confirmatory measure and the lenient variant is a sensitivity analysis.

Flawed suggestions are sourced from roles not charged with catching that specific flaw (for example, the privacy flaw is not sourced from the Verifier and the autonomy flaw is not sourced from the Critic) so that probe visibility does not vary with the personality factor being estimated.

Report probe-level distributions as well as aggregate calibration score.

## Capability Parity and Confound Checks

The following are pre-registered confound checks, not outcomes:

- Response length: mean agent response length (words) is compared between neutral and specific levels within each role. A pre-registered parity band is +/- 15% of the neutral mean. If a role violates the band, response length is entered as a covariate in that role's models and the violation is reported.
- Latency and token estimates are monitored per role and level.
- Turn order is fixed (Coordinator, Ideator, Critic, Verifier) in every condition and round. All effects are estimated under this fixed, ecologically-motivated order; serial position is confounded with role and this is stated as a scope condition, not corrected by the design.
- Rater stage-blinding: raters answer a stage-guess item per item; guess accuracy above chance is reported and, if substantial, length-adjusted improvement is reported as a robustness analysis.

## Multiple Testing

Primary tests are limited to the four personality-by-stage terms. Secondary outcomes are interpreted as role-matched support. Exploratory interactions are reported separately and labelled exploratory.

Use confidence intervals and standardized effect sizes for all main claims.

## Transparency Materials

The anonymized supplement should include:

- prompt/personality configuration;
- Study 0 material pool;
- Study 1 survey text;
- L8 assignment matrix;
- seeded suggestion list;
- behavioral codebook;
- blind rating rubric;
- analysis code, including the Study 1 quality audit script for sample gates, blind-rating coverage, duplicate ratings, and reliability;
- de-identified aggregate data or a synthetic dataset if raw text cannot be shared.
