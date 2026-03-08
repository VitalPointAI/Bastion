# Training / Operational Mode

BASTION implements a global mode toggle that separates training exercises from operational use, following the **"train as you fight"** design principle — the tools and workflows are identical in both modes.

## Global Toggle

A top-level application toggle switches between:

- **Training Mode** — for exercises, wargames, and course of action analysis.
- **Operational Mode** — for real-world planning and execution.

The toggle is set at the application level and affects all users in the current session.

## Training Mode

When training mode is active:

- An **amber EXERCISE banner** is displayed at the top of the application.
- **EXERCISE watermarks** appear on all exported documents and screenshots.
- All data is written to a **training-isolated context** — no contamination of operational data.
- AI agents operate against exercise scenario data only.

These visual indicators ensure participants always know they are working in a training environment, preventing accidental confusion with operational systems.

## Operational Mode

When operational mode is active:

- The UI is **clean** — no banners or watermarks.
- Data is written to the **operational context**.
- AI agents operate against real-world data and intelligence products.

## Governance Parity

DAO governance works identically in both modes:

- Proposals, voting, quorum rules, and role-weighted decisions follow the same process.
- Training exercises practice the full governance workflow so operators are proficient when it matters.
- This parity is intentional — governance shortcuts in training would create bad habits.

## Reset and Checkpoint

Training mode supports exercise iteration:

- **Checkpoint** — save the current exercise state (database snapshot) at any point.
- **Reset** — restore to a previous checkpoint to re-run a phase or decision point.
- **Full reset** — return to the initial scenario seed state.

This allows facilitators to replay critical decision points, explore alternative courses of action, or restart after a teaching moment.

## After-Action Review

Training exercises capture data for post-exercise analysis:

- Decision logs with timestamps and rationale.
- AI agent recommendations and whether they were accepted or overridden.
- Planning timeline and phase gate completion metrics.
- Staff role participation and collaboration patterns.

This data supports structured after-action reviews (AARs) and feeds into future exercise design.
