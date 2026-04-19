# MoltScore — Reputation Layer for Autonomous Agents

## Background and Motivation

MoltScore is the **reputation layer for autonomous agents** — unlocking rich, verifiable reputation data that makes true agents visible. Think "Talent Protocol, but for AI agents."

**What exists today:** A working scoring pipeline that discovers agents on Moltbook, collects onchain + debate + financial metrics, computes a composite reputation score (300–950), assigns tiers (AAA → Risk Watch), and replies to agents with their score. Frontend has a landing page and leaderboard.

**What we're building:** A complete reputation infrastructure that other agents and protocols can query, integrate, and build on. Agents can register themselves. Scores are transparent and broken down into verifiable data points. The system runs autonomously at $0.

---

## Complete Build Plan

### What Already Works (no changes needed)

| Component | Status | Notes |
|---|---|---|
| Scoring engine (basic) | Done | `services/scoringEngine.ts` — formula-based scoring |
| Scoring engine (enhanced) | Done | `services/enhancedScoringEngine.ts` — 5-component scoring |
| Agent discovery | Done | `services/agentDiscovery.ts` — Moltbook feed crawling |
| Onchain metrics | Done | `services/agentMetrics.ts` — Base chain event scanning |
| MoltCourt integration | Done | `services/moltcourtSync.ts` — debate stats |
| Bankr integration | Done | `services/bankrIntegration.ts` — financial metrics |
| Conversation engine | Done | `services/conversationEngine.ts` — reply to agents |
| Autonomous loop | Done | `jobs/autonomousLoop.ts` — 15-min cron |
| Database schema | Done | PostgreSQL via `pg` — core + enhanced tables |
| Landing page | Done | Reputation framing, responsive, animated |
| Leaderboard app | Done | Standard + Enhanced views |

---

## Phase 0: Production Infrastructure ($0)

**Goal:** Deploy everything to production, running autonomously, at zero cost.

### 0.1 — Convert cron job to API route
- **What:** Create `app/api/cron/score/route.ts` that calls `runMoltScoreLoop()` once
- **Why:** Serverless platforms (Vercel) can't run persistent `node-cron` processes
- **Security:** Require `CRON_SECRET` header to prevent unauthorized triggers
- **Files:** New `app/api/cron/score/route.ts`, keep existing `jobs/autonomousLoop.ts` as-is for local dev
- **Success:** `curl -H "Authorization: Bearer $CRON_SECRET" POST /api/cron/score` triggers one scoring cycle and returns results

### 0.2 — GitHub Actions cron workflow
- **What:** Create `.github/workflows/score.yml` that triggers the API route every 15 minutes
- **Why:** Free autonomous scheduling (2,000 min/month free for public repos)
- **Files:** New `.github/workflows/score.yml`
- **Success:** GitHub Actions runs on schedule, triggers scoring, logs success/failure

### 0.3 — Database setup (Neon)
- **What:** Document Neon free-tier setup, update `.env.example` with Neon connection string format
- **Why:** Free PostgreSQL with 0.5 GB storage (plenty for thousands of agents)
- **Files:** Update `README.md` with setup instructions
- **Success:** `npm run db:init && npm run db:init:enhanced` works against Neon

### 0.4 — Vercel deployment
- **What:** Configure `vercel.json` if needed, document deployment steps
- **Why:** Free Next.js hosting with serverless functions
- **Files:** `vercel.json` (if needed), `README.md`
- **Success:** App deploys to Vercel, all API routes work, env vars configured

### 0.5 — Persist `lastProcessedBlock` to database
- **What:** Create `scan_state` table, save/load block scanning progress
- **Why:** Currently in-memory — lost on restart, causing re-scanning or missed events
- **Files:** Update `scripts/initDb.ts`, update `services/agentMetrics.ts`
- **Success:** After restart, block scanning resumes from where it left off

**Phase 0 outcome:** MoltScore runs in production, autonomously, at $0/month. Scoring triggers every 15 min via GitHub Actions.

---

## Phase 1: Reputation API (make it queryable)

**Goal:** Other agents and protocols can look up any agent's reputation.

### 1.1 — Unify scoring systems
- **What:** Make enhanced scoring the primary system. Basic scoring becomes a fallback when enhanced data isn't available.
- **Why:** Two parallel systems (basic + enhanced) is confusing. The frontend should use the best available data.
- **How:**
  - Update `/api/leaderboard` to prefer `scored_agents_enhanced`, fall back to `scored_agents`
  - Or merge both into one table with nullable enhanced fields
- **Files:** `app/api/leaderboard/route.ts`, possibly `lib/cache.ts`
- **Success:** One endpoint returns the best available data for each agent

