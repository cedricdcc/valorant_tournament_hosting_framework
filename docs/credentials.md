# Required API Credentials & Access

## Riot Credentials

- **RIOT_API_KEY** (Production key from Riot Developer Portal)
- **RIOT_RSO_CLIENT_ID**
- **RIOT_RSO_CLIENT_SECRET**
- **RIOT_RSO_REDIRECT_URI**
- **Tournament License** (regional/global Riot Esports approval depending on event size)

## Discord Credentials

- **DISCORD_BOT_TOKEN**
- **DISCORD_USER_AGENT** (must be a valid `Product/Version` user-agent string for Discord API calls)
- **DISCORD_CLIENT_ID**
- **DISCORD_CLIENT_SECRET**
- **DISCORD_REDIRECT_URI**
- Bot permissions/intents must include **Manage Channels** and **Move Members**, and role hierarchy must allow channel/member actions.

## Session/Auth Signing

- **AUTH_LINK_SECRET** (high-entropy secret used to sign OAuth state/link tokens)

## Secret Handling

- Do not commit real keys or secrets.
- Store credentials in deployment secret managers or environment variables.
