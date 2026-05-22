import { Pool } from 'pg';

export interface LinkedIdentityUser {
  discordSnowflake: string;
  discordUsername: string;
  riotPuuid: string;
  riotGameName: string;
  riotTagLine: string;
  privacyOptIn: boolean;
}

export interface UserRecord {
  id: string;
  discord_snowflake: string;
  discord_username: string | null;
  riot_puuid: string | null;
  riot_game_name: string | null;
  riot_tag_line: string | null;
  privacy_opt_in: boolean;
}

export class UsersRepository {
  constructor(private readonly pool: Pool) {}

  async upsertLinkedIdentity(input: LinkedIdentityUser): Promise<UserRecord> {
    const query = `
      INSERT INTO users (
        discord_snowflake,
        discord_username,
        riot_puuid,
        riot_game_name,
        riot_tag_line,
        privacy_opt_in
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (discord_snowflake)
      DO UPDATE SET
        discord_username = EXCLUDED.discord_username,
        riot_puuid = EXCLUDED.riot_puuid,
        riot_game_name = EXCLUDED.riot_game_name,
        riot_tag_line = EXCLUDED.riot_tag_line,
        privacy_opt_in = EXCLUDED.privacy_opt_in,
        updated_at = NOW()
      RETURNING id,
        discord_snowflake,
        discord_username,
        riot_puuid,
        riot_game_name,
        riot_tag_line,
        privacy_opt_in;
    `;

    const values = [
      input.discordSnowflake,
      input.discordUsername,
      input.riotPuuid,
      input.riotGameName,
      input.riotTagLine,
      input.privacyOptIn,
    ];

    const result = await this.pool.query<UserRecord>(query, values);
    return result.rows[0];
  }
}
