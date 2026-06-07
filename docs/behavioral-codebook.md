# Behavioral Coding Codebook

## Scope

This codebook applies to Study 1 interaction logs, initial proposals, final proposals, seeded suggestion decisions, and optional probe decision notes.

Two human coders should independently code at least 25-30% of sessions. Resolve disagreements by discussion, revise the codebook, then code the remaining sessions. Report inter-rater reliability for each construct before adjudication.

## Unit of Analysis

Use three units:

- Turn-level: one user or agent message.
- Suggestion-level: one identifiable recommendation, including seeded suggestions.
- Proposal-level: initial and final structured proposals.

## C1. Role-Targeted Question

Definition: A user message directed to one role or clearly asking for that role's function.

Codes:

- 0 = not role-targeted;
- 1 = role-targeted to Coordinator;
- 2 = role-targeted to Ideator;
- 3 = role-targeted to Critic;
- 4 = role-targeted to Verifier;
- 5 = role-targeted to all agents.

Examples:

- "Can the Verifier check privacy risks?" -> 4
- "Give me more alternatives." sent to Ideator -> 2

## C2. Evidence Seeking

Definition: The user requests evidence, criteria, comparison, measurement, source quality, privacy justification, or evaluation rigor.

Codes:

- 0 = absent;
- 1 = weak or generic evidence request;
- 2 = specific evidence criterion or comparison requested;
- 3 = evidence request changes the proposal or decision.

## C3. Critical Engagement

Definition: The user engages with assumptions, trade-offs, failure cases, or limitations raised by the Critic or other agents.

Codes:

- 0 = ignores critique;
- 1 = acknowledges critique without change;
- 2 = discusses critique or asks for clarification;
- 3 = substantively revises the proposal because of critique.

## C4. Suggestion Uptake

Definition: How the participant handles an identifiable agent suggestion.

Codes:

- 0 = adopted without change;
- 1 = ignored;
- 2 = questioned;
- 3 = rejected;
- 4 = reframed or adapted;
- 5 = deferred for later decision.

Seeded suggestion board mapping:

- accepted -> 0
- rejected -> 3
- questioned -> 2
- reframed -> 4

## C5. Calibrated Reliance

Definition: Whether participant handling matches suggestion validity.

Codes:

- 0 = uncalibrated uptake or rejection;
- 1 = partially calibrated, with weak justification;
- 2 = calibrated handling with explicit reason;
- 3 = calibrated handling that improves the final proposal.

Valid suggestions are calibrated when accepted or reframed. Flawed suggestions are calibrated when rejected, questioned, or reframed.

## C6. Idea Breadth

Definition: Number of distinct solution concepts considered during collaboration.

Count distinct concepts, not minor wording variants. A concept is distinct if it changes the mechanism, target behavior, data flow, feedback mode, or evaluation approach.

Report:

- raw count;
- count adopted into final proposal;
- count discarded after critique or verification.

## C7. Conceptual Flexibility

Definition: Movement across different design directions.

Codes:

- 0 = no shift from initial idea;
- 1 = minor feature addition;
- 2 = shifts mechanism or interaction flow;
- 3 = reframes problem, target user, or evaluation logic.

## C8. Coordination Efficiency

Definition: Whether the session converges toward a coherent final proposal without unresolved branches.

Codes:

- unresolved branch count;
- time to first concrete plan;
- number of explicit summaries;
- number of user requests for clarification about next steps.

## C9. Revision Depth

Definition: How substantively the final proposal changes relative to the initial proposal.

Codes:

- 0 = no meaningful change;
- 1 = surface edits or wording only;
- 2 = adds details to existing concept;
- 3 = changes risks, evaluation, or agency safeguards;
- 4 = changes core concept or problem framing with coherent justification.

## C10. User Autonomy Defense

Definition: The participant preserves ownership by rejecting, qualifying, or overriding agent suggestions.

Codes:

- 0 = no autonomy defense;
- 1 = simple rejection without reason;
- 2 = rejection or qualification with reason;
- 3 = user explicitly defines decision criteria or overrides agent direction while preserving useful parts.

## C11. Pressure Moment

Definition: Evidence that an agent's style created social pressure, discomfort, or reduced sense of control.

Codes:

- 0 = absent;
- 1 = mild pressure implied;
- 2 = explicit pressure or discomfort;
- 3 = pressure changes behavior or is mentioned in post-survey open response.

## C12. Final Proposal Risk/Evaluation Quality

For proposal-level coding, score each dimension 1-7 using the blind rating rubric:

- risk awareness;
- evaluation rigor;
- user agency.

Coders should not use condition id while coding proposal quality.
