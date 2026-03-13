# Experimental Codex CLI Planner Bridge

LobsterMind now has a planner runtime for natural-language requests that are too complex or ambiguous for the built-in rule matcher.

This document describes the current Codex CLI bridge provider. It is implemented today, but it is experimental and should be treated as a temporary fallback rather than LobsterMind's long-term primary architecture.

The planner runtime does not execute actions. It only returns structured planning outputs inside a provider-neutral `planner-envelope.v1`:

- a `CapabilityRequest`
- a clarification question
- a refusal
- an unsupported response

Execution still goes through the existing capability registry, policy evaluation, approval queue, executor adapters, and audit log.

## Flow

1. User text enters the agent.
2. `src/agent/planner.ts` runs the fast rule-based planner first.
3. If no rule matches and `LOBSTERMIND_BRAIN_ENABLED=true`, LobsterMind calls the configured planner provider.
4. The provider returns JSON for either:
   - `decision.kind: "request"` with a structured capability request
   - `decision.kind: "clarification"` with a follow-up question
   - `decision.kind: "refusal"`
   - `decision.kind: "unsupported"`
5. LobsterMind validates and normalizes that envelope.
6. Only a validated capability request is submitted through the normal executor path.

## Configuration

Add these variables to `.env`:

```dotenv
LOBSTERMIND_BRAIN_ENABLED=true
LOBSTERMIND_BRAIN_PROVIDER=codex-cli
LOBSTERMIND_BRAIN_MODEL=gpt-5.4
```

Supported providers:

- `codex-cli`: calls the local `codex` CLI and uses its existing OAuth session
- `mock`: returns a deterministic clarification response for local testing

`LOBSTERMIND_BRAIN_PROVIDER=codex` is still accepted as a backward-compatible alias and normalizes to `codex-cli`.

The runtime also accepts an optional override:

```dotenv
LOBSTERMIND_BRAIN_CODEX_COMMAND=codex
```

That is only needed if the CLI binary is not on `PATH`.

## Codex OAuth setup

The Codex CLI bridge does not use OpenAI API keys directly. It shells out to the local Codex CLI and relies on the login state already stored by that tool.

Typical setup:

```bash
codex login
codex exec --model gpt-5.4 "Reply with a short JSON object."
```

If the second command works from your terminal, LobsterMind can usually use the same OAuth session.

## Bridge behavior

The experimental bridge currently runs:

- `codex exec`
- `--model <LOBSTERMIND_BRAIN_MODEL>`
- `--sandbox read-only`
- `--output-schema <temp schema file>`
- `--output-last-message <temp output file>`

The planner request contains:

- the raw user intent
- the model-facing tool catalog exported from the capability registry
- a trace id that must be echoed back
- examples of valid request, clarification, refusal, and unsupported responses

The provider writes a JSON schema to a temp directory, asks Codex for a single structured planning response, reads the last message back, parses it, and then deletes the temp files.

## Example

User message:

```text
Check the README in this repo and tell me if there is a setup section
```

Possible brain response:

```json
{
  "version": "planner-envelope.v1",
  "traceId": "example-trace-id",
  "diagnostics": [],
  "decision": {
    "kind": "request",
    "request": {
      "capability": "fs.read",
      "input": {
        "path": "README.md"
      },
      "requestedProfile": "readonly",
      "metadata": {
        "sourceCommand": "planner-runtime",
        "note": "Read the README to inspect setup instructions"
      }
    }
  }
}
```

Clarification example:

```json
{
  "version": "planner-envelope.v1",
  "traceId": "example-trace-id",
  "diagnostics": [],
  "decision": {
    "kind": "clarification",
    "clarification": {
      "text": "Which URL should I open?"
    }
  }
}
```

Unsupported example:

```json
{
  "version": "planner-envelope.v1",
  "traceId": "example-trace-id",
  "diagnostics": [],
  "decision": {
    "kind": "unsupported",
    "unsupported": {
      "text": "I can only plan actions that map to the registered capability tools.",
      "reason": "no_matching_tool"
    }
  }
}
```

## Failure handling

If the planner runtime is disabled, LobsterMind behaves exactly as before.

If the planner runtime is enabled but unavailable, LobsterMind:

- logs a warning
- skips direct execution
- falls back to memory/help behavior

Common failure cases:

- `codex` is not installed or not on `PATH`
- the local Codex session is not logged in
- the provider returns invalid JSON
- the model suggests an unsupported capability or profile
- the provider returns the wrong trace id or malformed envelope

Those failures do not bypass policy or execution controls because the provider never executes actions directly.

When the bridge returns malformed planner output that can be parsed but not trusted, LobsterMind converts that into a structured `unsupported` result with diagnostics. Transport or CLI failures still surface as provider errors, which lets the agent fall back honestly instead of pretending planning succeeded.