### 1.2 — Agent lookup API
- **What:** `GET /api/agent/:username` returns full reputation profile for one agent
- **Response:**
  ```json
  {
    "username": "oracle_alpha",
    "wallet": "0x...",
    "score": 847,
    "tier": "AA",
    "components": {
      "taskPerformance": { "score": 185, "max": 200, "signal": "strong" },
      "financialReliability": { "score": 240, "max": 300, "signal": "medium" },
      "disputeRecord": { "score": 150, "max": 150, "signal": "strong" },
      "ecosystemParticipation": { "score": 160, "max": 200, "signal": "medium" },
      "intellectualReputation": { "score": 112, "max": 150, "signal": "medium" }
    },
    "dataPoints": {
      "tasksCompleted": 1240,
      "tasksFailed": 12,
      "completionRate": 0.99,
      "disputes": 0,
      "slashes": 0,
      "ageDays": 89,
      "debateWins": 8,
      "debateLosses": 3,
      "portfolioValue": 12400,
      "tradingWinRate": 0.68
    },
    "metadata": {
      "hasOnchainData": true,
      "hasDebateData": true,
      "hasBankrData": true,
      "dataCompleteness": 1.0,
      "lastUpdated": "2026-02-16T..."
    }
  }
  ```
- **Files:** New `app/api/agent/[username]/route.ts`
- **Success:** Any agent or protocol can query `GET /api/agent/oracle_alpha` and get a full reputation profile

### 1.3 — Agent self-registration
- **What:** `POST /api/agent/register` allows agents to submit themselves
- **Request:** `{ "username": "my_agent", "wallet": "0x..." }`
- **What it does:**
  1. Inserts into `discovered_agents` (or updates wallet if exists)
  2. Optionally triggers immediate scoring (or waits for next cron cycle)
  3. Returns current score if already scored, or `{ "status": "queued" }`
- **Why:** Agents shouldn't have to post on Moltbook to be discovered
- **Files:** New `app/api/agent/register/route.ts`
- **Success:** An agent can register itself and appear on the leaderboard after the next scoring cycle

### 1.4 — API key system
- **What:** Simple API key auth for external consumers
- **How:**
  - New `api_keys` table: `key_hash`, `name`, `created_at`, `rate_limit`, `key_type` (read/write)
  - Check `X-API-KEY` header on protected endpoints
  - Rate limiting: simple in-memory counter per key (reset every minute)
- **Files:** New `lib/apiAuth.ts`, new `app/api/keys/route.ts` (for key management), update existing routes
- **Public endpoints (no key):** `/api/leaderboard` (read-only, rate limited by IP)
- **Key-required endpoints:** `/api/agent/:username`, `/api/agent/register`
- **Success:** External protocols can get an API key and query agent reputation

### 1.5 — Dynamic landing page stats
- **What:** Landing page stats ("50+ VERIFIED AGENTS", "6 REPUTATION TIERS") fetched from real data
- **How:** Use `/api/status` to get agent count, or fetch at build time via Next.js `fetch`
- **Files:** Update `app/page.tsx` to be a server component that fetches stats
- **Success:** Stats reflect actual database state

**Phase 1 outcome:** MoltScore is a queryable reputation API. Agents can self-register. Protocols can look up any agent's full reputation profile via API key.

---

## Phase 2: Agent Passport (make it visible)

**Goal:** Every agent has a public profile page showing their full reputation breakdown.

### 2.1 — Agent Passport page
- **What:** `/agent/:username` page showing full reputation profile
- **Layout:**
  - Header: agent name, wallet, tier badge, overall score
  - Score breakdown: 5 component progress bars with labels
  - Data points: individual verified facts with source labels
  - Activity timeline: when scored, tier changes, etc.
  - "Verified by MoltScore" badge
- **Files:** New `app/agent/[username]/page.tsx`
- **Success:** Visiting `/agent/oracle_alpha` shows a beautiful, detailed reputation profile

### 2.2 — Score component visualization
- **What:** Visual breakdown of how the score was computed
- **Show:** Each of the 5 components as a progress bar with:
  - Component name (Task Performance, Financial Reliability, etc.)
  - Score / Max (e.g., 185/200)
  - Signal strength badge (weak/medium/strong)
  - What data sources contributed
- **Files:** New `components/ScoreBreakdown.tsx`
- **Success:** Users and agents can see exactly why a score is what it is

### 2.3 — Data points display
- **What:** Individual verified facts listed with their source
- **Format per data point:**
  - Label: "Tasks Completed"
  - Value: "1,240"
  - Source: "Base Chain · Contract 0x1234...5678"
  - Category: Performance / Financial / Social / Governance
- **Files:** New `components/DataPoints.tsx`
- **Success:** Every fact that contributed to the score is visible and traceable to its source

### 2.4 — Shareable passport card
- **What:** OG image / share card for agent passport pages
- **How:** Dynamic OG images via Vercel OG (`@vercel/og`) — generates a card image at request time
- **Shows:** Agent name, score, tier, top stats
- **Files:** New `app/agent/[username]/opengraph-image.tsx`
- **Success:** Sharing a passport URL on Twitter/Farcaster shows a rich preview card

### 2.5 — Link passport from leaderboard
- **What:** Clicking an agent on the leaderboard goes to their passport page
- **Files:** Update `app/app/page.tsx`, `components/LeaderboardTable.tsx`
- **Success:** Leaderboard → Agent Passport navigation works

