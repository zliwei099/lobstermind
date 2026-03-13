# Feishu Real Channel Setup

This guide is for wiring LobsterMind to a real Feishu app in the most practical way supported by this repository today.

## Recommended path

Use Feishu's official event subscription long connection in Node.js:

- `LOBSTERMIND_FEISHU_MODE=long-connection`
- `LOBSTERMIND_FEISHU_LONG_CONNECTION_MODE=real`
- `LOBSTERMIND_FEISHU_LONG_CONNECTION_ADAPTER=official`

This path uses the official `@larksuiteoapi/node-sdk` `WSClient` for inbound events and LobsterMind's own API client for outbound replies.

## 1. Prepare the app

Create a Feishu app in the developer console and enable bot and event subscription capabilities.

Minimum configuration assumptions for this MVP:

- the app can receive `im.message.receive_v1`
- the app can call the IM send-message API
- the app is installed for the tenant or user context you plan to test with

The runtime currently expects text commands sent to the bot. Non-text messages are explicitly rejected with a text reply.

## 2. Set credentials

Copy `.env.example` to `.env` and set:

```bash
LOBSTERMIND_FEISHU_MODE=long-connection
LOBSTERMIND_FEISHU_LONG_CONNECTION_MODE=real
LOBSTERMIND_FEISHU_LONG_CONNECTION_ADAPTER=official
LOBSTERMIND_FEISHU_APP_ID=cli_xxx
LOBSTERMIND_FEISHU_APP_SECRET=xxxx
```

`LOBSTERMIND_FEISHU_WS_URL` is not needed for the official adapter.

## 3. Install dependencies

The official adapter lazy-loads the Feishu SDK at runtime. Install project dependencies before starting real mode:

```bash
npm install
```

If the SDK is missing, LobsterMind will fail fast with an explicit error instead of silently falling back to a fake transport.

## 4. Start the desktop runtime

```bash
npm run dev
```

Startup should log:

- `Feishu runtime: mode=real, adapter=official`
- `Feishu long connection started with the official Node SDK.`

## 5. Send a text message to the bot

Send a plain text command such as:

```text
/skills
```

LobsterMind will:

- receive the event through the SDK long connection
- parse the text payload
- run the existing agent routing
- reply with a text message through the Feishu IM API

Replies are addressed to `chat_id` when present, which is the most practical default for both direct chats and group conversations. If `chat_id` is absent, LobsterMind falls back to `open_id` and then `user_id`.

## Relay adapter

If you already operate your own websocket service that forwards Feishu-style event envelopes, you can use:

```bash
LOBSTERMIND_FEISHU_LONG_CONNECTION_MODE=real
LOBSTERMIND_FEISHU_LONG_CONNECTION_ADAPTER=relay
LOBSTERMIND_FEISHU_WS_URL=wss://your-relay.example/ws
```

Important: this is not Feishu's official desktop long-connection transport. The relay adapter assumes your websocket emits JSON bodies shaped like the webhook and stub event envelope already used in this repository.

## Verified vs assumed

Verified while implementing:

- Feishu's Node SDK exposes a `WSClient`-based long-connection event pattern for Node.js
- this repository now treats that official SDK path as the default real adapter
- outbound replies are sent through Feishu's REST IM API using tenant access tokens

Assumptions that were not end-to-end verified in this environment:

- the exact app-console click path and permission labels in Feishu's UI
- the precise callback payload object passed by the SDK handler, beyond the documented `im.message.receive_v1` event shape the code expects
- live credential validation against a real tenant, because no Feishu app credentials were available here

Because of that, the official adapter is isolated in [src/integrations/feishu/official-long-connection.ts](/Users/levy/.openclaw/workspace/lobstermind/src/integrations/feishu/official-long-connection.ts). If SDK behavior differs slightly in production, you only need to adjust that adapter instead of rewriting the stub or relay paths.

## References

- Feishu Open Platform: https://open.feishu.cn/
- Official Node SDK examples and `WSClient`: https://github.com/larksuite/oapi-sdk-nodejs
