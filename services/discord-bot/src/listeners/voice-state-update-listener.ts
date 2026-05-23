import { Listener } from '@sapphire/framework';
import type { VoiceState } from 'discord.js';
import { getConnectedVoiceUserIds } from './broker-message-listener.js';
import { getWarmLobbyOrchestrator } from '../warm-lobby-runtime.js';

export class VoiceStateUpdateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options = {}) {
    super(context, {
      ...options,
      event: 'voiceStateUpdate',
    });
  }

  public async run(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const channels = [oldState.channel, newState.channel].filter(
      (channel, index, values): channel is NonNullable<typeof channel> =>
        Boolean(channel) && values.findIndex((candidate) => candidate?.id === channel?.id) === index,
    );

    const orchestrator = getWarmLobbyOrchestrator();
    for (const channel of channels) {
      await orchestrator.handleWarmLobbyUpdate(
        newState.guild.id,
        channel.id,
        getConnectedVoiceUserIds(channel),
      );
    }
  }
}
