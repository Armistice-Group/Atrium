<p align="center"><img src="static/favicon.svg" width="64" height="64" alt=""></p>

<h1 align="center">hub·modern</h1>

<p align="center">One page with every service behind your <a href="https://github.com/fosrl/pangolin">Pangolin</a>, so you never have to remember a URL again.</p>

hub·modern asks Pangolin which web services you have and shows them as tiles with icons and up/down status. Add a resource in Pangolin and it appears on the page; there's no list to keep up to date. Start typing anywhere to search, press ↵ to open, and star the ones you use most.

---

## Set up

You need: a machine already running Pangolin with Docker, and about ten minutes. Every command runs on that machine.

The finished setup looks like this:

```
you ──► Pangolin (SSO) ──► hub-modern ──► Pangolin's API (internal, read-only)
```

- **Pangolin's SSO is the only way to reach the hub.** The hub has no port of its own on the machine.
- **The hub reads your service list over Docker's private network.** Pangolin's API is never put on the internet.
- **The hub's API key can only list services.** It can't change anything.

### Step 1. Turn on Pangolin's API

Pangolin's API is off by default. Open Pangolin's config file (in the folder you installed Pangolin into, usually `~/pangolin/config/config.yml` or `/opt/pangolin/config/config.yml`). Under `flags:`, add one line:

```yaml
flags:
  enable_integration_api: true   # ← add this line
  # (leave any other flags here as they are)
```

Restart Pangolin from its folder:

```sh
docker compose restart pangolin
```

> You do **not** need to add a Traefik route or a DNS record for the API. Pangolin's own guide shows how to put it on `api.yourdomain`, but the hub doesn't need that: it talks to Pangolin directly inside Docker.

### Step 2. Create a read-only API key

In Pangolin's dashboard:

1. Open your organisation, then **API Keys** in the left menu → **Create API Key**.
2. Name it `hub-modern`.
3. Under permissions, tick **only "List Resources"**.
4. Create it and **copy the key now**. Pangolin shows it once.

While you're in the dashboard, note your **organisation ID**. It's the first part of the path in the address bar: in `https://pangolin.example.com/home-lab/settings/resources`, the ID is `home-lab`.

### Step 3. Find Pangolin's Docker network

The hub joins Pangolin's network so it can reach Pangolin as `http://pangolin:3003`. Check the network's name:

```sh
docker inspect pangolin --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

- **`pangolin_frontend`** (newer installs): nothing to do.
- **`pangolin`** (older installs): you'll put `PANGOLIN_NETWORK=pangolin` in `.env` in the next step.

### Step 4. Start the hub

```sh
mkdir -p ~/hub-modern && cd ~/hub-modern
curl -fsSLO https://raw.githubusercontent.com/Armistice-Group/hub-modern/main/compose.yaml
touch services.yaml
cat > .env <<'ENV'
PANGOLIN_API_KEY=paste-the-key-from-step-2
PANGOLIN_ORG_ID=home-lab
ENV
chmod 600 .env
docker compose up -d
```

(If step 3 said `pangolin`, also add `PANGOLIN_NETWORK=pangolin` to `.env`.)

Check that the hub can reach Pangolin:

```sh
docker exec hub-modern wget -qO- http://pangolin:3003/v1/docs >/dev/null && echo "API reachable"
```

If that fails, step 1 didn't take effect (restart Pangolin again) or the network name in step 3 is wrong.

### Step 5. Put the hub behind Pangolin

In Pangolin's dashboard, **Resources → Add Resource**:

| Field | Value |
| --- | --- |
| Name | `Hub` |
| Type | HTTP |
| Subdomain | whatever you like, e.g. `hub` → `hub.yourdomain` |
| Site | the **local** site (the machine Pangolin runs on) |
| Target | `hub-modern`, port `3000`, method `http` |

Then, on the new resource's **Authentication** tab:

1. Make sure **Use Platform SSO** is on.
2. Under users and roles, allow **only your account**.

Open `https://hub.yourdomain`. Pangolin asks you to sign in, then you see every service.

**Tip:** to keep the hub's own tile off the page, give the Hub resource the label `hidden` in Pangolin.

---

## How services are found

The hub asks Pangolin for every resource in your organisation every minute, then keeps the ones you can open in a browser:

| Pangolin resource | On the page? |
| --- | --- |
| HTTP resource with a hostname, enabled | ✅ as a tile linking to `https://<its hostname>` (`http://` if SSL is off) |
| Disabled resource | ❌ |
| TCP / UDP / SSH (raw) resource | ❌ (nothing to open in a browser) |
| Wildcard resource (`*.example.com`) | ❌ |
| Has the label `hidden` | ❌ |

**Name:** the resource's name in Pangolin.

