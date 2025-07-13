Below is a structured backlog proposal that starts with the **Minimum Viable Product (MVP)** for “Stands” and then sketches the epics that open the path for the broader roadmap you described.  Each epic contains the key features required to satisfy the persona‑driven user stories and to keep the architecture extensible when you add other asset categories (Airfield, Gates, etc.).

---

## 1 Platform & Foundation Epics (apply to MVP and all later releases)

| Epic                                 | Purpose                                                                                                                                  | Representative Features\*                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.1 Identity & Access Management** | Support the seven roles (Admin‑Support, Client Admin, Asset Owner, Airport Planner, Key Stakeholder, Third‑Party Contractor, Requester). | • Single Sign‑On (SSO)/password auth <br>• Role‑based permission matrix <br>• Tenant scoping (separate client data) <br>• MFA & session management                |
| **1.2 Core Data Model & API**        | Unified data schema that every module reads/writes; public GraphQL/REST endpoints.                                                       | • Airport → Asset Category → Asset hierarchy <br>• Work Request & Work Order entities <br>• Versioning & audit trail tables <br>• API gateway & service contracts |
| **1.3 UI Design System**             | Consistent components and responsive grid that can render maps, dashboards and forms.                                                    | • Atomic component library (buttons, tables, cards) <br>• Adaptive theming for white‑label clients <br>• Accessibility (WCAG 2.2 AA)                              |
| **1.4 Security & Compliance**        | Meet airport‑sector security expectations.                                                                                               | • Encryption at rest & in flight <br>• Role‑based field‑level ACLs <br>• Data‑retention & deletion policies (GDPR)                                                |
| **1.5 Observability & Ops**          | Keep service reliable as it scales.                                                                                                      | • Centralised structured logging <br>• Real‑time health + SLA dashboards <br>• Feature‑flag framework <br>• Automated canary deploy pipeline                      |

\* Only the highest‑yield items are listed; acceptance criteria and estimates are left for team backlog refinement.

---

## 2 MVP Epics – **“Stands” Work‑Scheduling**

| Epic                                           | Description                                                       | Key Features                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.1 Stand Repository**                       | Single source of truth for every stand.                           | • CRUD for stand profile (location geometry, dimensions, airline compatibility) <br>• Capability tags (power, dual‑taxi capability, GPU availability…) <br>• Bulk import (CSV/Excel, AODB feed)           |
| **2.2 Stand Live Map & Status Layer**          | Visual, filterable map that anyone can load first thing each day. | • SVG/Canvas map render with zoom / pan <br>• Colour/status icon overlays (Normal, Work‑In‑Progress, Closed) <br>• Tooltip & side‑panel details <br>• Time‑slider to scrub historic/future states         |
| **2.3 Work Request Capture**                   | Let Requesters or 3rd‑Party Contractors lodge a job.              | • Guided request wizard (asset, dates, description, attachments) <br>• Validation (date conflicts, mandatory docs) <br>• Draft/save, edit, withdraw                                                       |
| **2.4 Approval Workflow**                      | Route the request to the correct Asset Owner.                     | • Kanban‑style inbox (New, In Review, Info Required, Approved, Rejected) <br>• Comment thread & docs <br>• Delegation rules (e.g., holiday cover) <br>• SLA timers and reminders                          |
| **2.5 Capacity & Impact Analytics (MVP‑Lite)** | First‑pass capacity gauge focused on stand availability only.     | • Capacity calendar (daily/weekly) showing stands unavailable vs total <br>• Basic knock‑on alert: “This closure removes one Code E stand; utilisation >95 % next Thursday” <br>• CSV export for planners |
| **2.6 Notifications & Stakeholder Sharing**    | Keep everyone in the loop.                                        | • Email & in‑app notifications (submit, approval, change, reminder) <br>• Public share link (read‑only) for Key Stakeholders <br>• Calendar feed (iCal)                                                   |
| **2.7 Audit & Reporting**                      | Essential for regulated change control.                           | • Immutable history log for each work request <br>• Stand utilisation report (time filtered) <br>• KPI dashboard (requests per month, mean approval time)                                                 |

---

## 3 Progressive Epics (post‑MVP)

These epics are *designed* but not implemented until capacity and commercial priorities allow.

| Order   | Epic                              | Adds…                                                 | Notable New Features & Considerations                                                                                                                                  |
| ------- | --------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3.1** | **Asset‑Category Expansion**      | Airfield, Gates, Check‑in, Baggage, Security, Parking | • Modular asset schemas extending the core model <br>• Custom map layers / 3‑D view for terminal interiors <br>• Category‑specific KPIs (e.g., bags /hr, pax lanes)    |
| **3.2** | **Advanced Capacity Engine**      | Scenario modelling & forecasting                      | • Monte‑Carlo capacity risk analysis (draws on CapaCity project IP) <br>• Dependency rules (e.g., stand closed ⇒ gate closed) <br>• What‑if sandbox & dashboard export |
| **3.3** | **Scheduling Optimiser**          | Suggest best outage windows                           | • Heuristics/AI engine recommending dates with least capacity impact <br>• “Batch similar works” bundling <br>• Gantt view of asset downtime                           |
| **3.4** | **Mobile Companion**              | Field visibility & sign‑off                           | • QR‑code stand check‑in <br>• Offline checklist capture <br>• Push approvals                                                                                          |
| **3.5** | **Third‑Party Portal**            | Self‑service onboarding for contractors               | • company profile management <br>• insurance / safety doc vault                                                                                                        |
| **3.6** | **Integration Hub**               | Open data exchange                                    | • Webhooks to AODB, CMMS, BIM models <br>• Outbound change notices to airport‑wide ops systems                                                                         |
| **3.7** | **AI Insights & Recommendations** | Continuous improvement                                | • Impact narrative auto‑generated for stakeholders <br>• Predictive clash detection across simultaneous asset categories                                               |
| **3.8** | **Marketplace / Add‑Ons**         | Revenue diversification                               | • Sell advanced analytics, compliance packs, bespoke reports                                                                                                           |

---

## 4 How the Epics Map to Your Personas & Stories

| Persona / Story Excerpt                                             | Covered by Epics…   |
| ------------------------------------------------------------------- | ------------------- |
| **Asset Owner** – “see all changes, finish dates, capacity impact”  | 2.1 – 2.5, 2.7, 3.2 |
| **Airport Planner** – “understand capacity & utilisation”           | 2.5, 2.7, 3.2, 3.3  |
| **Project Manager / Requester** – “perform upgrades, need approval” | 2.3, 2.4, 2.6       |
| **Key Stakeholder** – “view‑only awareness”                         | 2.6, 2.7            |
| **3rd‑Party Contractor** – “raise requests, limited view”           | 2.3, 2.6, 3.5       |
| **Admin roles** – “manage accounts, base airport”                   | 1.1, 1.2, 1.5       |

