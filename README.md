<p align="center"><img src="static/favicon.svg" width="64" height="64" alt=""></p>

<h1 align="center">Atrium</h1>

<p align="center">One page with every service behind your <a href="https://github.com/fosrl/pangolin">Pangolin</a>, so you never have to remember a URL again.</p>

Atrium asks Pangolin which web services you have and shows them as tiles with icons and up/down status. Add a resource in Pangolin and it appears on the page; there's no list to keep up to date. Start typing anywhere to search, press ↵ to open, and star the ones you use most.

---

## Set up

You need: Pangolin (self-hosted, or [Pangolin Cloud](https://pangolin.net) with a Newt site), a machine running Docker that Pangolin can reach, and about ten minutes.

```
you ──► Pangolin (SSO) ──► atrium ──► Pangolin's API (read-only key)
```

- **Pangolin's SSO is the only way to reach the hub.** The hub has no port of its own on the machine.
- **The hub's API key can only list services.** It can't change anything.

### Step 1. Create a read-only API key

In Pangolin's dashboard (self-hosted or Cloud):

1. Open your organisation, then **API Keys** in the left menu → **Create API Key**.
2. Name it `atrium`.
3. Under permissions, tick **only "List Resources"**.
4. Create it and **copy the key now**. Pangolin shows it once.

Also note your **organisation ID**: the first part of the path in the address bar. In `…/home-lab/settings/resources`, the ID is `home-lab`.

> **Self-hosted only:** Pangolin's API is off by default. In Pangolin's `config/config.yml`, add `enable_integration_api: true` under `flags:` and run `docker compose restart pangolin`. You don't need a Traefik route or DNS record for it: the hub reaches it inside Docker at `http://pangolin:3003/v1`.
>
> If Pangolin runs from a compose file with no `config` folder on the host, edit the file inside the container: `docker cp pangolin:/app/config/config.yml .`, edit it, `docker cp config.yml pangolin:/app/config/config.yml`, then `docker restart pangolin`.
>
> **Pangolin Cloud:** nothing to turn on. The API is at `https://api.pangolin.net/v1`.

### Step 2. Find the Docker network Pangolin uses to reach the hub

The hub joins the Docker network of whatever forwards traffic to it, so it can be reached as `atrium:3000`:

- **Self-hosted:** the `pangolin` container's network.
- **Pangolin Cloud:** your **Newt** container's network (the site connector on this machine).

```sh
docker inspect pangolin --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
#   or, with Pangolin Cloud, the Newt container's name instead of "pangolin"
```

If it prints `pangolin_frontend`, there's nothing to do. Otherwise put `PANGOLIN_NETWORK=<that name>` in `.env` in the next step.

### Step 3. Start the hub

```sh
mkdir -p ~/atrium && cd ~/atrium
curl -fsSLO https://raw.githubusercontent.com/Armistice-Group/Atrium/main/compose.yaml
touch services.yaml
cat > .env <<'ENV'
HUB_ADMINS=you@example.com
ENV
docker compose up -d
```

`HUB_ADMINS` is who may open **Settings**: your email or username as Pangolin's sign-in knows it. Leave it out and anyone who can open the hub can change its settings.

### Step 4. Put the hub behind Pangolin

In Pangolin's dashboard, **Resources → Add Resource**:

| Field | Value |
| --- | --- |
| Name | `Hub` |
| Type | HTTP |
| Subdomain | whatever you like, e.g. `hub` → `hub.yourdomain` |
| Site | the site on the machine running the hub (self-hosted: the **local** site) |
| Target | `atrium`, port `3000`, method `http` |

Then, on the new resource's **Authentication** tab, make sure **Use Platform SSO** is on and allow **only your account**.

### Step 5. Connect Pangolin

Open `https://hub.yourdomain`, sign in, and press **Connect Pangolin** (or the ⚙ in the header). Choose **Pangolin Cloud** or **Self-hosted, same Docker network**, paste the key and org ID from step 1, press **Test**, then **Add connection**. Your services appear.

You can add more than one connection (two orgs, or Cloud and a self-hosted Pangolin): their services are merged onto one page.

**Tip:** to keep the hub's own tile off the page, give the Hub resource the label `hidden` in Pangolin, or hide it with its edit button.

<details>
<summary>Prefer configuring it in compose instead?</summary>

Set `PANGOLIN_API_URL`, `PANGOLIN_API_KEY` and `PANGOLIN_ORG_ID` in `.env`. That connection shows in Settings as *From environment* and can only be changed there. Without `PANGOLIN_API_URL`, the hub uses `http://pangolin:3003/v1`.
</details>


---

## Editing tiles

Hover a tile and press the ✎ pencil to change its **icon**, **name**, **group** or **description**, or to **hide** it. Leave a field empty to keep what Pangolin says. Hidden tiles are listed in Settings, where you can bring them back. **Reset to original** undoes every change to that tile.

For the icon, type a name from [dashboardicons.com](https://dashboardicons.com) (e.g. `grafana`) or paste any image URL. The form previews it before you save.

Turn on **Wide tile** in the same form to make a tile take two columns, handy for the ones you open most.

**Size S / M / L** (right of the site chips) switches between small tiles (icon and name only), the standard ones, and large cards with big icons. Each browser remembers its own choice.

## Groups

Tiles are grouped by their **first label** in Pangolin, or by the group set with their edit button. In **Settings → Groups** you can:

- **Reorder** groups by dragging them, or with the ↑ ↓ buttons. **Reset to the default order** goes back to `services.yaml`'s `groups:` list, then A–Z.
- **Rename** a group. Its tiles follow, and so do new ones Pangolin adds with that label. Labels in Pangolin aren't changed.
- **Remove** a group. Its tiles move to the default group (*Services*).

To make a new group, type its name in a tile's **Group** field.

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

**Sites:** when your services run on more than one Pangolin site, chips under the greeting show each site with its up/down dot and number of services. Click one to see only that site (search too). **Group by → Site** sorts the page into sections by site instead of by label. A resource with targets on two sites appears under both. Each browser remembers its choice.

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

`services.yaml` sits next to `compose.yaml` and is read on every page load, so you never need to restart. Use it for links that aren't in Pangolin, to set the order of groups, and to change how services look from a file. Changes made with a tile's edit button take priority over the file.

```yaml
# Order of the groups on the page (any group not listed comes after these, A–Z).
# An order set in Settings → Groups takes priority.
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
| `HUB_ADMINS` | | Emails or usernames (from Pangolin's sign-in) who may open Settings and edit tiles, comma-separated. Empty: anyone who can open the hub. |
| `HUB_TITLE` | `Atrium` | The browser tab's title |
| `HUB_DEFAULT_GROUP` | `Services` | Group for resources without a label |
| `HUB_HIDE` | | Names or hostnames to leave out, comma-separated (like the `hidden` label) |
| `HUB_NEW_TAB` | `true` | Open services in a new tab, until someone picks otherwise with *Open in* above the tiles (remembered per browser). ⌘/Ctrl-click does the opposite. |
| `HUB_REFRESH_SECONDS` | `60` | How often it asks Pangolin for changes |
| `HUB_ICONS` | `true` | Set `false` for letter tiles only (nothing loaded from the icon CDN) |

## Updating

```sh
cd ~/atrium && docker compose pull && docker compose up -d
```

### Moving from hub-modern

Atrium used to be hub-modern. The old `ghcr.io/armistice-group/hub-modern` image no longer gets updates. To switch over, stay in the old folder so the hub keeps its data volume, fetch the new `compose.yaml`, and start it:

```sh
cd ~/hub-modern
curl -fsSLO https://raw.githubusercontent.com/Armistice-Group/Atrium/main/compose.yaml
docker compose pull && docker compose up -d --remove-orphans
```

`--remove-orphans` stops the old `hub-modern` container. The new one still answers to `hub-modern` on Pangolin's network, so the resource's target can stay as it is, or you can change it to `atrium`.

## Troubleshooting

The page shows a banner when something's wrong, and Settings shows each connection's status. **Test** in a connection's form tries it before you save. The usual messages:

| Message | Fix |
| --- | --- |
| *Couldn't reach Pangolin at http://pangolin:3003* | Self-hosted: the API isn't on, or the hub isn't on Pangolin's network (steps 1–2) |
| *Pangolin refused the API key (401)* | The key is wrong or was deleted. Make a new one (step 1). |
| *Pangolin refused the API key (403)* | The key is missing "List Resources", or the organisation ID is wrong |
| *answered with something other than JSON* | The API URL must end in `/v1` |
| *Settings* gives a 403 | You're not in `HUB_ADMINS`: check the email Pangolin signs you in with |
| *Docker says network … not found* | `PANGOLIN_NETWORK` in `.env` doesn't match step 2 |

`docker logs atrium` shows the hub's own output.

## Security

- **Only Pangolin can reach the hub.** It has no published port, so Pangolin's SSO is the only way to it.
- **Self-hosted, Pangolin's API stays private.** The hub reaches it inside Docker, so it never needs to face the internet.
- **The API key is read-only.** "List Resources" lets it see service names and hostnames, nothing else, and it can't change anything. Delete or replace it in Pangolin any time.
- **Keys stay on the hub.** Connections are saved in `hub.json` in the `hub-data` volume, readable only by the hub's user. The browser only ever sees a key's last four characters.
- **Only admins change settings.** With `HUB_ADMINS` set, only those Pangolin users see Settings or the edit buttons; the server refuses everyone else's changes too.
- **Clicking a tile still goes through Pangolin,** so each service's own access rules still apply.
- **Pins and tile size live in your browser.**
- **Icons load from jsDelivr,** a public CDN. Set `HUB_ICONS=false` if you'd rather nothing leave your network.

## Develop

```sh
pnpm install
pnpm dev          # then add a connection in Settings (saved to ./data/hub.json)
pnpm check && pnpm test
```

Icons: [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons) (Apache-2.0).