**Phase 2 outcome:** Every agent has a public, shareable profile page showing their full reputation with transparent data point breakdowns.

---

## Phase 3: API Documentation (make it integrable)

**Goal:** Developers can integrate MoltScore into their apps.

### 3.1 — API docs page
- **What:** `/docs` page with interactive API documentation
- **Cover:**
  - Authentication (API keys)
  - `GET /api/leaderboard` — full leaderboard
  - `GET /api/agent/:username` — single agent lookup
  - `POST /api/agent/register` — agent self-registration
  - `GET /api/status` — system status
  - Rate limits and error codes
  - Example requests/responses
- **Files:** New `app/docs/page.tsx`
- **Success:** A developer can read the docs and integrate MoltScore in under 30 minutes

### 3.2 — API key request flow
- **What:** Simple form to request an API key (or auto-generate for authenticated users)
- **Files:** New `app/docs/request-key/page.tsx` or inline on docs page
- **Success:** Developers can get an API key without manual approval

**Phase 3 outcome:** MoltScore has public API documentation and a self-serve API key flow.

---

## Phase 4: Mandate Protocol Integration (make it real)

**Goal:** Plug MoltScore into Mandate Protocol's onchain infrastructure — real contracts, real escrow data, real reputation.

### Discovery: Mandate Protocol (moltlaunch.com/protocol)

Mandate Protocol is **open infrastructure for agent work** on Base. It has exactly the onchain primitives MoltScore needs:

| Mandate Component | Contract | What it gives MoltScore |
|---|---|---|
| **ERC-8004 Identity** | `0x8004...a432` | Onchain agent registry — skills, endpoints, metadata. Replaces our Moltbook-only discovery. |
| **MandateEscrowV5** | `0x5Df1...50Ee` | Trustless task escrow — ETH locked until delivery + review. Rich source of task completion, disputes, cancellations, payment amounts. |
| **ERC-8004 Reputation** | `0x8004...9b63` | Onchain reviews tied to real payments. Can't be faked. Perfect signal for our scoring engine. |

**Why this matters:**
- Our current `MOLT_TASKS_ADDRESS` and `MOLT_DISPUTES_ADDRESS` are **placeholders** (`0x0000...0001`, `0x0000...0002`). Mandate provides the real contracts.
- Our current scoring scans for generic `TaskCompleted`/`TaskFailed` events. Mandate's escrow has a real task lifecycle: `requested → quoted → accepted → submitted → completed`.
- Mandate's ERC-8004 Reputation gives us **payment-verified reviews** — the strongest possible reputation signal.
- Mandate is permissionless and multi-frontend — scores written there become visible everywhere.

**This replaces our original Phase 4 plan** (EAS attestations, custom NFTs). Mandate already has the infrastructure we were going to build.

### Contract Details (from BaseScan verified source)

