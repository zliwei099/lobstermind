# LobsterMind Product Vision

## Why the name

`LobsterMind` / `龙虾参谋` combines two ideas:

- `龙虾`: a memorable, slightly eccentric mascot that suggests something tactile and grounded in the physical world, not just chat.
- `参谋`: a strategist or chief of staff who helps a person think, remember, and execute.

The name signals a personal agent that is opinionated, operational, and close to the user's day-to-day work.

## Product concept

LobsterMind is a personal operations agent for one user first.

It should:

- accept messages from the channels the user already uses, starting with Feishu,
- remember ongoing context and small facts that matter over time,
- expose a skill system so new domain-specific behaviors can be added cleanly,
- take actions on the user's computer only through explicit tools and approvals.

## MVP philosophy

The MVP should be honest about what is real:

- Memory is a local store, not vague long-term intelligence.
- Skills are registered capabilities with names and handlers.
- Computer control is an executor layer with adapters, policies, and approvals.
- Feishu integration can start as an inbound webhook instead of full production app auth.

## Long-term direction

If the MVP proves useful, LobsterMind can evolve into:

- a richer memory and retrieval layer,
- more adapters for desktop automation, browser actions, and external APIs,
- better planning across multi-step tasks,
- stronger identity, audit, and approval workflows.
