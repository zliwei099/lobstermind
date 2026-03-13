# Feishu Long Connection Note

For LobsterMind as a personal desktop agent, long connection is the better default than a webhook-first deployment model.

## Why

- A desktop agent usually runs on one trusted Mac, not behind a public internet endpoint.
- Feishu can stay connected to the local runtime directly, which removes the need for tunnels, reverse proxies, and webhook exposure just to receive personal commands.
- The process can keep approvals, memory, and local action adapters close to the same machine that will actually execute the action.
- A persistent session gives clearer operational ownership: one foreground agent process, one local approval queue, one machine state.

## Practical design choice in this repo

- `webhook` mode still exists for compatibility and testing.
- `long-connection` is the preferred mode in `.env.example`.
- `stub` long-connection mode is included so the end-to-end loop is runnable without pretending Feishu credentials are optional.
- `real` long-connection mode now defaults to the official Feishu Node SDK long-connection client.
- a separate `relay` adapter exists only for users who already operate their own websocket bridge that forwards Feishu-style event envelopes.

## Safety implications

Long connection does not weaken the approval model. It only changes transport. All local actions still flow through:

- command parsing
- explicit action adapters
- risk classification
- persisted approval records when required

See the concrete setup steps in [docs/feishu-real-setup.md](/Users/levy/.openclaw/workspace/lobstermind/docs/feishu-real-setup.md).
