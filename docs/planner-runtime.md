# Planner Runtime Architecture

LobsterMind's long-term model integration direction is:

1. a planner runtime that prepares model-facing tool definitions and validates model output
2. a provider adapter that speaks to a specific model runtime or bridge
3. a trusted executor that evaluates policy, approvals, and audit before doing anything on the machine

That separation is now explicit in the codebase.

## What exists today

- `src/brain/planner-runtime.ts` is the planner runtime.
- `src/brain/planning-envelope.ts` defines the provider-neutral planning envelope plus normalization and validation.
- `src/brain/tool-schema.ts` exports model-facing tool definitions from the capability registry.
- `src/brain/runtime-target.ts` normalizes provider/model/runtime-api config into a planner runtime target.
- `src/auth/auth-profile-store.ts` persists minimal provider auth profiles under `data/auth-profiles.json`.
- `src/brain/codex-provider.ts` is an experimental Codex CLI bridge runtime implementation.
- `src/executor/` remains the only place where real execution happens.

The planner runtime accepts provider output in a `planner-envelope.v1` structure and can currently return four structured outcomes:

- `request`: one capability selection with structured input
- `clarification`: ask the user for missing information
- `refusal`: decline a request the planner should not support
- `unsupported`: explain that the registered tools cannot represent the request

Each envelope also carries:

- provider metadata
- a request trace id
- diagnostics for validation, normalization, or provider-specific warnings
- optional raw output for debugging and inspection

## What is not implemented yet

There is not yet a native `openai-responses` or `openai-codex-responses` integration in this repository.

The current `experimental-codex-cli-bridge` runtime is a bridge that shells out to the local Codex CLI, asks for one structured planning decision, and parses the result back into LobsterMind's runtime contract. It is useful for experimentation and local fallback, but it is not the intended long-term primary architecture.

The auth-profile store is intentionally minimal. Today it only supports:

- persisted profile records with `provider` and `mode`
- default-profile lookup by provider
- plain JSON storage in the project data directory

It does not yet handle refresh flows, secure secret storage, or external credential sync.

The runtime now validates provider output before trusting it. Invalid output is converted into a structured `unsupported` result with diagnostics instead of being treated as an executable capability request.

## Intended long-term direction

The target architecture is:

- normalized model references such as `openai/gpt-5.4` and `openai-codex/gpt-5.4` resolve into runtime targets
- tool-capable models such as GPT-5.4 plan through a provider abstraction
- the provider consumes LobsterMind's exported tool schemas instead of ad-hoc prompt-only descriptions
- the provider returns a provider-neutral planning envelope that the runtime validates
- the model never executes machine actions directly
- LobsterMind's capability registry, policy engine, approval queue, executor adapters, and audit log remain the trusted execution layer

That means future providers should plug into the planner runtime contract instead of bypassing it.

## Tool schema export

The runtime exports a model-facing tool catalog from the capability registry.

Each tool entry includes:

- capability name
- human description
- supported and default execution profiles
- a structured JSON-schema-like input description where practical

The HTTP server exposes the current exported planner tools at `GET /planner/tools`.
The HTTP server and CLI also expose an inspection path that plans without executing:

- `POST /planner/plan`
- `npm run cli -- planner-plan "<intent>"`

Those surfaces are intended for provider debugging, snapshot testing, and migration work.

## Migration path

The intended migration from the experimental bridge to a future native tool-calling runtime is:

1. keep `src/brain/tool-schema.ts` as the single export path for model-facing tool schemas
2. implement a new runtime backend for `openai-responses` or `openai-codex-responses` that fills the same `PlannerProvider` contract
3. return `planner-envelope.v1` objects from that provider
4. let `src/brain/planner-runtime.ts` keep enforcing capability/profile validation and metadata normalization
5. keep `src/executor/` as the only execution layer

That means a future direct runtime backend should sit beside or replace `src/brain/codex-provider.ts`, not bypass the planner runtime or executor pipeline.

## Compatibility

The older `brain` naming is still present in the runtime types and app wiring so the current system stays runnable.

That naming should now be read as a compatibility alias around the planner runtime, not as a claim that LobsterMind's long-term architecture is a Codex CLI based brain.