**Group:** the resource's **first label** in Pangolin. For example, label Jellyfin and Immich `Media` and they appear together under *Media*. Resources without a label go under *Services*.

**Status dot:**

| Dot | Meaning |
| --- | --- |
| 🟢 | Pangolin's health checks pass. Without health checks, the site's tunnel is up. |
| 🟠 | Some targets or sites are down |
| 🔴 | All targets or sites are down |
| No dot | Pangolin doesn't know. This is usual for resources on the local site that have no health checks. |

## How logos are picked

Logos come from [dashboard-icons](https://dashboardicons.com), a free set of 3,000+ homelab app icons. For each service, the hub tries these names in order and uses the first one that exists:

1. **The resource's name**, lower-cased with dashes: `Home Assistant` → `home-assistant`, `Uptime Kuma` → `uptime-kuma`.
2. **The same without dashes:** `uptimekuma`.
3. **The first word of the name:** `Paperless ngx` → `paperless`.
4. **The subdomain:** `pve.example.com` → `pve`, `photos.example.com` → `photos`.

So naming a resource after the app (*Grafana*, *Jellyfin*, *Proxmox*) is usually all it takes. Some icons have separate versions for light and dark backgrounds. The hub checks which version is darker and uses the right one for your theme.

If nothing matches, the tile gets a coloured letter instead. To pick the logo yourself, use `services.yaml` (below): find the name on [dashboardicons.com](https://dashboardicons.com), or give any image URL.

## services.yaml (optional)

`services.yaml` sits next to `compose.yaml` and is read on every page load, so you never need to restart. Use it for links that aren't in Pangolin, and to change how a Pangolin service looks:

```yaml
# Order of the groups on the page (any group not listed comes after these, A–Z).
groups: [Infrastructure, Media, Monitoring]

services:
  # Change a Pangolin service: match it by its name or hostname.
  - match: grafana.example.com
    icon: grafana                      # a name from dashboardicons.com…
    description: Dashboards            # shown under the name instead of the hostname
    group: Monitoring

  - match: ac·modern
    icon: https://access.example.com/favicon.svg   # …or any image URL

  - match: Backups
    hidden: true                       # leave it off the page

  # Add a link that isn't in Pangolin.
  - name: Router
    url: https://192.168.1.1
    group: Network
    icon: ubiquiti
```

If the file has a mistake, the page shows a banner saying what's wrong, and everything else keeps working.

## Settings

All optional, in `compose.yaml` under `environment:`.

| Variable | Default | What it does |
| --- | --- | --- |
| `HUB_TITLE` | `hub·modern` | The browser tab's title |
| `HUB_DEFAULT_GROUP` | `Services` | Group for resources without a label |
| `HUB_HIDE` | | Names or hostnames to leave out, comma-separated (like the `hidden` label) |
| `HUB_NEW_TAB` | `true` | Open services in a new tab. ⌘/Ctrl-click does the opposite. |
| `HUB_REFRESH_SECONDS` | `60` | How often it asks Pangolin for changes |
| `HUB_ICONS` | `true` | Set `false` for letter tiles only (nothing loaded from the icon CDN) |

## Updating

```sh
cd ~/hub-modern && docker compose pull && docker compose up -d
```

## Troubleshooting

The page shows a banner when something's wrong. The usual ones:

| Banner says | Fix |
| --- | --- |
| *Couldn't reach Pangolin at http://pangolin:3003* | The API isn't on (step 1), or the hub isn't on Pangolin's network (step 3) |
| *Pangolin refused the API key (401)* | The key is wrong or was deleted. Make a new one (step 2). |
| *Pangolin refused the API key (403)* | The key is missing "List Resources", or `PANGOLIN_ORG_ID` is wrong |
| *answered with something other than JSON* | `PANGOLIN_API_URL` must end in `/v1` |

Pangolin's address bar shows the right org ID (step 2). `docker logs hub-modern` shows the hub's own output.

## Security

- **Only Pangolin can reach the hub.** It has no published port, so Pangolin's SSO is the only way to it.
- **Pangolin's API stays private.** It's only reachable inside Docker, never from the internet.
- **The API key is read-only.** "List Resources" lets it see service names and hostnames, nothing else, and it can't change anything. Keep it in `.env` (not in git) and delete or replace it in Pangolin any time.
- **Clicking a tile still goes through Pangolin,** so each service's own access rules still apply.
- **The hub stores nothing.** Pinned tiles live in your browser.
- **Icons load from jsDelivr,** a public CDN. Set `HUB_ICONS=false` if you'd rather nothing leave your network.

## Develop

```sh
pnpm install
PANGOLIN_API_URL=https://api.example.com/v1 PANGOLIN_API_KEY=… PANGOLIN_ORG_ID=… pnpm dev
pnpm check && pnpm test
```

Icons: [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons) (Apache-2.0).
