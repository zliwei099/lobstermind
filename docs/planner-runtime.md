# Planner Runtime Architecture

LobsterMind's long-term model integration direction is:

1. a planner runtime that prepares model-facing tool definitions
2. a provider adapter that speaks to a specific model runtime
3. a trusted executor that evaluates policy, approvals, and audit before doing anything on the machine

That separation is now explicit in the codebase.

## What exists today

- `src/brain/planner-runtime.ts` is the planner runtime.
- `src/brain/tool-schema.ts` exports model-facing tool definitions from the capability registry.
- `src/brain/codex-provider.ts` is an experimental Codex CLI bridge provider.
- `src/executor/` remains the only place where real execution happens.

The planner runtime can currently return four structured outcomes:

- `request`: one capability selection with structured input
- `clarification`: ask the user for missing information
- `refusal`: decline a request the planner should not support
- `unsupported`: explain that the registered tools cannot represent the request

## What is not implemented yet

There is not yet a direct official GPT-5.4 runtime integration in this repository.

The current `codex-cli` provider is a bridge that shells out to the local Codex CLI, asks for one structured planning decision, and parses the result back into LobsterMind's runtime contract. It is useful for experimentation and local fallback, but it is not the intended long-term primary architecture.

## Intended long-term direction

The target architecture is:

- tool-capable models such as GPT-5.4 plan through a provider abstraction
- the provider consumes LobsterMind's exported tool schemas instead of ad-hoc prompt-only descriptions
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

## Compatibility

The older `brain` naming is still present in the runtime types and app wiring so the current system stays runnable.

That naming should now be read as a compatibility alias around the planner runtime, not as a claim that LobsterMind's long-term architecture is a Codex CLI based brain.
