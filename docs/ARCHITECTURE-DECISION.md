# Architecture Decision: Where the Rules and the Data Live

**Status**: Accepted
**Date**: 2026-10-12 (recreated; the original file was never committed)

## Rules home

- Rules are pure TypeScript functions, each checked against golden JSON fixtures.
- No big-bang migration: a rule moves to TypeScript when it is next touched.
- Each rule has exactly one home. While a rule is being moved it may briefly live in Java and TypeScript, but never in a third place.
- Option F sessions 2 to 4 (form-aware rolls) are built as pure TypeScript functions with golden fixtures, not as backend changes.

## Persistence

- Target: local-first. Data lives in browser storage, can be exported to and imported from a file, and is reached through a storage interface so a different backend can be added later.
- The Spring backend stays until a friend needs access.

## Gmail sync

- Not a requirement. It is a candidate for removal.

## Revisit triggers

Reconsider this decision if any of these happens:

- A friend needs access.
- The same character is used on two devices.
- Players need to see each other's characters.
- Money becomes involved (hosting costs, payments).
