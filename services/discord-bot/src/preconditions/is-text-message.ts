import { Precondition } from '@sapphire/framework';
import { MessageType, type Message } from 'discord.js';

export class IsTextMessagePrecondition extends Precondition {
  public override messageRun(message: Message) {
    if (message.type === MessageType.Default) {
      return this.ok();
    }

    return this.error({
      message: 'Only default text messages are allowed for this command.',
    });
  }
}
