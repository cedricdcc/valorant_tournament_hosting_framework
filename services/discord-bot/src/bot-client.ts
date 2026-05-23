import { SapphireClient, type SapphireClientOptions } from '@sapphire/framework';
import { getRootData, type StoreRegistry } from '@sapphire/pieces';
import { GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { join } from 'node:path';

const DEFAULT_PIECE_DIRECTORIES = ['commands', 'preconditions', 'listeners'] as const;
export const REQUIRED_BOT_PERMISSION_FLAGS =
  PermissionFlagsBits.ManageChannels | PermissionFlagsBits.MoveMembers;

export type BotPlugin = (client: TournamentBotClient) => void;

export interface TournamentBotClientOptions extends SapphireClientOptions {
  plugins?: readonly BotPlugin[];
  pieceDirectories?: readonly string[];
  rootDirectory?: string;
}

export function registerPieceDirectories(
  stores: StoreRegistry,
  rootDirectory = getRootData().root,
  pieceDirectories: readonly string[] = DEFAULT_PIECE_DIRECTORIES,
): void {
  for (const pieceDirectory of pieceDirectories) {
    stores.registerPath(join(rootDirectory, pieceDirectory));
  }
}

export class TournamentBotClient extends SapphireClient {
  public constructor();
  public constructor(options: TournamentBotClientOptions);
  public constructor(options: TournamentBotClientOptions = {}) {
    const { plugins = [], pieceDirectories = DEFAULT_PIECE_DIRECTORIES, rootDirectory, ...clientOptions } = options;

    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
      loadMessageCommandListeners: true,
      ...clientOptions,
    });

    registerPieceDirectories(this.stores, rootDirectory ?? getRootData().root, pieceDirectories);

    for (const plugin of plugins) {
      plugin(this);
    }
  }
}
