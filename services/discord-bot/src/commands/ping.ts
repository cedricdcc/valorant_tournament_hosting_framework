import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

export class PingCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options = {}) {
    super(context, {
      ...options,
      name: 'ping',
      preconditions: ['isTextMessage'],
    });
  }

  public override async messageRun(message: Message): Promise<void> {
    await message.reply('pong');
  }
}