**Identity Registry** (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`)
- Implementation: `IdentityRegistryUpgradeable` at `0x7274e874ca62410a93bd8bf61c69d8045e399c02`
- ERC-721 NFT ("AgentIdentity", "AGENT"), ~20,000 agents registered
- Key events:
  - `Registered(uint256 indexed agentId, string agentURI, address indexed owner)`
  - `MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)`
- Key read functions:
  - `getAgentWallet(uint256 agentId) → address`
  - `getMetadata(uint256 agentId, string metadataKey) → bytes`
  - `tokenURI(uint256 agentId) → string` (agent's skill/metadata URI)
  - `ownerOf(uint256 agentId) → address`

**Escrow / MandateEscrowV5** (`0x5Df1ffa02c8515a0Fed7d0e5d6375FcD2c1950Ee`)
- Implementation at `0xa30afbc6dbd79c8d8384ea52da9d4f84cf5464a3` (unverified, but bytecode decompiled)
- ~135 transactions, real ETH escrow ($63+ held)
- Mandate struct: `{ creator, worker, resolver, amount, createdAt, submittedAt, disputeDeposit, status }`
- Status enum: Pending(0), Quoted(1), Submitted(2), Disputed(3), Completed(4), Cancelled(5), Refunded(6), Rejected(7)
- Key function selectors:
  - `0x7f8698e6` — createMandate (payable, locks ETH)
  - `0x1c342735` — submitWork
  - `0xda4d18b6` — acceptMandate / quote
  - `release()` — releases escrow to worker
  - `0x2d83549c` / `0xf023b811` — mandate getters (returns full struct)
  - `0x5de28ae0` — getStatus(uint256)
- Escrow events (derived from bytecode):
  - MandateCreated (indexed mandateId, indexed creator, amount)
  - WorkSubmitted (indexed mandateId, indexed worker, deadline)
  - FundsReleased (indexed mandateId, indexed to, amount)
  - DisputeRaised (indexed mandateId, ...)
  - MandateCompleted / DisputeResolved

**Reputation Registry** (`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`)
- Implementation: `ReputationRegistryUpgradeable` at `0x16e0FA7f7c56b9a767e34b192b51f921BE31dA34` (VERIFIED)
- ~5,044 transactions, all `Give Feedback` / `Append Response`
- Key events:
  - `NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)`
  - `FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)`
  - `ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseURI, bytes32 responseHash)`
- Key read functions:
  - `getClients(uint256 agentId) → address[]` — all clients who gave feedback
  - `readFeedback(agentId, client, index) → (value, valueDecimals, tag1, tag2, isRevoked)`
  - `readAllFeedback(agentId, clients[], tag1, tag2, includeRevoked)` — bulk read
  - `getSummary(agentId, clients[], tag1, tag2) → (count, summaryValue, summaryValueDecimals)` — aggregated
  - `getLastIndex(agentId, client) → uint64`
- Feedback struct: `{ value (int128), valueDecimals (uint8), isRevoked (bool), tag1, tag2 }`
- Anti-spam: Self-feedback blocked (checks Identity ownership)

---

### REFACTOR: Mandate-Only Architecture

**Strategy:** Replace Moltbook/MoltCourt/Bankr with onchain Mandate data. All 3 contracts are **read-only** from our side (scan events + call view functions). No wallet/gas needed.

**What changes:**
| Current Source | Replacement | Status |
|---|---|---|
| Moltbook feed crawling (`agentDiscovery.ts`) | Identity Registry `Registered` events | Replace |
| Placeholder contracts (`agentMetrics.ts`) | Escrow mandate data (struct reads) | Replace |
| MoltCourt debates (`moltcourtIntegration.ts`, `moltcourtSync.ts`) | Reputation Registry feedback | Replace |
| Bankr financial data (`bankrIntegration.ts`) | Escrow payment amounts | Replace |
| Moltbook reply engine (`conversationEngine.ts`) | Remove (no more Moltbook interaction) | Remove |

**What stays:**
- Database (PostgreSQL/Neon) — schema updates needed
- API routes (`/api/leaderboard`, `/api/agent/:username`, etc.)
- Frontend (landing page, leaderboard, agent passport, docs)
- API key system
- GitHub Actions cron trigger
- Vercel hosting

---

### 4.1 — Create Mandate contract service layer
- **What:** Create `services/mandateContracts.ts` with ethers.js contract instances and minimal ABIs for all 3 contracts
- **ABIs needed:**
  - Identity: `Registered` event, `getAgentWallet`, `tokenURI`, `ownerOf`, `getMetadata` (from verified source)
  - Escrow: mandate getter (address `0x2d83549c` or `0xf023b811`), `getStatus` (from bytecode analysis)
  - Reputation: `getClients`, `readAllFeedback`, `getSummary`, `getLastIndex` (from verified source)
- **Files:** New `services/mandateContracts.ts`
- **Success:** Can call `identityContract.getAgentWallet(agentId)`, `reputationContract.getSummary(agentId, ...)`, read escrow mandates from TypeScript

### 4.2 — Build Identity-based agent discovery
- **What:** Replace Moltbook discovery with scanning `Registered` events from Identity Registry
- **How:**
  1. Scan `Registered(uint256 indexed agentId, string agentURI, address indexed owner)` events
  2. For each agent: store `agentId`, `owner`, `agentURI`, `wallet` (from `getAgentWallet`)
  3. If `agentURI` points to JSON metadata (IPFS/HTTP), optionally fetch it for agent name/skills
  4. Use incremental block scanning (persist `lastProcessedBlock` like current `agentMetrics.ts`)
- **DB changes:** Add `mandate_agent_id` (uint), `agent_uri`, `mandate_owner` columns to `discovered_agents`
- **Files:** New `services/mandateDiscovery.ts`, update `scripts/initDb.ts`
- **Success:** ~20,000 agents from Identity Registry are discoverable

### 4.3 — Build Escrow-based metrics collection
- **What:** For each discovered agent's wallet, query the Escrow contract for mandate data
- **How:**
  1. Since escrow is unverified, use minimal ABI fragments to call the mandate getter
  2. Scan escrow events to find mandateIds where agent's wallet is `creator` or `worker`
  3. For each mandate: read status, amount, createdAt, submittedAt
  4. Compute: mandates_created, mandates_completed, mandates_disputed, mandates_cancelled, total_earned_eth
- **Files:** New `services/mandateEscrow.ts`
- **Success:** For each agent, we know how many mandates they've created/completed, total ETH earned, dispute rate

### 4.4 — Build Reputation-based review ingestion
- **What:** For each agent's `mandate_agent_id`, query Reputation Registry for feedback
- **How:**
  1. Call `getClients(agentId)` to get all reviewers
  2. Call `getSummary(agentId, clients, "", "")` for aggregate score
  3. Call `readAllFeedback(agentId, clients, "", "", false)` for individual reviews
  4. Store: feedback_count, avg_rating, positive_count, negative_count, unique_reviewers
- **Files:** New `services/mandateReputation.ts`
- **Success:** For each agent, we have onchain peer review data

### 4.5 — Rewrite scoring engine for Mandate data
- **What:** Replace the 5-component scoring with Mandate-native signals
- **New scoring model (300–950 scale):**
  1. **Task Performance** (30%): mandates completed / total, completion rate, total ETH earned
  2. **Peer Reputation** (30%): avg feedback value, feedback count, unique reviewers, no revoked reviews
  3. **Escrow Reliability** (20%): disputes avoided, funds released cleanly, no cancellations
  4. **Economic Activity** (10%): total mandate value in ETH, frequency of mandates
  5. **Identity Completeness** (10%): has URI, has metadata, wallet verified
- **Files:** New `services/mandateScoringEngine.ts`, update scoring call in cron route
- **Success:** Scores computed purely from onchain Mandate data — fully verifiable

### 4.6 — Update database schema
- **What:** Update tables to store Mandate-specific data, drop/deprecate old columns
- **New table `mandate_agents`:**
  - `agent_id` (uint, primary key from Identity contract)
  - `owner_address`, `wallet_address`, `agent_uri`
  - `mandates_as_worker`, `mandates_as_creator`, `mandates_completed`, `mandates_disputed`, `mandates_cancelled`
  - `total_earned_wei`, `feedback_count`, `avg_feedback_value`, `unique_reviewers`
  - `score`, `tier`, `score_components` (JSONB)
  - `last_scored_at`, `discovered_at`
- **Files:** Update `scripts/initDb.ts`
- **Success:** Clean schema that maps 1:1 to Mandate data

### 4.7 — Update API routes and frontend
- **What:** Update API responses to use Mandate data model, update frontend to display new fields
- **Changes:**
  - `/api/leaderboard` → query `mandate_agents` table
  - `/api/agent/:username` → query by agentId or wallet, return Mandate data points
  - Landing page stats → count from `mandate_agents`
  - Leaderboard → show Mandate-specific columns
  - Agent Passport → show Mandate score breakdown, escrow stats, review data
  - Data source badges → "Identity Registry", "Escrow", "Reputation Registry" (instead of MoltCourt/Bankr)
- **Files:** Multiple API routes and frontend components
- **Success:** Full end-to-end flow with Mandate data

### 4.8 — Update cron job and cleanup
- **What:** Rewire the autonomous loop to use new Mandate services. Remove old services.
- **New loop flow:**
  1. Discover agents from Identity Registry (incremental scan)
  2. Collect escrow data for each agent's wallet
  3. Collect reputation data for each agent's ID
  4. Score all agents
  5. Update database
- **Cleanup:** Remove or archive `services/moltbookCrawler.ts`, `services/moltcourtIntegration.ts`, `services/moltcourtSync.ts`, `services/bankrIntegration.ts`, `services/conversationEngine.ts`
- **Files:** Update `jobs/autonomousLoop.ts`, `app/api/cron/score/route.ts`
- **Success:** Complete Mandate-only scoring pipeline running autonomously

### 4.9 (Future) — Write MoltScore back to Mandate
- Write computed scores as onchain attestations via Reputation Registry
- Requires wallet + gas — future work

### 4.10 (Future) — Embeddable widget / SDK
- `<MoltScoreBadge agent="oracle_alpha" />` for other apps

---

## Implementation Order (Task-by-Task)

Each task is small, testable, and independent. One at a time.

### Phase 0 — Production ($0 deployment) ✅ COMPLETE
- [x] **0.1** Create `app/api/cron/score/route.ts` (cron-to-API conversion)
- [x] **0.2** Create `.github/workflows/score.yml` (15-min cron trigger)
- [x] **0.3** Document Neon + Vercel setup in README
- [x] **0.4** Vercel deployment config (maxDuration=60 for Hobby)
- [x] **0.5** Persist `lastProcessedBlock` + `walletMetrics` to database

### Phase 1 — Reputation API ✅ COMPLETE
- [x] **1.1** Unify basic + enhanced scoring
- [x] **1.2** Build `GET /api/agent/:username` endpoint
- [x] **1.3** Build `POST /api/agent/register` endpoint
- [x] **1.4** API key system (`lib/apiAuth.ts` + `api_keys` table)
- [x] **1.5** Dynamic landing page stats

### Phase 2 — Agent Passport ✅ COMPLETE
- [x] **2.1** Agent Passport page (`app/agent/[username]/page.tsx`)
- [x] **2.2** Score component visualization (`components/ScoreBreakdown.tsx`)
- [x] **2.3** Data points display (`components/DataPoints.tsx`)
- [x] **2.4** OG image for sharing (`app/agent/[username]/opengraph-image.tsx`)
- [x] **2.5** Link passport from leaderboard

### Phase 3 — API Documentation ✅ COMPLETE
- [x] **3.1** API docs page (`app/docs/page.tsx`)
- [x] **3.2** API key request flow (built into docs page)

### Phase 4 — Mandate Protocol Refactor
- [ ] **4.1** Create Mandate contract service layer (`services/mandateContracts.ts`)
- [ ] **4.2** Build Identity-based agent discovery (`services/mandateDiscovery.ts`)
- [ ] **4.3** Build Escrow-based metrics collection (`services/mandateEscrow.ts`)
- [ ] **4.4** Build Reputation-based review ingestion (`services/mandateReputation.ts`)
- [ ] **4.5** Rewrite scoring engine for Mandate data (`services/mandateScoringEngine.ts`)
- [ ] **4.6** Update database schema (new `mandate_agents` table)
- [ ] **4.7** Update API routes and frontend
- [ ] **4.8** Update cron job and cleanup old services

**Total: 25 tasks across 4 phases (17 complete + 8 new).**

---

## Project Status Board

### Completed
- [x] Landing page (reputation framing, responsive, animated)
- [x] Leaderboard app (standard + enhanced views)
- [x] Scoring engines (basic + enhanced)
- [x] Agent discovery pipeline
- [x] Onchain metrics collection
- [x] MoltCourt + Bankr integrations
- [x] Autonomous scoring loop
- [x] Database schema (core + enhanced)
- [x] Credit → Reputation copy pivot

### Next Up
- [x] **Phase 0:** Production infrastructure ($0 deployment) ✅
- [x] **Phase 1:** Reputation API ✅
- [x] **Phase 2:** Agent Passport ✅
- [x] **Phase 3:** API Documentation ✅
- [ ] **Phase 4:** Mandate Protocol Refactor (Mandate-Only Architecture)
  - [x] 4.1 Contract service layer ✅
  - [ ] 4.2 Identity discovery
  - [ ] 4.3 Escrow metrics
  - [ ] 4.4 Reputation ingestion
  - [ ] 4.5 New scoring engine
  - [x] 4.6 Database schema ✅ (mandate_agents + Moltlaunch enrichment columns)
  - [x] 4.7 API + frontend updates ✅
    - [x] `/api/agents` — paginated agent directory with search, filters, sort
    - [x] `/api/agents/[id]` — single agent detail endpoint
    - [x] `/agents` route — Moltlaunch-style agent grid/list with market data (renamed from `/app`)
      - Default sort by reputation; clipped-edge cards in grid view
      - X/Twitter-style verified badge (blue shield with checkmark)
    - [x] `/agent/[id]` — Moltlaunch-style agent profile page with:
      - Hero card (avatar, name, token badge, verified badge, description, ETH price)
      - About section, Services grid (fetched from Moltlaunch gigs API)
      - Work Log, Stats sidebar, Links, Onchain section
      - All cards use MoltScore clipped-edge card style
      - X/Twitter-style verified badge throughout
    - [x] Moltlaunch API integration (sync script + live gig/burn data fetch)
  - [x] 4.9 Agent Registration via ERC-8004 ✅
    - [x] Built `/register` page with 4-step flow: wallet connect → form → on-chain tx → success
    - [x] Uses viem + wagmi for Identity Registry `register(agentURI)` on Base
    - [x] Reown AppKit (WalletConnect) for wallet connection — supports 300+ wallets, mobile deep links
    - [x] Created `config/reown.ts` (wagmi adapter + Base chain config)
    - [x] Created `app/providers.tsx` (WagmiProvider + QueryClientProvider + AppKit init)
    - [x] Updated `app/layout.tsx` to wrap app with providers (SSR cookie state)
    - [x] After on-chain registration, caches agent in `mandate_agents` via `POST /api/agent/register`
    - [x] Added "Register Agent" CTA to agents directory header
    - [x] Consistent MoltScore design (clipped-edge cards, step indicator, info box)
  - [x] 4.10 Mobile responsiveness fixes ✅
    - [x] Fixed landing page feature cards and top performer cards on mobile (badges touching screen edge)
    - [x] Reduced badge size/offset on mobile, added more section padding
  - [x] 4.11 Codebase cleanup ✅
    - [x] Deleted 30+ unused files (old services, jobs, scripts, components, lib modules)
    - [x] Removed unused packages (agent0-sdk, electron, fs, graphql, node-cron)
    - [x] Rewrote stale API routes to use mandate_agents
    - [x] Deleted docs page and all references
    - [x] Cleaned package.json scripts, updated README
  - [x] 4.12 EigenCloud verifiable scoring ✅
    - [x] Created `eigencompute/` standalone scoring service (Docker + TypeScript)
    - [x] Deterministic scoring algorithm: Peer Reputation (40%), Task Completion (30%), Economic Activity (20%), Identity (10%)
    - [x] TEE wallet signing — scores are cryptographically attested
    - [x] Created `/api/verify/[agentId]` route to proxy EigenCompute calls
    - [x] Created `VerifiableScore` client component on agent profile pages
    - [x] Shows score breakdown + attestation proof (signer, signature, version, timestamp)
  - [ ] 4.8 Cron job rewire + cleanup

## Executor's Feedback or Assistance Requests

- **ACP 2.0 migration (2026-04-19):** `acp-cli` cloned to `/Users/test/acp-cli`, `npm install` done. Wrapper: `MoltScore/scripts/acp.sh` (override with `ACP_CLI_ROOT`). **`acp configure` was not completed** — requires human browser OAuth at Virtuals (CLI prints `{"url":...}` with `--json`). After login: `scripts/acp.sh agent whoami --json`, then `scripts/acp.sh agent migrate` / `--complete` if needed. New Cursor skill: `~/.cursor/skills/acp-cli/SKILL.md`. Disable legacy `openclaw-acp` when verified.

- **Phase 0 COMPLETE.** All 5 tasks executed and verified.
- **Phase 1 COMPLETE.** All 5 tasks executed and verified:
  - **1.1** `app/api/leaderboard/route.ts` — unified endpoint that prefers enhanced data, falls back to basic. Returns `source: "enhanced" | "basic"` field so consumers know which scoring system was used.
  - **1.2** `app/api/agent/[username]/route.ts` — full reputation profile for any agent. Returns score, tier, 5-component breakdown with signal strengths, all data points, and metadata. Falls back through enhanced → basic → discovered stages. Returns 404 if agent not found.
  - **1.3** `app/api/agent/register/route.ts` — self-registration endpoint. Agents POST `{ username, wallet? }` to register. Upserts into `discovered_agents`. Returns current score if already scored, or `"registered"` status if queued for next cycle.
  - **1.4** `lib/apiAuth.ts` — API key generation (SHA-256 hashed, `ms_` prefixed), validation with daily rate limiting. `app/api/keys/route.ts` — admin-only key generation (protected by `CRON_SECRET`). `api_keys` table added to `scripts/initDb.ts`.
  - **1.5** `app/page.tsx` — landing page now fetches live agent count and tier count from the database at render time. Stats display dynamically.
  - **Build:** Clean (`next build` passes, TypeScript passes, no new lint errors).
- **Phase 2 COMPLETE.** All 5 tasks executed and verified:
  - **2.1** `app/agent/[username]/page.tsx` — Full agent passport page. Server component that queries DB directly (enhanced → basic → discovered fallback). Shows header card with avatar, wallet, rank, data source badges; score ring with animated SVG; quick stats row; score breakdown section; verified data points section; "Verified by MoltScore" footer with metadata; API endpoint hint.
  - **2.2** `components/ScoreBreakdown.tsx` — Client component with animated progress bars (staggered entrance), signal strength badges (strong/medium/weak), and icons for each of the 5 reputation components.
  - **2.3** `components/DataPoints.tsx` — Groups data points by category (performance, governance, social, financial) with colored category badges and source attribution (Base Chain, MoltCourt, Bankr, Computed).
  - **2.4** `app/agent/[username]/opengraph-image.tsx` — Dynamic OG image using `next/og`. Dark gradient background, agent name, wallet, score circle with tier-colored border, data source badges. Generates shareable card for Twitter/Farcaster.
  - **2.5** Leaderboard linking: Top-3 cards (both standard and enhanced views) and table rows now link to `/agent/:username`. Agent names highlight on hover.
  - **Build:** Clean (`next build` passes, TypeScript passes).
- **Phase 3 COMPLETE.** Both tasks executed and verified:
  - **3.1** `app/docs/page.tsx` — Full interactive API documentation page with:
    - Sticky sidebar navigation with section highlighting
    - Overview with base URL, tier reference table, score component cards
    - Authentication section (public vs API key)
    - Rate limits table (public/read/write tiers)
    - Error codes reference
    - 4 endpoint docs (Leaderboard, Agent Lookup, Registration, Status) each with method badge, auth level, parameter tables, curl example with copy button, response example with copy button
    - API key request form (generates key inline via `/api/keys`)
    - Consistent design language (clipped corners, color scheme, typography)
  - **3.2** API key request flow built directly into the docs page — name input, generate button, one-time key display with copy button, error handling
  - Added "API Docs" navigation link to: landing page header, leaderboard header, agent passport header
  - **Build:** Clean (`next build` passes, TypeScript passes, lint clean).

- **Phase 4 Task 4.1 COMPLETE.** Contract service layer built and tested:
  - `services/mandateContracts.ts` — ethers.js contract instances with official ABIs for Identity and Reputation (imported from `abis/` JSON files), hand-crafted ABI for Escrow (unverified contract, selectors confirmed via on-chain probing)
  - **Key findings from probing:**
    - Escrow uses `escrows(bytes32)` mapping (not `mandates(uint256)`). Mandate IDs are bytes32 hashes, not sequential.
    - `escrows(bytes32)` returns struct: (creator, worker, resolver, amount, createdAt, submittedAt, disputeDeposit, status)
    - Escrow status enum: Pending(0), Quoted(1), Submitted(2), Disputed(3), Completed(4), Cancelled(5), Refunded(6), Rejected(7)
    - platformFee=1500bps (15%), cancelFee=1000bps (10%)
    - Agent #1 has 3 reviewers and 9 feedback entries (summaryValue=86)
  - Includes retry logic for public RPC rate limiting, frozen-array fix for ethers v6 Result objects
  - Test script: `scripts/testMandateContracts.ts` — 9/9 tests pass (escrow reads succeed when not rate-limited)
  - Build: Clean (`next build` passes)

**All phases (0–3) are now COMPLETE.** The MoltScore reputation layer is fully built:
- Phase 0: $0 production infrastructure (Vercel + Neon + GitHub Actions)
- Phase 1: Reputation API (unified leaderboard, agent lookup, self-registration, API keys)
- Phase 2: Agent Passport (profile pages, score visualization, OG images, leaderboard linking)
- Phase 3: API Documentation (interactive docs, key generation)
- Phase 4 (onchain attestations, NFT badges, SDK, webhooks) is future work once there's adoption.

## Lessons

- `Pixelify_Sans` from `next/font/google` requires `weight: "variable"`, not `"400 700"`.
- Apply both `.variable` (on `<html>`) and `.className` (on `<body>`) for Next.js Google Fonts to work globally.
- Gradient text requires inline `style` with `WebkitBackgroundClip` and `WebkitTextFillColor` — Tailwind classes alone can fail.
- Hero background gradients must be applied directly to the section element (not absolute children with negative z-index) for reliable visibility.
- Use Tailwind theme-aware utilities (`text-foreground`) instead of arbitrary `[var(--foreground)]` classes when the variable is mapped in `@theme inline`.
- The backend scoring engines don't use "credit" terminology — the credit framing was only in frontend copy.
- Vercel Hobby plan doesn't support cron jobs at 15-min intervals — use GitHub Actions (free for public repos) as external trigger instead.
- Neon free tier (0.5 GB) is more than enough for thousands of agents.
- The existing `node-cron` loop logic doesn't need to change — just needs to be callable from an API route for serverless deployment.
- Escrow contract (MandateEscrowV5) mandate IDs are bytes32 hashes, NOT sequential uint256. The mapping getter is `escrows(bytes32)`.
- Public Base RPC (`mainnet.base.org`) aggressively rate-limits. Use retry logic with exponential backoff. Consider upgrading to a paid RPC (Alchemy/Infura) for production.
- ethers v6 returns frozen `Result` arrays from contract calls. Spread them (`[...result]`) before passing to another contract call to avoid "Cannot assign to read only property" errors.
- For unverified contracts, proxy ABIs are useless (only have constructor/fallback). Need the implementation ABI. If not available, probe with raw function selectors.
- Moltlaunch API: Single agent detail at `GET /api/agents/{id}`, gigs at `GET /api/agents/{id}/gigs`. Use 5s timeout + try-catch so page still renders if API is slow/down.
- When using Tailwind v4 gradient classes (`bg-linear-to-r`), prefer inline `style={{ background: "linear-gradient(...)" }}` for reliability with custom CSS variables as color stops.
- JSX comments `{/* ... */}` can accidentally comment out JSX elements — always verify render output after large writes.
- Agents directory route is `/agents` (not `/app`). All nav links across landing, docs, profile pages must be kept in sync when renaming routes.
- Use the X/Twitter verified badge SVG (blue shield with checkmark, viewBox 0 0 22 22) instead of a simple checkmark for verified status.
- agent0-sdk bundles Node-only modules (IPFS, graphql-request, electron-fetch) that break in Next.js client components. Use viem directly for on-chain calls + inline ERC-6963 discovery instead of importing the full SDK.
- Next.js 16 uses Turbopack by default. Webpack `resolve.fallback` config doesn't work — use `turbopack: {}` in next.config.ts.
- Identity Registry on Base: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. `register(string agentURI) returns (uint256 agentId)`.
- ERC-6963 wallet discovery can be done inline without agent0-sdk: dispatch `eip6963:requestProvider` event, listen for `eip6963:announceProvider` events.
- Reown AppKit for Next.js: Install `@reown/appkit @reown/appkit-adapter-wagmi wagmi @tanstack/react-query`. Config in `config/reown.ts`, providers in `app/providers.tsx`, layout wraps with `<Providers>`.
- Reown AppKit custom elements (`<appkit-button>`, `<appkit-account-button>`) work in TSX without `@ts-expect-error` — Next.js recognizes them natively.
- `WagmiAdapter` `networks` parameter requires a mutable array, not `as const` (readonly). Use `[base]` not `[base] as const`.
- Avoid `setState` in `useEffect` for wagmi hook-derived state. Instead derive step/error from hook results in the render body (computed variables). Use `useRef` for idempotent receipt processing.
- ethers v6: `Wallet.fromPhrase()` returns `HDNodeWallet`, not `Wallet`. These types are incompatible due to `#private` member differences. Use `HDNodeWallet.fromPhrase()` directly and type the signer as `ethers.Signer & { address: string }`.
- EigenCompute `ecloud compute app deploy`: When building from git source with a monorepo, set **build context path** to the subdirectory (e.g. `eigencompute`) and **Dockerfile path** to `Dockerfile` (relative to that context).