---

## 5 Next Steps for Your Product Team

1. **Back‑log Grooming:** Break the MVP epics into estimated user stories; surface cross‑team dependencies (e.g., map component needs API for geometry).
2. **Technical Spikes:**
   • Evaluate map stack (Leaflet, Mapbox GL, Cesium for 3‑D).
   • Prototype capacity calculation logic for stands to validate data granularity.
3. **Architecture Decisions:** Event‑driven vs. REST for request state changes; tenancy model (single database with tenant\_id vs. separate DB per client).
4. **Delivery Plan:** Incremental releases—start with stand repository & read‑only map, then add request submission, then approval workflow, then analytics.
5. **Change‑Management Readiness:** Asset owners often require training and data‑migration scripts; include a Change & Adoption workstream parallel to development.

---

### Why This Structure Works

* **Vertical slices** – Each epic can be delivered independently into production, providing user value while building on the same foundation.
* **Scalable data model** – By designing the core entities once, adding new asset categories mostly becomes UI and rules work, not database surgery.
* **Built‑in growth path** – The advanced capacity engine and optimisation epics reuse data captured from day 1, making your MVP investment compounding rather than disposable.

This roadmap should give you a clear, manageable backlog for the first development phase while leaving the runway (pun intended!) for the broad capabilities you envision.

Below is a **step‑by‑step “bootstrap roadmap”** that gets you from zero to a live production stack, while keeping every stage small, testable and reversible.  The sequence is intentionally **infrastructure‑first, features‑second**, because a solid pipeline makes every later feature cheaper to ship and safer to change.

---

## 0 Pre‑flight (set up once, \~½ day)

| Item                                       | Why it matters                                        | Actions                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **0.1 GitHub monorepo & branching policy** | Single source of truth for FE/BE; enables atomic PRs. | • `main` (prod) / `develop` (staging) / feature branches. <br>• Conventional Commits + semantic‑release tags. |
| **0.2 Issue tracking & board**             | Keeps infra tasks visible alongside user stories.     | • GitHub Projects board with swim‑lanes: Foundation, Pipeline, Features.                                      |
| **0.3 Local tool chain**                   | Same command set for every dev.                       | • VS Code Dev‑Container config, Prettier/ESLint, Husky pre‑commit hooks.                                      |

---

## 1 Local “All‑in‑Docker” Environment (1‑2 days)

> Goal: *`docker compose up` → running Next.js, Node API and Postgres with seed data.*

1. **Compose file**

   ```yaml
   services:
     db:          postgres:16
     backend:     node:20-alpine
     frontend:    node:20-alpine
   ```

   *Mount local code into containers; hot‑reload via `nodemon` and Next.js dev server.*

2. **Shared `.env` template** (checked‑in example, real secrets via `.env.local`).

3. **DB migration tool** – pick **Prisma** or **Knex**; initialise with *empty* schema + seed script.

4. **Healthcheck endpoints**:

   * GET `/healthz` in backend
   * `/_healthz` page in Next.js.

5. **Task runners & tests**

   * Jest/Vitest unit tests pass inside containers.
   * ESLint, TypeScript strict.

---

## 2 Local Staging Environment (“dev stack”) (1 day)

> Runs the same Docker images but in an isolated network on the dev’s machine.

* **`docker compose -f docker-compose.dev.yml`** – identical to prod images, just with dev config.
* Enables realistic end‑to‑end tests before pushing code.

---

## 3 CI Pipeline & Image Registry (2 days)

| Step                            | Tooling                    | Key jobs                                                                                                                                                        |
| ------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3.1 GitHub Actions workflow** | `.github/workflows/ci.yml` | 1. Checkout <br>2. Cache deps <br>3. Run tests & lints <br>4. Build Docker images (FE, BE) <br>5. Push to GitHub Container Registry (`ghcr.io`) with `sha` tags |
| **3.2 Status checks**           | GitHub branch protection   | PR cannot merge into `develop`/`main` unless CI green.                                                                                                          |

---

## 4 Staging Cloud Environment (“preview”) (1‑2 days)

> Automatic deploy on every push to `develop`.

| Layer          | Service                            | Setup steps                                                                                     |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Frontend**   | **Vercel preview**                 | • Connect repo. <br>• Build command `pnpm build` <br>• Env vars via Vercel UI.                  |
| **Backend**    | **Railway “Environment: staging”** | • Import image from GHCR. <br>• Auto‑deploy from `develop` tag.                                 |
| **Database**   | **Supabase “project‑staging”**     | • Use Supabase CLI for migrations. <br>• Seed with sample data.                                 |
| **CI/CD glue** | GitHub Actions                     | • After image push, call Vercel/Railway deploy APIs. <br>• Run Supabase migration CLI in a job. |

*Outcome: A live URL your QA or product owner can open in minutes after a merge.*

---

## 5 Production Cloud Pipeline (2‑3 days)

| Task                                    | Details                                                                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5.1 Provision prod resources**        | • Vercel prod project (custom domain). <br>• Railway prod environment. <br>• Supabase prod project (point‑in‑time‑recovery).                                                                                                 |
| **5.2 Secrets & config**                | • Use GitHub Environments (`production`) with encrypted secrets. <br>• Enable Supabase RLS & backups.                                                                                                                        |
| **5.3 GitHub Actions release workflow** | Triggered only on merge to `main` or version tag: <br>1. Build & push prod‑labelled images. <br>2. Deploy FE to Vercel. <br>3. Deploy BE to Railway. <br>4. Run migrations against Supabase (fail build if migration fails). |
| **5.4 Observability**                   | • Enable Vercel web‑vitals and log drains. <br>• Railway metrics & alerts. <br>• Supabase logs to Grafana/Loki (optional early).                                                                                             |
| **5.5 Rollback strategy**               | • Previous Docker image tags kept 30 days; Railway “rollback” button. <br>• Supabase → point‑in‑time restore to shadow db for hot‑fix.                                                                                       |

---

## 6 Foundation Complete ⇒ Start Feature Work

With pipelines stable, switch the team’s **Definition of Ready** for any feature to:

1. **DB migration written + test data script.**
2. **API contract (OpenAPI or GraphQL type) committed.**
3. **Front‑end storybook component drafted** (if UI).
4. **CI passes** against staging.

---

## 7 Recommended Feature Order (mirrors your plan)

| Sprint(s) | Feature Slice                            | Notes                                                      |
| --------- | ---------------------------------------- | ---------------------------------------------------------- |
| **A**     | **Asset Repository (core tables & API)** | Stands only; CRUD in admin UI.                             |
| **B**     | **Stand Maintenance Workflow**           | Request wizard → approval board.                           |
| **C**     | **Stand Map & Status Layer**             | Leaflet + PostGIS `geometry`.                              |
| **D**     | **Gates asset schema + visuals**         | Re‑use repository & map components.                        |
| **E**     | **Airfield asset schema + visuals**      | Introduce layer toggling / filters.                        |
| **F**     | **Capacity Calculation v1**              | Stands + Gates + Airfield; baseline utilisation dashboard. |

