# Brain Layer With Codex OAuth

LobsterMind now has a separate brain layer for planning natural-language requests that are too complex or ambiguous for the built-in rule matcher.

The brain does not execute actions. It only returns one of two structured outputs:

- a `CapabilityRequest`
- a clarification question

Execution still goes through the existing capability registry, policy evaluation, approval queue, executor adapters, and audit log.

## Flow

1. User text enters the agent.
2. `src/agent/planner.ts` runs the fast rule-based planner first.
3. If no rule matches and `LOBSTERMIND_BRAIN_ENABLED=true`, LobsterMind calls the configured brain provider.
4. The brain returns JSON for either:
   - `action: "request"` with a structured capability request
   - `action: "clarification"` with a follow-up question
5. The returned capability request is submitted through the normal executor path.

## Configuration

Add these variables to `.env`:

```dotenv
LOBSTERMIND_BRAIN_ENABLED=true
LOBSTERMIND_BRAIN_PROVIDER=codex
LOBSTERMIND_BRAIN_MODEL=gpt-5.4
```

Supported providers:

- `codex`: calls the local `codex` CLI and uses its existing OAuth session
- `mock`: returns a deterministic clarification response for local testing

The runtime also accepts an optional override:

```dotenv
LOBSTERMIND_BRAIN_CODEX_COMMAND=codex
```

That is only needed if the CLI binary is not on `PATH`.

## Codex OAuth setup

The Codex provider does not use OpenAI API keys. It shells out to the local Codex CLI and relies on the login state already stored by that tool.

Typical setup:

```bash
codex login
codex exec --model gpt-5.4 "Reply with a short JSON object."
```

If the second command works from your terminal, LobsterMind can usually use the same OAuth session.

## Provider behavior

The Codex provider currently runs:

- `codex exec`
- `--model <LOBSTERMIND_BRAIN_MODEL>`
- `--sandbox read-only`
- `--output-schema <temp schema file>`
- `--output-last-message <temp output file>`

The planner prompt contains:

- the raw user intent
- the list of registered capabilities
- the supported execution profiles
- examples of valid request and clarification responses

The provider writes a JSON schema to a temp directory, asks Codex for a single structured response, reads the last message back, parses it, and then deletes the temp files.

## Example

User message:

```text
Check the README in this repo and tell me if there is a setup section
```

Possible brain response:

```json
{
  "action": "request",
  "request": {
    "capability": "fs.read",
    "input": {
      "path": "README.md"
    },
    "requestedProfile": "readonly",
    "metadata": {
      "sourceCommand": "brain",
      "note": "Read the README to inspect setup instructions"
    }
  }
}
```

Clarification example:

```json
{
  "action": "clarification",
  "clarification": {
    "text": "Which URL should I open?"
  }
}
```

## Failure handling

If the brain is disabled, LobsterMind behaves exactly as before.

If the brain is enabled but unavailable, LobsterMind:

- logs a warning
- skips direct execution
- falls back to memory/help behavior

Common failure cases:

- `codex` is not installed or not on `PATH`
- the local Codex session is not logged in
- the provider returns invalid JSON
- the model suggests an unsupported capability

Those failures do not bypass policy or execution controls because the brain never executes actions directly.
