import { GuildMember, Message, PartialGuildMember, PartialMessage } from 'discord.js';
import { IContainer, IHandler, IMessage } from '../common/types';
export class Listener {
  private _messageHandlers: IHandler[] = [];
  private _messageUpdateHandlers: IHandler[] = [];
  private _privateMessageHandlers: IHandler[] = [];
  private _channelHandlers: IHandler[] = [];
  private _userUpdateHandlers: IHandler[] = [];
  private _memberAddHandlers: IHandler[] = [];

  constructor(public container: IContainer) {
    this._initializeHandlers();

    this.container.clientService.on('channelCreate', async () => {
      await this._executeHandlers(this._channelHandlers);
    });
    this.container.clientService.on('channelDelete', async () => {
      await this._executeHandlers(this._channelHandlers);
    });
    this.container.clientService.on('channelUpdate', async () => {
      await this._executeHandlers(this._channelHandlers);
    });

    this.container.clientService.on('ready', () => {
      this.container.loggerService.info(`Loaded ${this.container.jobService.size()} jobs...`);
      this.container.loggerService.info('Lion is now running!');
    });

    this.container.clientService.on('message', async (message: IMessage) => {
      await this.handleMessageOrMessageUpdate(message, false);
    });

    this.container.clientService.on(
      'messageUpdate',
      async (_old: Message | PartialMessage, newMessage: Message | PartialMessage) => {
        await this.handleMessageOrMessageUpdate(newMessage as Message, true);
      }
    );

    this.container.clientService.on(
      'guildMemberUpdate',
      async (
        oldUser: GuildMember | PartialGuildMember,
        newUser: GuildMember | PartialGuildMember
      ) => {
        await this._executeHandlers(this._userUpdateHandlers, oldUser, newUser);
      }
    );

    this.container.clientService.on('guildMemberAdd', async (member: GuildMember) => {
      await this._executeHandlers(this._memberAddHandlers, member);
    });
  }

  private async handleMessageOrMessageUpdate(message: IMessage, isMessageUpdate: boolean) {
    if (message.author.bot) {
      return;
    }

    // If the message has a guild, use regular message handlers
    // Otherwise, it's a DM to handle differently.
    if (message.guild) {
      await this._tryEnsureMessageMember(message);

      if (isMessageUpdate) {
        await this._executeHandlers(this._messageUpdateHandlers, message);
      } else {
        await this._executeHandlers(this._messageHandlers, message);
      }
    } else {
      await this._executeHandlers(this._privateMessageHandlers, message);
    }
  }

  /// Tries to make sure that message.member != null
  /// However, message.member may be null if, for example,
  /// the user leaves the guild before we try to look them up.
  private async _tryEnsureMessageMember(message: IMessage) {
    if (message.member) {
      return;
    }

    try {
      this.container.loggerService.debug(
        `Attempting extra lookup of ${message.author.tag} to a GuildMember`
      );

      const member = await this.container.guildService.get().members.fetch(message.author.id);

      //Removed as message.member is now read only
      // message.member = member;

      if (!member) {
        this.container.loggerService.warn(
          `Could not resolve ${message.author.tag} to a GuildMember`
        );
      }
    } catch (e) {
      this.container.loggerService.error(
        `While attempting to look up ${message.author.tag} as a GuildMember.`,
        e
      );
    }
  }

  private _initializeHandlers(): void {
    this.container.handlerService.messageHandlers.forEach((Handler) => {
      this._messageHandlers.push(new Handler(this.container));
    });

    this.container.handlerService.messageUpdateHandlers.forEach((Handler) => {
      this._messageUpdateHandlers.push(new Handler(this.container));
    });

    this.container.handlerService.privateMessageHandlers.forEach((Handler) => {
      this._privateMessageHandlers.push(new Handler(this.container));
    });

    this.container.handlerService.channelHandlers.forEach((Handler) => {
      this._channelHandlers.push(new Handler(this.container));
    });

    this.container.handlerService.userUpdateHandlers.forEach((Handler) => {
      this._userUpdateHandlers.push(new Handler(this.container));
    });

    this.container.handlerService.memberAddHandlers.forEach((Handler) => {
      this._memberAddHandlers.push(new Handler(this.container));
    });
  }

  private async _executeHandlers(handlers: IHandler[], ...args: any[]) {
    handlers.forEach(async (handler: IHandler) => {
      try {
        await handler.execute(...args);
      } catch (e) {
        this.container.loggerService.error(e);
      }
    });
  }
}