*(Treat each slice as vertical: DB → API → UI → tests.)*

---

### Time‑boxed Milestones (illustrative)

| Week | Deliverable                                            |
| ---- | ------------------------------------------------------ |
| 1    | Local Docker dev env running tests.                    |
| 2    | CI image build + push; “green” PR gate.                |
| 3    | Auto‑deploy to staging on `develop`.                   |
| 4    | Prod pipeline live; dummy “Hello World” in prod URLs.  |
| 5    | Stand tables & admin CRUD live in staging.             |
| 7    | End‑to‑end stand request flow demo.                    |
| 10   | First airline stand‑closure scheduled via prod system. |

---

## Tooling Cheat‑Sheet

| Concern           | Tool                                     | Why                                       |
| ----------------- | ---------------------------------------- | ----------------------------------------- |
| **DB migrations** | **Prisma** (schema‑first, TS types)      | Works with Supabase, generates client.    |
| **Secrets**       | **Doppler** or Vercel/Railway native     | Single command to inject into local & CI. |
| **Testing**       | **Vitest** + **Supertest**               | Fast TS unit + API integration tests.     |
| **Lint/format**   | **ESLint**, **Prettier**, **Commitlint** | Consistent codebase.                      |
| **Monitoring**    | **Sentry** (FE+BE)                       | Free tier sufficient early.               |

---

### Why this Order?

* **Local first** – every dev can work offline and reproduce prod bugs.
* **CI next** – you codify the build once; humans never build manually again.
* **Staging before prod** – safe place for migrations/tests on real cloud infra.
* **Prod last, but early** – real URLs build confidence & uncover env gaps.
* **Vertical feature slices** – faster user feedback, easier rollback than big‑bang asset models.

Follow this sequence and you’ll have a **repeatable, automated pathway** from a line of code on a laptop to a resilient production service—ready to layer on the rich asset and capacity features your roadmap calls for.

Below is a concise checklist of **decisions and tasks you should tackle *now*—before the first line of production code—to guarantee that every future module (Capacity Calculator, Planning, Monitoring, etc.) can be shipped, priced and deployed independently without re‑architecting later.**

---

## 1 Define “Module” at Three Layers

| Layer            | What “separate” really means                                                           | What to decide today                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain**       | Clearly bounded context, own business vocabulary and rules.                            | • Produce a short *Context Map* (e.g. Assets, Work‑Scheduling, Capacity, Planning, Monitoring). <br>• Agree team ownership per context.                             |
| **Code & Build** | Source code lives in its own package/workspace, can be compiled & tested in isolation. | • Adopt a monorepo tool with *first‑class workspaces*—**pnpm + Nx** or **Turborepo**. <br>• Each module == one backend package + (optionally) one frontend package. |
| **Runtime**      | Can be deployed, scaled and versioned independently.                                   | • Container‑per‑module model (micro‑service) ***or*** modular monolith now + roadmap for extraction. <br>• Gateway layer (API & auth) that routes to modules.       |

*You can start with a **modular monolith** (one Node container) but the build pipeline should still output one **Docker image per module** so you can split them later with zero refactor.*

---

## 2 Entitlement & Licensing Rails (build once, reuse forever)

> The biggest “future tax” in pay‑per‑module SaaS is **who owns what**, not code. Wire this in immediately.

1. **Billing Provider Integration (Stripe, Paddle…)**

   * Create *Products* that map 1‑to‑1 to modules.
   * Webhook on successful purchase → “Entitlement Service”.

2. **Entitlement Service (one tiny table, one tiny API)**

   * Schema: `organisation_id, module_key, status, valid_until`.
   * Cached in Redis; refreshed on webhook.
   * Every backend request passes a middleware that asserts entitlement.

