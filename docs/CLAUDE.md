# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in the `docs/` directory.

## Overview

Reference documentation for the Crux backend. Currently contains SQL query references used by the feed service.

## Contents

### `queries/feed.sql`

Two reference SQL queries for the feed system:

**Personal Feed** — ascents from users the viewer follows, with visibility enforcement:
- `public` ascents: always shown
- `friends` ascents: shown only if the author also follows the viewer (mutual follow)
- `private` ascents: never shown in feeds

**Gym Feed** — recent public ascents at a specific gym (no auth required).

Both use **keyset pagination** on `(logged_at DESC, id DESC)`. The cursor is an ascent ID — a subquery looks up its `logged_at` to paginate correctly without relying on UUID ordering.

These queries are the canonical reference for `api/src/services/feedService.ts`.
