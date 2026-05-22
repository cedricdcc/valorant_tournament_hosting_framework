# Required API Credentials & Access

## Riot Credentials

- **RIOT_API_KEY** (Production key from Riot Developer Portal)
- **RIOT_RSO_CLIENT_ID**
- **RIOT_RSO_CLIENT_SECRET**
- **Tournament License** (regional/global Riot Esports approval depending on event size)

## Discord Credentials

- **DISCORD_BOT_TOKEN**
- **DISCORD_CLIENT_ID**
- **DISCORD_CLIENT_SECRET**
- Bot permissions/intents must include **Manage Channels** and **Move Members**, and role hierarchy must allow channel/member actions.

## Secret Handling

- Do not commit real keys or secrets.
- Store credentials in deployment secret managers or environment variables.