3. **Feature Flags on the Front‑end**

   * Send the entitlements array in JWT/userContext.
   * Use React context or **LaunchDarkly**/**Unleash** to show/hide routes & nav items.

This gives you “turn on Module X” with **zero deploys** per customer.

---

## 3 Codebase Layout Example (pnpm + Nx)

```
repo-root/
  apps/
    api-gateway/          # Nest.js or Express concentrates auth/routing
    web/                  # Next.js (can host micro-frontends later)
  packages/
    assets-module/        # Node lib → REST/GraphQL routes + domain logic
    work-schedule-module/
    capacity-module/
    planning-module/
    monitoring-module/
    shared-kernel/        # Auth, logging, error types
```

* Nx “tags” prevent accidental cross‑imports: `shared-kernel` is allowed everywhere; modules cannot reference each other directly—only via events or gateway calls.\*

---

## 4 Build & CI Pipeline Changes

1. **Matrix Build**

   * GitHub Actions job matrix over `packages/*` that changed.
   * Each module builds → Docker image `{module}:{sha}` → pushes to GHCR.

2. **Versioning**

   * Independent semver for each module (`assets@1.2.3`, `capacity@0.1.0`).
   * Nx can auto‑bump affected modules; `changesets` generates changelogs.

3. **Deploy Jobs per Module**

   * **Railway**: one service *per* backend module (cheap, scales to zero).
   * **Vercel**: if you later adopt *Module Federation*, each FE micro‑app deploys separately; otherwise a single Next.js app just tree‑shakes unused code with dynamic imports.

4. **Gateway Release**

   * Separate job because it lists new routes once a new module is live.
   * Canary deploy behind a header/flag for the first customer.

---

## 5 Data & Schema Strategy

| Principle                          | Implementation tip                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema‑per‑module**              | In Postgres/Supabase, create logical *schemas* (`assets`, `work`, `capacity` …). Prisma can map each workspace to its own schema.        |
| **No cross‑module FK constraints** | Keep boundaries clean—reference by `uuid`, enforce integrity in code/events.                                                             |
| **Shared read‑only views**         | If Capacity needs Asset data, expose a DB *view* or event‑driven replica table, not direct writes.                                       |
| **Multi‑tenant ID pattern**        | Always prefix tables with `organisation_id` PK part; Supabase Row‑Level‑Security can then enforce both tenancy *and* module entitlement. |

---

## 6 Inter‑Module Communication

1. **Event Bus (async)**

   * Start cheap: **Postgres LISTEN/NOTIFY** or **Supabase Realtime** for domain events (`work.approved`, `asset.updated`).
   * Abstract behind a small publisher so you can swap to NATS/Kafka later.

2. **Internal API (sync)**

   * Private REST/GraphQL “module APIs” discoverable via gateway DNS (`capacity.internal:4000`).
   * Versioned; breaking changes never ripple across modules.

---

## 7 Front‑end Modularity Options

| Stage     | Approach                                                                        | When to adopt                                               |
| --------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Now**   | *Dynamic imports* per module (`import("capacity-ui")`). Hidden by feature flag. | Zero extra infra; good until >3‑4 separately staffed teams. |
| **Later** | *Module Federation* or *micro‑frontends* deployed to Vercel Edge.               | When separate release cadence or ownership is required.     |

Either way, keep **route namespaces** (`/assets/*`, `/work/*`, `/capacity/*`) so URLs don’t change if you split later.

---

## 8 Early “Do‑it‑now” Task List (1 sprint)

1. **Choose workspace tool & generate skeleton** (Nx preset for Next.js + Node).
2. **Create `shared-kernel` package** (logger, config, auth utils).
3. **Stub three modules** (`assets`, `work`, `capacity`) each exposing:

   * `index.ts` with Nest.js/Express router registering `/health`.
   * Prisma schema in its own folder & migrations.
4. **Implement Entitlement Service** (simple in‑memory map + REST GET `/entitlements`).
5. **Adjust CI matrix to build all four images** (gateway + three modules).
6. **Add middleware in gateway** that:

   * Authenticates user.
   * Fetches entitlements.
   * Rejects request if route’s module unauthorised.
7. **Update Next.js NavBar** to read entitlement flags.

You have now *hard‑wired modularity* even though the user sees nothing new—future add‑ons are a shape you can stamp out in hours, not weeks.

---

### Pay‑off

* **Commercial flexibility:** Sales can quote “Assets + Work = Base‑Tier; add Capacity for +£X” without an engineering fire‑drill.
* **Operational safety:** Modules crash in isolation; gateway returns 503 for that capability only.
* **Developer velocity:** Teams own code & pipelines without merge conflicts in one giant service.

Implementing these structural pieces up‑front costs roughly **one extra sprint** today but saves months of re‑platforming when your catalogue hits double‑digits.

Below is a **re‑worked foundation roadmap** that merges everything we discussed so far — **pipeline first, but with hard‑wired modularity and commercial entitlements from day 1**.  It replaces (not merely augments) the original step‑by‑step you approved earlier.

---

## 0 Strategic Decisions (make this Week 0)

| Why you must decide now                                                                                   | Decision & Recommendation                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package/workspace manager** – every later build script, TypeScript path and test runner relies on this. | **pnpm + Nx** monorepo (best dev‑prod parity, incremental builds, independent versioning).                                                                               |
| **Runtime granularity** – micro‑services vs modular monolith.                                             | **Modular monolith to start** (one Node image containing all modules) **but** the build *also* produces an image **per module** to let you split later without refactor. |
| **Entitlement system** – pay‑per‑module SaaS.                                                             | Stripe → Webhook → *Entitlement Service* table (`organisation_id, module_key, status`).  Middleware in API‑gateway reads this on every call.                             |
| **Database namespace strategy**.                                                                          | Each module owns its own **Postgres schema** (`assets`, `work`, `capacity`, …) with zero cross‑schema FKs.  Shared read‑only **views** for data exchange.                |
| **Event exchange pattern**.                                                                               | Start with **Postgres LISTEN/NOTIFY** events behind a thin wrapper.  Swap to NATS/Kafka when traffic justifies.                                                          |

---

## 1 Repo & Workspace Skeleton (Sprint 1)

```
repo-root/
  apps/
    api-gateway/          # Nest.js or Express
    web/                  # Next.js (monolith front end for now)
  packages/
    shared-kernel/        # Auth, logger, config utils
    assets-module/
    work-module/
    capacity-module/
    planning-module/
    monitoring-module/
    entitlement-service/  # Tiny service + DB migrations
```

* Nx tags: `shared-kernel` allowed everywhere; each `*-module` cannot import another directly (forces proper boundaries).\*

---

## 2 Local Developer Experience (still Sprint 1)

| File                     | Key responsibilities                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.dev.yml` | **Three** containers: `db` (Postgres 16), `gateway`, `web`.  `gateway` mounts all module code; hot‑reload via `ts-node-dev`. |
| `.env.example`           | One template for all modules; secrets overridden per container.                                                              |
| `prisma/` per module     | Schema init: `schema = "assets"` etc.  Command `pnpm db:migrate --filter=assets-module`.                                     |
| Health endpoints         | `/api/healthz` (gateway) and `/healthz` (each module).                                                                       |

Outcome: `pnpm infra:up` → running Next.js page and “module health grid” on localhost.

---

## 3 CI & Build Matrix (Sprint 2)

| Pipeline                | Action                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Lint‑Test job**       | Nx affected‑graph → run ESLint, Vitest only for changed workspaces.                                                         |
| **Docker build matrix** | For every changed `*-module`, build and push `{module}:{sha}` to **GHCR**.  Also build `gateway:{sha}` and `web:{sha}`.     |
| **Semver & changelogs** | `changesets` + Nx to bump *only* the touched modules.  Changelog file per module; release notes aggregated for the gateway. |

---

## 4 Cloud Staging Stack (Sprint 3)

| Layer                | Service                                                                                                                                                                                                                      | Deploy rule |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Gateway**          | Railway service **`gateway-staging`** – image `gateway:{sha}` on every merge into `develop`.                                                                                                                                 |             |
| **Backend Modules**  | For now these *ship inside the same image*, but the pipeline still produces `assets-module:{sha}`, `work-module:{sha}`, etc.  When you out‑grow the monolith, simply switch the Railway service to pull the dedicated image. |             |
| **Frontend**         | Vercel Preview (linked to `develop`).  Feature flags driven by entitlements decide which pages appear.                                                                                                                       |             |
| **DB**               | Supabase **`project-staging`** – schemas `assets`, `work`, …  CLI migrations run within CI.                                                                                                                                  |             |
| **Entitlement Sync** | After Stripe test‑mode purchase, webhook calls Supabase RPC that inserts/updates `entitlement` table.                                                                                                                        |             |

---

## 5 Production Release Pipeline (Sprint 4)

1. **Merge to `main`**

   * Triggers same Nx matrix, but images get a **`prod-{semver}`** tag.
   * Runs Supabase migrations *inside* a job guarded by “I understand this is prod” confirmation comment on the PR.

2. **Deploy order**

   1. Database migrations (can roll back with Supabase point‑in‑time).
   2. Backend image(s) pushed to Railway.  Gateway healthcheck = green.
   3. Vercel deploy.  Smoke test end‑to‑end.
   4. Tag release in GitHub; create draft GitHub Release notes (one line per changed module).

3. **Blue/green toggle** – Railway and Vercel both support instant rollback if synthetic tests fail.

---

## 6 Feature Delivery Pattern (from Sprint 5 onward)

> *“Vertical slice” still applies, but you now add a *module* the first time that capability appears.*

| First‑time Capability                  | Steps (all in a single PR series)                                                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New Module (e.g., Planning)**        | 1. Create `planning-module` workspace skeleton. <br>2. Add Prisma schema & migration in its namespace. <br>3. Register router with gateway under `/planning/*` but guard it with entitlement middleware. <br>4. Create front‑end route using dynamic import and feature flag. |
| **New Feature inside existing module** | Standard CRUD slice: migration → service → controller → React page → Cypress E2E → feature flag if necessary.                                                                                                                                                                 |

Entitlement changes are **data‑only** (no deploy): add a Stripe Product, map that product to `module_key` and you’re done.

---

## 7 Refactoring Path (“Extract micro‑service later”)

When traffic or team size demands independent scaling:

1. **Enable module image on Railway** (already built every CI run).
2. **Redirect gateway**: change route table to hit `https://work-module.internal` instead of in‑process handler.
3. **Turn off module inside monolith** with env flag.

Zero code changes inside the module.

---

## 8 Revised Milestone Timeline (illustrative, given new scope)

| Week | Milestone (✔ means prod)                                                     |
| ---- | ---------------------------------------------------------------------------- |
| 1    | Repo scaffold, Nx workspaces, shared‑kernel ✔                                |
| 2    | Local Docker up; Assets + Work module health ✔                               |
| 3    | CI matrix → images in GHCR; Stripe test purchase grants `assets` entitlement |
| 4    | Staging cloud stack live (gateway + web + DB)                                |
| 5    | Production stack live (empty app but secure, licensed) ✔                     |
| 6    | Assets repository CRUD (stand data) in staging                               |
| 7    | Assets repository in prod ✔                                                  |
| 8    | Work‑Scheduling request flow in staging                                      |
| 9    | Work‑Scheduling in prod ✔                                                    |
| 10   | Capacity module stub created (no UI yet)                                     |
| 12   | Capacity calculator v1 in prod (add‑on SKU) ✔                                |

---

## Summary – What Actually Changed vs. the First Plan?

| Concern                      | Original plan              | **Re‑worked plan**                          |
| ---------------------------- | -------------------------- | ------------------------------------------- |
| **Code structure**           | Single Next.js & Node apps | Nx workspaces, one package per module       |
| **Build artifacts**          | One FE image, one BE image | FE + gateway + **image per module**         |
| **DB layout**                | Single public schema       | Dedicated schema per module                 |
| **Entitlement & licensing**  | Post‑MVP nice‑to‑have      | **Week 1 must‑have** service & middleware   |
| **Micro‑service extraction** | N/A                        | Designed‑in “switchable” extraction path    |
| **Commercial agility**       | Bundled features           | Pay‑as‑you‑go modules, no redeploy required |

By locking in these structural elements now, you guarantee that every future module—capacity, planning, monitoring, or any other airport function—drops into the same grooves without impacting existing customers or forcing a rebuild of your pipeline.

Below is the same “re‑worked foundation roadmap,” but this time **every tool, concept and architectural choice is explained in plain language**.  Feel free to treat it as a reference sheet while you build.

---

## 0 Strategic Decisions (Week 0)

*(“Why do we pick these things?”)*

| Decision                                           | In one sentence, **what it is & why you need it**                                                                                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **pnpm + Nx monorepo**                             | **pnpm** is a fast JavaScript package manager. **Nx** is a build system that turns one Git repository into many isolated “workspaces”. It lets you keep the whole project in one place (easier to search) **but** test, version and deploy each module on its own. |
| **Modular monolith *now*, micro‑services *later*** | A **monolith** is one running program; easy to debug. A **modular monolith** keeps strict internal boundaries so each piece *could* be split out as its own micro‑service when traffic or team size grows.                                                         |
| **Entitlement system**                             | A tiny service (just a database table + some code) that says, “Company A has paid for Modules X and Y until 31 Dec.”  Every API call checks this table, so you can sell modules à‑la‑carte without new code.                                                       |
| **Postgres schema per module**                     | Postgres supports “schemas” (namespaces) inside one database.  Putting each module’s tables in its own schema keeps them separate, like folders on a disk.                                                                                                         |
| **Postgres LISTEN/NOTIFY events**                  | Postgres can broadcast messages on any record change.  Using that as an *event bus* is free and instant; later you can swap to a specialist tool (Kafka, NATS) with the same interface.                                                                            |

---

## 1 Repo & Workspace Skeleton (Sprint 1)

```
repo-root/
  apps/
    api-gateway/      ← Node/Express or Nest.js that terminates HTTPS, authenticates users,
                         checks entitlements, and routes the request to the right module.
    web/              ← Next.js front end (React).  One codebase, but hides pages the
                         customer hasn’t licensed.
  packages/
    shared-kernel/    ← Utility functions shared by everyone: logging, error classes,
                         authentication helpers.
    assets-module/    ← Backend code (routes, services) + database schema for “Asset
                         Repository”.
    work-module/      ← Same but for “Work Scheduling”.
    capacity-module/  ← Stub for the future Capacity Calculator.
    planning-module/  ← Stub for future Planning module.
    monitoring-module/← Stub for future Monitoring module.
    entitlement-service/
                       ← Tiny package exposing “getEntitlements(org_id)” + DB migrations.
```

**Why the split?**
Nx prevents accidental cross‑imports, so “Work Scheduling” can never reach into “Assets” code directly.  They only talk through events or the gateway, which keeps responsibilities clean.

---

## 2 Local Developer Experience

| Piece                | Plain‑English explanation                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker Compose**   | A single YAML file that says “run a Postgres container, a Node container for the gateway, and a Node container for Next.js; wire them together”.  One command (`docker compose up`) reproduces the whole stack on any laptop. |
| **Hot‑reload**       | Tools like `nodemon` watch your files; when you save, the container restarts automatically so you see changes right away.                                                                                                     |
| **Prisma**           | An “ORM” (Object‑Relational Mapper) that turns a `.prisma` file into SQL tables **and** generates TypeScript types.  Each module keeps its *own* Prisma schema pointing at its *own* Postgres schema.                         |
| **Health endpoints** | Simple URLs (`/healthz`) that return “OK” so monitoring tools—and you—can see if a service is alive.                                                                                                                          |

---

## 3 Continuous Integration (CI) & Build Matrix

| Term                            | Explanation                                                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CI (Continuous Integration)** | A robot (GitHub Actions) that compiles, lints and tests your code every time someone pushes.  Stops broken code from reaching teammates.                                                                                                                                       |
| **Nx affected‑graph**           | Nx reads Git history, figures out *exactly which* workspaces changed, and only rebuilds those—saves minutes.                                                                                                                                                                   |
| **Docker image per module**     | The CI workflow turns each module into a standalone “shipping container” with everything it needs to run (`node`, `node_modules`, code). Images are tagged with the Git commit (`{sha}`) and uploaded to **GitHub Container Registry (GHCR)**, a free private Docker registry. |
| **changesets**                  | A tool that scans your PR for a small markdown file (the “changeset”), bumps the semantic version for only the modules that changed, and generates a human‑readable changelog.                                                                                                 |

---

## 4 Cloud Staging Stack (Sprint 3)

*(A safe, internet‑accessible clone of prod.)*

| Layer                   | Service                                                                                                                                                               | What the service actually does |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Gateway – Railway**   | **Railway** is a PaaS (Platform‑as‑a‑Service) that runs Docker images and gives you logs, metrics and rollbacks out‑of‑the‑box.  We upload the monolith image here.   |                                |
| **Frontend – Vercel**   | Vercel hosts Next.js better than anyone (their founders built Next.js).  Every push to `develop` spins up a preview URL so PMs and QA can click around immediately.   |                                |
| **Database – Supabase** | Supabase is “Postgres + auth + realtime + backups” as a managed service.  You still get raw Postgres control, but someone else patches and backs it up.               |                                |
| **Entitlement sync**    | Stripe (test mode) sends a webhook (“customer bought *capacity* module”).  A tiny script writes that into the `entitlement` table in Supabase.  No redeploy required. |                                |

---

## 5 Production Release Pipeline (Sprint 4)

1. **Merge to `main` branch.**
   *CI builds fresh images and tags them `prod‑<version>`.*

2. **Database migrations first.**
   *Prisma applies SQL changes.  If that fails, deployment stops—code never reaches prod with a broken DB.*

3. **Deploy gateway + web.**
   Railway and Vercel each keep the **last good build**, so you can roll back with one click if synthetic tests fail.

4. **Blue/green toggle.**
   Railway spins up the new container *next to* the old one.  Traffic flips over only when health‑checks pass.

---

## 6 Entitlement Middleware (How “paid add‑ons” work)

```mermaid
sequenceDiagram
Client→>Gateway: GET /capacity/report
Gateway->>Entitlement Service: isAllowed(org=42, module="capacity")?
Entitlement Service-->>Gateway: true
Gateway->>Capacity Module: /report
Capacity Module-->>Gateway: JSON
Gateway-->>Client: 200 OK + data
```

*If `isAllowed` returns **false**, gateway sends **403 Forbidden** and never bothers the Capacity module.*

---

## 7 Database Layout Example

```
supabase (postgres)  
├── schema assets
│     └── table stands
├── schema work
│     └── table work_requests
├── schema entitlement
│     └── table entitlements
└── schema capacity
      └── table utilisation_cache
```

*Modules don’t use `JOIN` across schemas.  If Capacity needs stand data, it either:*

1. **Reads a `VIEW`** that Assets publishes, or
2. **Subscribes to an event** emitted by Assets (`stand.updated`) and stores a copy.

---

## 8 Event Bus (Postgres LISTEN/NOTIFY)

```sql
-- Assets module
NOTIFY domain_event, '{"type":"stand.updated","id":"ST123"}';

-- Capacity module
LISTEN domain_event;
```

*Inside Node you add a listener so when Postgres pushes a message, Capacity picks it up and invalidates its cache.*

---

## 9 Path from Monolith to Micro‑service

| When to do it                                               | How it works (zero code change)                                                                                                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| • Gateway CPU hits 70 % steady. <br>• Team size > 2 squads. | 1. Enable `capacity-module:{sha}` image as its *own* Railway service. <br>2. Change load‑balancer route table so `/capacity/*` points to that new URL. <br>3. Disable in‑process handler inside monolith with an env flag. |

Because each module was already compiled into its own image, this is a 30‑minute ops task, not a rewrite.

---

## 10 Glossary – Quick Reference

| Term                                  | Friendly definition                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Nx**                                | A toolkit that organises many projects (packages) in one repository and runs tasks (build, test) only where needed.  |
| **pnpm**                              | Like npm/yarn, but faster and stores packages efficiently.                                                           |
| **Stripe / Paddle etc.**              | Online payment platforms that handle credit‑card processing, invoices, VAT.                                          |
| **Prisma migration**                  | A SQL file that changes the database (create table, add column) generated from the .prisma schema.                   |
| **Supabase Row‑Level Security (RLS)** | Rules that say “only rows where organisation\_id = current\_user.org\_id are visible,” preventing tenant data leaks. |
| **GHCR (GitHub Container Registry)**  | Private Docker image storage built into GitHub; free for reasonable use.                                             |
| **CI Matrix**                         | A CI job that runs the same steps (test, build) in parallel for several targets (here: each module).                 |
| **Blue/green deploy**                 | Two versions of your app run side‑by‑side; you flip traffic when green is healthy, making rollbacks instant.         |
| **Feature flag**                      | A runtime switch (“show capacity pages = true/false”) so you can deploy unfinished code safely.                      |

---

### Putting It All Together

1. **Week 0** – Pick Nx/pnpm, create the monorepo, decide on schemas and entitlement table.
2. **Sprint 1** – Scaffold *gateway*, *web*, *shared‑kernel*, *assets* and *work* modules.  Local Docker up.
3. **Sprint 2** – CI pipeline builds Docker images *per module* and pushes to GHCR.
4. **Sprint 3** – Staging on Railway (backend), Vercel (frontend), Supabase (DB). Stripe test payments grant entitlements.
5. **Sprint 4** – Same stack in production. Rollback and health‑check rules in place.
6. **Sprint 5+** – Start real features (Stand repository, Work Scheduling) following the “vertical slice + entitlement check” pattern.

Once this skeleton is live, **every new capability is “rinse & repeat”:** generate a new module workspace, add tables inside its schema, expose API routes via the gateway, hide/show pages with a feature flag—and let the entitlement service control who sees what.

That’s all the moving parts, in context.  Keep this sheet handy while you wire things together, and you’ll know why every piece exists and how it plugs into the rest of the system.


Below is a **delta‑plan**—everything that changes (and what stays the same) now that you will **provision customers and modules manually after an invoice is paid** instead of letting Stripe do it automatically.

---

## 1 What *doesn’t* change

| Still true                                                                             | Why it still matters                                                                                                               |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Separate, license‑gated “modules”** (Assets, Work Scheduling, Capacity, Planning, …) | Commercially you still need to turn features on/off per customer.  The entitlement table and middleware remain the control switch. |
| **Nx + pnpm monorepo** with one workspace per module                                   | Keeps the codebase modular, builds fast, deploys each module image if/when you split services.                                     |
| **Dedicated Postgres schema per module**                                               | Good boundaries and easy data export; nothing to do with billing.                                                                  |
| **CI/CD, staging, prod stacks** (Railway / Vercel / Supabase)                          | Purely technical; unaffected by how you bill customers.                                                                            |

---

## 2 What *does* change

| Old approach                                   | New approach                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stripe Product → webhook → entitlement row** | **Back‑office Admin Portal or CLI** inserts/updates the entitlement row **after Finance confirms payment.**                                      |
| **Customer self‑service sign‑up**              | **Manual tenant creation workflow**: Ops runs a script or clicks a form that creates the new airport organisation, default roles, and seed data. |
| **Automated “Upgrade Module” button**          | **Sales/Ops request** → Admin portal toggles module flags.                                                                                       |

---

## 3 Revised Components & Flow

```mermaid
flowchart LR
  subgraph Back‑office
    A[Admin Portal<br>(internal web app)]
    B[Ops CLI<br>(script)]
  end
  D[Entitlement Service <br>+ Supabase table]
  G[API Gateway<br>(checks entitlements)]
  C[Customer Front End]
  F[Railway Backend Modules]

  A -->|create tenant<br>or add module| D
  B -->|bulk import<br>or emergency fix| D
  C -->|API call| G
  G -->|allowed? yes/no| F
```

### 3.1 Admin Portal (Internal)

*Tech:* could be a locked‑down page inside the same Next.js project but **behind an “admin” role**.

*Key screens*

| Screen                  | Fields / Actions                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Create Organisation** | • Airport name, IATA code <br>• Contact email <br>• Initial modules (check‑boxes)         |
| **Edit Entitlements**   | • Toggle modules on/off <br>• Set *valid until* date <br>• “Save & Apply” writes to table |
| **Audit Log**           | • Who changed what, when (helps Finance & GDPR).                                          |

### 3.2 Ops CLI (optional but handy)

* A TypeScript script in `/scripts/provision.ts`.
* Runs `pnpm provision --org "LHR"`; it

  1. Creates the organisation row.
  2. Inserts default users (Admin, Asset Owner).
  3. Adds entitlement rows for purchased modules.

Useful when you onboard many airports at once or restore from backup.

---

## 4 Entitlement Table – now *data‑driven* instead of *payment‑driven*

| Column            | Type                        | Purpose                                             |
| ----------------- | --------------------------- | --------------------------------------------------- |
| `organisation_id` | UUID                        | Tenant key; foreign‑keyed to `organisations` table. |
| `module_key`      | TEXT                        | e.g., `assets`, `work`, `capacity`.                 |
| `status`          | ENUM(‘active’, ‘suspended’) | Finance can suspend if invoice unpaid.              |
| `valid_until`     | DATE                        | Optional “subscription expires” date.               |
| `updated_by`      | TEXT                        | Email of admin user or CLI flag.                    |
| `updated_at`      | TIMESTAMP                   | Audit.                                              |

*Gateway middleware logic stays the same:*
`if now() > valid_until OR status != 'active' → 403 Forbidden`.

---

## 5 Manual Tenant Provisioning Workflow (illustrative)

| Step                      | Team            | Tool                                                  | Outcome                                               |
| ------------------------- | --------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| 1. **Quote & Invoice**    | Sales / Finance | Your accounting software (Xero, QuickBooks, etc.)     | Customer agrees to pay.                               |
| 2. **Payment received**   | Finance         | Accounting software marks invoice “Paid”.             | Ops is notified (email or Slack).                     |
| 3. **Create tenant**      | Ops             | Admin Portal “Create Organisation” form OR CLI script | New row in `organisations`.                           |
| 4. **Grant modules**      | Ops             | Same form: tick modules                               | Rows in `entitlements`.                               |
| 5. **Send welcome email** | Ops             | Manual or scripted                                    | Customer gets login URL and temporary password.       |
| 6. **Customer logs in**   | Customer        | Browser                                               | Gateway reads entitlements → shows correct nav items. |

*Optional automation:* If your finance system emits a webhook (“Invoice #123 paid”), you could trigger step 3 automatically later—but start manual and automate only if painful.

---

## 6 Small Adjustments to the Earlier Roadmap

| Backlog Item                   | Original sprint                               | New note                                                                         |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| **Stripe integration**         | Sprint 2                                      | **Removed** – skip.                                                              |
| **Entitlement Service**        | Sprint 1                                      | Keep, but expose `POST /admin/entitlement` secured by admin JWT.                 |
| **Admin Portal UI**            | *New* sprint between pipeline & first feature | 2–3 days for basic CRUD forms; reuse your own design system.                     |
| **Audit Log & Email template** | Was later                                     | Pull into early sprint so finance has evidence & customer gets onboarding email. |

---

## 7 Security Checklist for Manual Provisioning

1. **Separate “admin” and “customer” roles** in Auth:

   * Only admin users can hit `/admin/*` routes.
   * Log IP, user‑agent for every admin action.

2. **Service Accounts** – The Ops CLI should authenticate with a *service‑account key* stored in a GitHub Actions secret or a secure vault, never personal credentials.

3. **Four‑Eyes principle** *(optional but common in aviation IT)* – Put a “require second approval” flag on high‑risk admin actions (e.g., deleting a tenant).

---

## 8 Touchpoints in Code

| File / Area                                     | Change                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **`packages/entitlement-service/src/index.ts`** | Add `createEntitlement`, `updateEntitlement` functions.                                                  |
| **`apps/api-gateway/src/adminRoutes.ts`**       | New Express router: `POST /admin/entitlements` (body validated by Zod/Joi).                              |
| **Next.js `pages/admin/*`**                     | Simple forms using React Hook Form; hits the admin API route.                                            |
| **CI Tests**                                    | Add integration test: create entitlement → hit protected module route → expect 200.  Remove Stripe test. |

---

## 9 Can you postpone any of this?

* You **can** delay the full Admin Portal UI and start with the CLI script only, but you’ll still want a minimal audit log table on day 1.
* Everything else (entitlement middleware, DB schema per module, CI matrix) is still foundational—worth keeping now to avoid retrofitting later.

---

### Final Snapshot of the First Four Sprints

| Week | Deliverable                                                                              |
| ---- | ---------------------------------------------------------------------------------------- |
| 1    | Repo scaffold, Nx workspaces, entitlement table & middleware (but no Stripe).            |
| 2    | Local Docker dev env; Ops CLI can create tenant & entitlements.                          |
| 3    | CI builds per module; staging stack live; Ops CLI proves entitlement enforcement.        |
| 4    | Production stack live; Admin Portal CRUD (MVP); first paying airport onboarded manually. |

Once this is in place, your **feature roadmap (Assets → Work Scheduling → Capacity, etc.) is unchanged**—only the way you flip the switch for each customer differs, and that switch is now in your hands instead of Stripe’s.

Feel free to ask for deeper dives into any specific area (e.g., how to write the Ops CLI, or how to secure the admin routes).


Below is an **ordered milestone checklist**—each line is written as a Markdown checkbox so you can paste the whole list into GitHub Projects, Notion, Jira, or even a plain README and tick items off as they’re finished.
*“Foundations”* take you from zero to a live, modular platform that can be licensed per‑module; *“MVP”* completes the first real capabilities (Stand Asset Repository + Work‑Scheduling flow).

---

## Phase 0 – Decide & Document  *(Week 0)*

* [ ] **Pick tooling standards** – record choices: `pnpm + Nx`, Node 20 LTS, PostgreSQL 16, Prisma, Docker, Railway, Vercel, Supabase.
* [ ] **Write Context Map** – one‑pager that names modules: Assets, Work‑Scheduling, Capacity, Planning, Monitoring.
* [ ] **Define DB namespace policy** – one Postgres *schema per module*, no cross‑schema FKs, shared views only.
* [ ] **Design Entitlement table** – columns `organisation_id`, `module_key`, `status`, `valid_until`.
* [ ] **Security baseline** – roles (`admin`, `customer`) + password policy, MFA requirement, audit‑log rule.

---

## Phase 1 – Repo & Workspace Scaffold  *(Week 1)*

* [ ] **Create GitHub monorepo** with `main` + `develop` branches and branch‑protection.
* [ ] **Add Nx workspace** (`npx create-nx-workspace@latest`).
* [ ] **Generate apps**: `api-gateway` (Nest.js/Express) and `web` (Next.js).
* [ ] **Generate packages**: `shared-kernel`, `assets-module`, `work-module`, `entitlement-service` (capacity/planning/monitoring can be empty stubs for now).
* [ ] **Configure Nx tags** to block cross‑module imports.
* [ ] **Add Prettier, ESLint, Husky pre‑commit hooks**.

---

## Phase 2 – Local Dev Environment  *(Week 1–2)*

* [ ] **Write `docker-compose.dev.yml`** (Postgres, Gateway, Web).
* [ ] **Add `.env.example`** with all required variables.
* [ ] **Create Prisma schema for each module** (empty table is fine).
* [ ] **Implement hot‑reload** (`ts-node-dev` for Gateway, Next.js dev server for Web).
* [ ] **Add health‑check routes** (`/healthz`) for Gateway and every module.
* [ ] **CLI script `provision.ts`** – creates organisation row + entitlements.

---

## Phase 3 – Continuous Integration & Images  *(Week 2)*

* [ ] **CI workflow (`ci.yml`)** – install deps, lint, test via `nx affected`.
* [ ] **Build Docker image per affected package**; push to **GitHub Container Registry** (`ghcr.io/your-org/{image}:{sha}`).
* [ ] **Generate changelogs with Changesets**; independent semver per module.
* [ ] **Set branch protection** – PR must pass CI before merge.

---

## Phase 4 – Cloud Staging Stack  *(Week 3)*

* [ ] **Provision Supabase project `project-staging`**; enable Row‑Level‑Security.
* [ ] **Add Railway service `gateway-staging`** pulling monolith image.
* [ ] **Connect Vercel Preview to `develop`** branch.
* [ ] **CI job: run migrations in Supabase** on every `develop` build.
* [ ] **Smoke test:** Ops CLI provisions dummy org, entitlements enforced.

---

## Phase 5 – Production Stack & Admin Ops  *(Week 4)*

* [ ] **Create Supabase project `project-prod`** with PITR backups.
* [ ] **Create Railway service `gateway-prod`** (starts with monolith image).
* [ ] **Create Vercel Production project; map custom domain.**
* [ ] **CI “release” workflow** (triggered on `main`) – build `prod‑<semver>` images, run prod migrations, deploy Gateway & Web, run smoke tests.
* [ ] **Implement Admin Portal (internal)** – React pages to create orgs, edit entitlements, view audit log.
* [ ] **Add email template** – send welcome email with temp password after tenant provisioning.
* [ ] **Enable blue/green rollback** in Railway & Vercel.
* [ ] **First real tenant onboarded manually; login confirmed.**

---

## Phase 6 – Core Platform “Done” Checklist

* [ ] Nx workspaces building locally and in CI.
* [ ] One‑command local stack (`docker compose up`).
* [ ] Staging & Prod stacks reachable on the internet, protected by auth.
* [ ] Entitlement middleware blocks/permits access correctly.
* [ ] Admin Portal or CLI can create orgs, users, and toggle modules.

*(When every box above is ticked, you have a reusable foundation for any module.)*

---

## Phase 7 – MVP Feature Slice 1: **Stand Asset Repository**  *(Week 5–6)*

* [ ] **Design Stand tables** (`assets.stands`, capability fields).
* [ ] **Add Prisma migrations** and seed script for sample stands.
* [ ] **Asset Service** – CRUD endpoints (`/assets/stands`).
* [ ] **React Admin pages** – list, add, edit, bulk import CSV.
* [ ] **Unit & integration tests** for API and UI.
* [ ] **Entitlement flag enforced** (requires `assets` module active).
* [ ] **Deploy to staging**; QA sign‑off.
* [ ] **Deploy to prod**; customer demo with real data.

---

## Phase 8 – MVP Feature Slice 2: **Work‑Scheduling**  *(Week 6–8)*

* [ ] **Design tables** (`work.work_requests`, statuses).
* [ ] **Request Wizard UI** – select stand, date range, attach files.
* [ ] **Approval Board** – Kanban columns (New, Info Needed, Approved, Rejected).
* [ ] **Notifications** – email on submit / status change (use Supabase SMTP or Postmark).
* [ ] **Basic validation** – date clashes, required docs.
* [ ] **Gateway entitlement check** (`work` module).
* [ ] **Smoke tests** – create → approve flow passes.
* [ ] **Deploy to staging → prod**; customer walks through first real request.

---

## Phase 9 – MVP Feature Slice 3: **Stand Map & Status Layer**  *(Week 8–9)*

* [ ] **Pick map stack** (Leaflet or Mapbox GL).
* [ ] **Store stand geometry** (WKT or GeoJSON) in `assets.stands`.
* [ ] **Backend `/stands/geo` endpoint** returns GeoJSON.
* [ ] **Front‑end map page** – zoom/pan, status colouring, tooltip with live work info.
* [ ] **Link map → Work‑Request wizard** (click stand to pre‑fill).
* [ ] **Unit & E2E tests** (Cypress) for map interactions.
* [ ] **Deploy to prod**; confirm asset owner can see live status.

---

## Phase 10 – MVP Complete

* [ ] Stand Asset Repository live.
* [ ] Work‑Scheduling workflow live.
* [ ] Interactive Stand Map live.
* [ ] Audit log & admin tooling proven with at least one external customer.
* [ ] Support playbook written (backup, restore, rollback, on‑call rota).

---

### How to Use This List

* Paste into your favourite tracker—GitHub supports check‑box markdown natively.
* Assign each item to a sprint, owner, and estimate.
* Celebrate every tick ✓—the list is front‑to‑back in the exact order that minimises rework and risk.

Good luck building, and feel free to ask for deep dives on any single milestone.
