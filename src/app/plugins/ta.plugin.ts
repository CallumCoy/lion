import { Plugin } from '../../common/plugin';
import { IContainer, IMessage, ChannelType } from '../../common/types';
import { GuildChannel, TextChannel } from 'discord.js';
import { MemberUtils } from '../util/member.util';

export class TaPlugin extends Plugin {
  public name: string = 'TA Plugin';
  public description: string = 'Allows TAs to register for classes.';
  public usage: string = 'ta <register/remove> | ta ask <question>';
  public pluginAlias = [];
  public permission: ChannelType = ChannelType.Private;
  public commandPattern: RegExp = /(register|remove|ask .+)/;

  private _DISCRIMINATOR_LENGTH: number = '#0000'.length;
  private _TA_ROLE = 'Teaching Assistant';

  constructor(public container: IContainer) {
    super();
  }

  public async execute(message: IMessage, args: string[]) {
    const isClassChannel = this.container.classService.isClassChannel(
      (<TextChannel>message.channel).name
    );
    if (!isClassChannel) {
      message.reply('Use this command in a class channel.');
      return;
    }

    const member = this.container.guildService.get().members.cache.get(message.author.id);
    if (!member) {
      return;
    }

    const [subcommand, ...question] = args;
    if (subcommand === 'ask') {
      await this._handleAsk(message, question.join(' '));
      return;
    }

    const isTA = MemberUtils.hasRole(member, this._TA_ROLE);
    if (!isTA) {
      await message.reply('You are not a TA!');
      return;
    }

    if (subcommand === 'register') {
      await this._handleRegister(message);
      return;
    }

    if (subcommand === 'remove') {
      await this._handleRemove(message);
      return;
    }
  }

  private async _handleAsk(message: IMessage, question: string) {
    const channelTopic = (<TextChannel>message.channel).topic || '';
    const hasTA: boolean = channelTopic.indexOf('TA: ') !== -1;

    if (!hasTA) {
      await message.reply('There are no TAs registered in this channel');
      return;
    }

    const TA_tags = this._parseTags(channelTopic.split('| TA: ')[1]);
    const mentions = this.container.guildService
      .get()
      .members.cache.filter((member) => TA_tags.some((TA: string) => member.user.tag === TA))
      .array()
      .map((ta) => ta.user.toString()) //Convert to pingable mentions
      .join(' ');
    message.channel.send(`${message.author} asks: \n>>> ${question}\n${mentions}`, {
      split: { prepend: '>>>' },
    });
  }

  private async _handleRegister(message: IMessage) {
    const channel: TextChannel = message.channel as TextChannel;
    const channelTopic = channel.topic || '';

    const hasTA: boolean = channelTopic.indexOf('TA: ') !== -1;
    if (!hasTA) {
      await channel.setTopic(`${channelTopic} | TA: ${message.author.tag}`);
      return;
    }

    let existingTAs;
    if (channelTopic === '') {
      existingTAs = channelTopic.slice('| TA: '.length);
    } else {
      [, existingTAs] = channelTopic.split('| TA: ');
    }

    if (this._parseTags(existingTAs).includes(message.author.tag)) {
      await message.reply(`You are already registered as a TA for ${channel.name}.`);
      return;
    }

    await channel
      .setTopic(`${channelTopic} ${message.author.tag}`)
      .then((newChan) => message.reply(`Successfully registered as TA in ${newChan.name}`));
  }

  private async _handleRemove(message: IMessage) {
    const channel: GuildChannel = message.channel as GuildChannel;
    const channelTopic = (channel as TextChannel).topic || '';

    const hasTA: boolean = channelTopic.indexOf('TA: ') !== -1;
    if (!hasTA) {
      await message.reply(`You are not a TA in ${channel.name}`);
      return;
    }

    let originalTopic, existingTAs;
    if (channelTopic.indexOf('| TA: ') === 0) {
      originalTopic = '';
      existingTAs = channelTopic.slice('| TA: '.length);
    } else {
      [originalTopic, existingTAs] = channelTopic.split('| TA: ');
    }

    const newTAs = this._parseTags(existingTAs).filter((e) => e !== message.author.tag);
    if (newTAs.length === 0) {
      await channel.setTopic(originalTopic);
      return;
    }

    await channel
      .setTopic(`${originalTopic} | TA: ${newTAs.join(' ')}`)
      .then((newChan) => message.reply(`Successfully unregistered as TA in ${newChan.name}`));
  }

  private _parseTags(list: string): string[] {
    let temp = list;
    const tags: string[] = [];
    while (temp.length > 0) {
      const index = temp.indexOf('#');
      const name = temp.slice(0, index);
      const discriminator = temp.slice(index, index + this._DISCRIMINATOR_LENGTH);

      tags.push(name + discriminator);
      temp = temp.slice(index + this._DISCRIMINATOR_LENGTH + 1);
    }

    return tags;
  }
}
