import { Plugin } from '../../common/plugin';
import { IContainer, IMessage, ChannelType } from '../../common/types';
import Constants from '../../common/constants';
import { CategoryChannel, Collection, GuildChannel, User } from 'discord.js';

export class ShadowBanPlugin extends Plugin {
  public name: string = 'Shadowban Plugin';
  public description: string = 'Disables a users ability to view public channels.';
  public usage: string = 'shadowban <ban|unban> <user>';
  public pluginAlias = [];
  public permission: ChannelType = ChannelType.Staff;
  public pluginChannelName: string = Constants.Channels.Staff.UserOffenses;
  public commandPattern: RegExp = /(ban|unban)\s[^#]+#\d{4}/;

  private BANNED_CATEGORIES: string[] = [
    'GENERAL & SCHOOL LIFE',
    'DAILY ROUTINE',
    'HELP',
    'SPECIAL TOPICS',
    'MISCELLANEOUS',
    'AUDIO CHANNELS',
  ];

  constructor(public container: IContainer) {
    super();
  }

  public async execute(message: IMessage, args: string[]) {
    const [subCommand, ...userArg] = args;
    const targetUser = userArg.join(' ');
    const user = this.container.guildService
      .get()
      .members.cache.filter((m) => m.user.tag === targetUser)
      .first()?.user;

    if (!user) {
      message.reply('User not found.');
      return;
    }

    if (subCommand === 'ban') {
      await this._applyToChannels(this._banUser(user));
      message.reply(`${user.tag} has been shadowbanned`);
      return;
    } else if (subCommand === 'unban') {
      await this._applyToChannels(this._unbanUser(user));
      message.reply(`${user.tag} has been unshadowbanned`);
      return;
    }
  }

  private async _applyToChannels(callback: (chan: GuildChannel) => void) {
    const categories = this.container.guildService
      .get()
      .channels.cache.filter((chan) => chan.type === 'category') as Collection<
      string,
      CategoryChannel
    >;

    const catsToBan = categories.filter((cat: CategoryChannel) => {
      const chanName = cat.name.toUpperCase();
      return this.BANNED_CATEGORIES.some((n) => chanName === n);
    });

    const promises = catsToBan.reduce((acc: any, cat: CategoryChannel) => {
      acc.push(...cat.children.array().map(callback));
      return acc;
    }, []);

    await Promise.all(promises);
  }

  private _banUser(user: User) {
    return async (chan: GuildChannel) => {
      await chan.createOverwrite(user.id, {
        VIEW_CHANNEL: false,
      });
    };
  }

  private _unbanUser(user: User) {
    return async (chan: GuildChannel) => {
      await chan.permissionOverwrites.get(user.id)?.delete();
    };
  }
}
