# Plane + GitLab Bridge

A self-hosted, Jira-style project management setup built on **[Plane](https://github.com/makeplane/plane)** (community edition) with **two-way GitLab integration** and Plane's **built-in Gantt/Timeline** for progress.

Plane already provides the project management and Gantt views. This repo adds the missing piece — a small **bridge service** that keeps a self-managed GitLab in sync with Plane (the polished GitLab integration in Plane itself is partly Pro-gated).

```
                 issue/MR/push webhooks                 issue webhooks (HMAC)
   GitLab  ───────────────────────────►  Bridge  ◄───────────────────────────  Plane
 (self-mgd) ◄──────────────────────────  (FastAPI) ──────────────────────────►  (self-hosted)
                  REST /api/v4                              REST /api/v1
```

**What the bridge does**

- **Bidirectional issue sync.** A new GitLab issue creates a Plane work item; edits/labels/close/reopen flow **both ways** once linked. (Plane-origin items stay Plane-only by default — see `CREATE_MISSING_GITLAB_ISSUE`.)
- **MR/commit → state automation.** Branch names, MR titles/descriptions, and commit messages referencing `PROJ-123` link to that work item. Opening an MR moves it to *In Progress*, merging to *Done*; a commit saying `Closes PROJ-123` completes it. A backlink comment is posted on the work item.
- **Gantt feed.** GitLab due dates map to Plane `target_date`, so items render as bars on Plane's Timeline/Gantt.
- **No sync loops.** Dedicated bot accounts on each side let the bridge ignore its own echoed webhooks; a content hash and a delivery-dedupe ledger back this up.

---

## Layout

```
plane-pm/
├── docker-compose.override.yml   # adds `bridge` to Plane's compose stack
├── plane-app/                    # created by Plane's setup.sh (NOT in this repo)
└── bridge/                       # the FastAPI sync service (this repo)
    ├── app/ ...                  # routers, clients, sync engine
    ├── config/projects.yml       # GitLab<->Plane project mappings
    ├── .env.example
    └── Dockerfile
```

---

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2.
- **8–16 GB RAM** recommended — Plane runs ~13 services.
- A reachable self-managed GitLab instance and a Plane admin login.

---

## M0 — Stand up Plane (community)

From `plane-pm/`:

```bash
curl -fsSL -o setup.sh https://github.com/makeplane/plane/releases/latest/download/setup.sh
chmod +x setup.sh
./setup.sh            # choose 1) Install, then 2) Start
```

This creates `plane-app/` with Plane's managed `docker-compose.yaml` and `plane.env`. Open the web UI (default `http://localhost`), create your account, then:

1. **Create a workspace** — note its **slug** (the URL segment) → `PLANE_WORKSPACE_SLUG`.
2. **Create a project** — note its **identifier** (e.g. `PROJ`) and its **UUID** from the project URL → `plane_project_identifier`, `plane_project_id`.
3. **Create a bot member**: invite a dedicated user (e.g. `bridge-bot@yourco`) to the workspace → its **member UUID** is `PLANE_BOT_MEMBER_ID`. *(Members are listed via `GET /api/v1/workspaces/{slug}/members/`.)*
4. **API key**: log in **as the bot**, Profile Settings → *Personal Access Tokens* → add token → `PLANE_API_KEY` (`plane_api_…`).
5. Pick a random **`PLANE_WEBHOOK_SECRET`** (used when you register the webhook in M-final).

On the **GitLab** side:

6. Create a dedicated bot user; as that user, create a **Personal Access Token** with `api` scope → `GITLAB_TOKEN`. Note the bot's numeric **user id** (`/api/v4/user` while authenticated as the bot) → `GITLAB_BOT_USER_ID`.
7. Find each project's numeric **Project ID** (Project → Settings → General) → `gitlab_project_id`.
8. Pick a random **`GITLAB_WEBHOOK_SECRET`**.

> Verify M0: Plane UI loads, and
> `curl -H "X-API-Key: $PLANE_API_KEY" $PLANE_BASE_URL/api/v1/workspaces/$SLUG/projects/`
> lists your project.

---

## Configure the bridge

```bash
cp bridge/.env.example bridge/.env
$EDITOR bridge/.env            # fill in everything from M0
$EDITOR bridge/config/projects.yml   # map gitlab_project_id <-> plane_project_id/identifier
```

Key `.env` values: `PLANE_BASE_URL` (use `http://api:8000` when on Plane's network), `PLANE_WORKSPACE_SLUG`, `PLANE_API_KEY`, `PLANE_WEBHOOK_SECRET`, `PLANE_BOT_MEMBER_ID`, `GITLAB_BASE_URL`, `GITLAB_TOKEN`, `GITLAB_WEBHOOK_SECRET`, `GITLAB_BOT_USER_ID`. Defaults for sync policy/toggles are documented inline.

---

## Build & run the bridge

```bash
docker compose \
  -f plane-app/docker-compose.yaml \
  -f docker-compose.override.yml \
  up -d --build bridge

curl http://localhost:8765/healthz       # -> {"status":"ok"}
```

(If Plane pins services to a named network, see the comments in `docker-compose.override.yml`.)

---

## Register webhooks

**Plane** → Workspace Settings → *Webhooks* → add:
- URL: `http://bridge:8000/webhooks/plane` (internal name on Plane's network)
- Secret: `PLANE_WEBHOOK_SECRET`
- Events: **Work Items** (issues).

**GitLab** → each project → Settings → *Webhooks* → add:
- URL: `http://<bridge-host>:8765/webhooks/gitlab`
- Secret token: `GITLAB_WEBHOOK_SECRET`
- Triggers: **Issues events**, **Merge request events**, **Push events**.

---

## Verify end-to-end

1. **GitLab → Plane (M1):** create issue *"Build login"* in the mapped project → a Plane work item `PROJ-N` appears. Edit the title → it updates; close it → it moves to a completed state.
2. **Plane → GitLab + loop guard (M2):** edit `PROJ-N`'s description in Plane → the GitLab issue updates **once**. `GET http://localhost:8765/sync/events` shows the echoed Plane webhook as `skipped_echo` — no loop.
3. **MR state machine (M3):** branch `PROJ-N-login`, open an MR → `PROJ-N` → *In Progress* with an MR backlink comment; merge the MR → *Done*.
4. **Gantt (M4):** set the GitLab issue's due date → `PROJ-N` gets a `target_date` and shows as a bar on Plane's **Timeline/Gantt**.
5. **Resilience (M5):** redeliver a webhook from GitLab's webhook UI → no duplicate (deduped). `docker restart plane-gitlab-bridge` mid-sync → pending events resume.

---

## Operate

- `GET /healthz` — liveness.
- `GET /sync/status` — event counts by status.
- `GET /sync/events?status=failed&limit=50` — recent (failed) events with errors.
- `POST /sync/retry/{id}` — requeue a failed event.
- Logs: `docker logs -f plane-gitlab-bridge`.

---

## Local development (no Docker)

```bash
cd bridge
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env       # set BRIDGE_DB_URL=sqlite:///./bridge.db and real values
export PROJECTS_CONFIG_PATH=./config/projects.yml
uvicorn app.main:app --reload --port 8000
pytest                     # run the test suite
```

Plane requires a **non-localhost** webhook URL, so for local runs expose the bridge with a tunnel (`cloudflared tunnel --url http://localhost:8000` or `ngrok http 8000`) and register that URL.

---

## Behavior & tuning (`.env`)

| Setting | Default | Meaning |
|---|---|---|
| `CREATE_MISSING_PLANE_ISSUE` | `true` | New GitLab issue → create Plane work item. |
| `CREATE_MISSING_GITLAB_ISSUE` | `false` | New Plane item → create GitLab issue (off = Plane-only items). |
| `SYNC_TITLE/DESCRIPTION/STATE/LABELS/DATES` | `true` | Per-field sync toggles. |
| `SYNC_ASSIGNEES` | `false` | Assignee mapping (best-effort; needs user mapping). |
| `DELETE_BEHAVIOR` | `close` | On delete, close the counterpart (never hard-delete). |
| `IDENTIFIER_REGEX` | `\b([A-Z][A-Z0-9]+)-(\d+)\b` | How `PROJ-123` refs are found in branches/MRs/commits. |
| `DEDUPE_TTL_SECONDS` | `120` | Window for dropping duplicate deliveries. |
| `MAX_ATTEMPTS` | `5` | Retries before an event is marked `failed`. |

Per-project MR-state names are overridable in `projects.yml` via `state_group_map`.

---

## Known limitations

- Conflict resolution is field-level last-writer-wins; the content hash prevents thrash but simultaneous edits on both sides can race.
- One worker process (ordered, simple). Scale path: move the queue to `arq` on Plane's valkey.
- Plane's REST API doesn't expose pages/integration endpoints, so only work items are synced.
- Assignee sync is best-effort (GitLab usernames ≠ Plane members without a mapping).
