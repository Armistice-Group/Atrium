<p align="center"><img src="static/favicon.svg" width="64" height="64" alt=""></p>

<h1 align="center">hub·modern</h1>

<p align="center">A simple start page for everything behind <a href="https://github.com/fosrl/pangolin">Pangolin</a>.</p>

hub·modern reads your HTTP resources from Pangolin's Integration API and shows them as a grid of tiles with icons and status, grouped by their Pangolin labels. Put it behind Pangolin itself, so it's only for people who've signed in.

- **No upkeep:** add a resource in Pangolin and it appears. Disabled, TCP/UDP and wildcard resources are left out.
- **Groups from labels:** a resource's first label is its group. The label `hidden` hides it.
- **Icons:** matched by name or hostname from [dashboard-icons](https://dashboardicons.com), with the right variant for light and dark mode. Anything else gets a coloured letter tile.
- **Status:** green when Pangolin's health checks pass (or the site's tunnel is up), amber when degraded, red when down. Refreshes every 30 seconds.
- **Quick to use:** start typing anywhere (or press ⌘K or /) to search, then ↵ to open. Star tiles to pin them to the top (kept in your browser).
- **Extra links:** anything not in Pangolin, plus per-service overrides, in an optional `services.yaml`.

## Set up

### 1. Turn on Pangolin's Integration API

In Pangolin's `config.yml`:

```yaml
flags:
  enable_integration_api: true
```

and route `api.example.com` to `pangolin:3003` in Traefik, as in [Pangolin's guide](https://docs.pangolin.net/self-host/advanced/integration-api). Restart Pangolin. `https://api.example.com/v1/docs` should show the API docs.

### 2. Make an API key

In Pangolin: **your organisation → API Keys → Create**. Give it only **List Resources** (add **List Organizations** if you won't set `PANGOLIN_ORG_ID`). Copy it into `.env`:

```sh
PANGOLIN_API_KEY=...
```

### 3. Run it

```sh
curl -O https://raw.githubusercontent.com/Armistice-Group/hub-modern/main/compose.yaml
# edit PANGOLIN_API_URL (and PANGOLIN_ORG_ID)
touch services.yaml
docker compose up -d
```

### 4. Protect it with Pangolin

Add a resource for the container (port 3049 in the compose file) with **SSO on**, so only signed-in people can see it. Pangolin passes their name to the hub for the greeting.

The tiles link straight to each service, and Pangolin still checks access when one is opened. Everyone who can open the hub sees every tile, so don't use it to keep a service's existence secret.

## Settings

| Variable | Default | |
| --- | --- | --- |
| `PANGOLIN_API_URL` | | The Integration API, ending in `/v1` |
| `PANGOLIN_API_KEY` | | An org API key with List Resources |
| `PANGOLIN_ORG_ID` | first org | Your org's ID (the first slug in the dashboard URL) |
| `HUB_TITLE` | `hub·modern` | The browser tab's title |
| `HUB_DEFAULT_GROUP` | `Services` | Group for resources without a label |
| `HUB_HIDE` | | Names or hostnames to leave out, comma-separated |
| `HUB_NEW_TAB` | `true` | Open services in a new tab (⌘/Ctrl-click does the opposite) |
| `HUB_REFRESH_SECONDS` | `60` | How long the list from Pangolin is reused |
| `HUB_ICONS` | `true` | `false` for letter tiles only (no requests to the icon CDN) |
| `HUB_SERVICES_FILE` | `/data/services.yaml` | Extra links and overrides |

## Develop

```sh
pnpm install
PANGOLIN_API_URL=https://api.example.com/v1 PANGOLIN_API_KEY=... pnpm dev
pnpm check && pnpm test
```

Icons: [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons) (Apache-2.0), loaded from jsDelivr.
