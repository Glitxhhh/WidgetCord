# WidgetCord

Keeps a Discord [profile widget](https://support.discord.com/hc/en-us/articles/35344672307607-Profile-Widgets-FAQ)
(the "Widgets V2" card apps can show on a user's profile) updated **automatically** from a
live data source — polling on a schedule and pushing the new value, instead of you opening a
panel and typing a number in by hand every time something changes.

Ships with a small web panel to view live status and edit the widget's content, plus a guided
setup command that creates and publishes the widget for you.

## Why this exists

Tools like [DWidgets](https://discordwidgets.com) give you a nice editor for a Discord
profile widget, but every value is something *you* type in and save. That's fine for mostly
static widgets, but not for anything that changes on its own — a member count, a stat, a
score, uptime, whatever. WidgetCord is built around the opposite assumption: something else
is the source of truth, and this tool's whole job is to keep the widget in sync with it on a
timer. Out of the box it ships wired to Discord's own guild member count, but the update
logic (`updater.js`) is a small enough surface to point at any data source you want.

If you just want a static widget and don't want to run a server, DWidgets (or similar) is
genuinely the simpler choice — this tool trades that simplicity for automation.

## ⚠️ Important disclaimer

Discord profile widgets (Widgets V2) are an **undocumented, unofficial feature** — there is
no public API reference for any of this. Everything here was reverse-engineered by
inspecting real network traffic and probing Discord's API directly. Concretely:

- The endpoints used here can change or break without notice.
- As of a June 2026 Discord change, **only the application owner's account** can have a
  widget added to its profile — pushing to other users' identities may currently do nothing.
- Creating a widget-config may require "Social SDK" access to be enabled for your
  application in the Discord Developer Portal (Games → Social SDK). This has not been
  independently verified against a brand-new application — if `npm run setup` fails while
  creating the widget, read the printed Discord error carefully; it's the best diagnostic
  available.
- This is not affiliated with or endorsed by Discord. Use at your own risk.

## How it works

Two Discord API calls, both authenticated with your bot token:

1. **Read the live count** — `GET /guilds/{guildId}?with_counts=true` →
   `approximate_member_count`. Requires the bot to be a member of the guild.
2. **Push the widget** — `PATCH /applications/{appId}/users/{userId}/identities/{userId}/profile`
   with a `data.dynamic` array of typed fields (`1` = text, `2` = number, `3` = image).

**The one gotcha that matters:** that PATCH **replaces the entire `dynamic` array** — it is
not a merge. Every push must include every field (name, images, description, etc.), or you
will silently wipe the rest of the widget down to just the field(s) you sent. `updater.js`
always rebuilds the complete array from `config.json`'s `staticFields` plus the freshly
computed `progress_current`/`progress_max` — never send a partial array yourself.

## Quick start

### 1. Create a Discord application + bot

In the [Discord Developer Portal](https://discord.com/developers/applications), create an
application, add a bot to it, and copy the bot token (Bot → Reset Token).

### 2. Run setup

```bash
npm install
npm run setup
```

This walks you through:
- validating your bot token,
- confirming the bot is in your target server (and giving you an invite link if not),
- creating and publishing a widget-config if you don't already have one,
- writing `config.json`.

### 3. Run it

```bash
npm start
```

Or with Docker:

```bash
docker compose up -d --build
```

The panel is served on `http://localhost:3000` (no auth built in — put it behind your own
reverse proxy / basic auth if exposing it beyond localhost, the way our own deployment does).

### 4. Add the widget to your profile

Discord Settings → Profiles → Profile Widgets → Add Widgets → find your widget by the
display name you set during setup. (Desktop/web only — widgets don't show on mobile.)

## Configuration

Everything lives in `config.json` (see `config.example.json` for the shape), editable either
by hand or through the panel:

| Field | Meaning |
|---|---|
| `applicationId` / `botToken` | Your Discord app + bot |
| `guildId` | Server to read the member count from |
| `targetUserIds` | Whose profile(s) to push to (currently: must be the app owner, see disclaimer) |
| `goal` | The "max" value for the progress bar |
| `intervalMinutes` | How often to poll + push |
| `staticFields` | Widget text/images that don't change per-update |

## Deployment options

- **Docker** (`docker-compose.yml`): simplest cross-platform option, including Windows
  without a VPS.
- **pm2** (`ecosystem.config.js`): `pm2 start ecosystem.config.js` — what our own production
  deployment uses, behind nginx.
- **Plain Node**: `npm start`, manage the process however you like.

## Out of scope / contribution ideas

- Only the progress-bar layout (`widget_bottom_progress` + `mini_profile_hero_stat` +
  `widget_top_hero` + `activity_accessory_stat`) is supported by `npm run setup`. Discord's
  stats-grid and collection layouts aren't implemented — PRs welcome.
- One `config.json` = one widget. No multi-guild/multi-widget support per instance.
- No automated tests — this is a small operational tool, verified manually.

## License

MIT — see [LICENSE](LICENSE).
