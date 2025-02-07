import { Plugin } from '../../common/plugin';
import { IContainer, IMessage, ChannelType } from '../../common/types';
import { PLUGIN_STORE_SIZE } from '../../bootstrap/plugin.loader';
import { MessageEmbed } from 'discord.js';

export class StatusPlugin extends Plugin {
  public name: string = 'Status';
  public description: string = 'Gets info about Lion';
  public usage: string = 'status';
  public pluginAlias = [];
  public permission: ChannelType = ChannelType.Bot;

  private LION_PFP_URL: string =
    'https://cdn.discordapp.com/avatars/574623716638720000/7d404c72a6fccb4a3bc610490f8d7b72.png';
  private REPO_URL = 'https://github.com/joey-colon/lion/commit/';

  constructor(public container: IContainer) {
    super();
  }

  public async execute(message: IMessage, args: string[]) {
    const latestCommit = await Promise.resolve(this._getLatestCommit());
    const numPluigins = PLUGIN_STORE_SIZE;
    const uptime = this._getUptime();

    const embed = this._creatEmbed(latestCommit, numPluigins, uptime);
    message.reply(embed);
  }

  private _creatEmbed(latestCommit: any, numPluigins: number, startDate: string) {
    const commitLink = this.REPO_URL + latestCommit?.number;

    const embed = new MessageEmbed();
    embed.setTitle('Lion Status');
    embed.setColor('#1fe609');
    embed.setThumbnail(this.LION_PFP_URL);
    embed.setURL(commitLink);

    embed.addField('Latest Commit Hash', latestCommit?.number, true);
    embed.addField('Latest Commit Author', latestCommit?.author, true);
    embed.addField('Latest Commit Date', latestCommit?.date, true);
    embed.addField('Number Of Plugins', numPluigins, true);
    embed.addField('Uptime', startDate, true);

    return embed;
  }

  private _getUptime() {
    const startDate: Date = this.container.clientService.getStartDate();
    const currentDate: Date = new Date();

    const days = currentDate.getDay() - startDate.getDay();
    const hours = currentDate.getHours() - startDate.getHours();
    const seconds = currentDate.getSeconds() - startDate.getSeconds();

    return `${days}:${hours}:${seconds}`;
  }

  private async _getLatestCommit() {
    const result = (await this._execute('git log')) as string;
    const commits = result.split('commit').slice(1); //First element is an empty string
    const latestCommit = this._parseCommit(commits[0]);

    return latestCommit;
  }

  //Returns object containing [commitNumber, author, date]
  private async _parseCommit(data: string) {
    const parsedData = data.split('\n').filter((e) => e != '');
    const [commitNumber, author, date, ...commits] = parsedData;
    const usernameRegex: RegExp = / [a-zA-Z0-9-.]+ /;

    const authorMatch = author.match(usernameRegex);
    if (!authorMatch) {
      return;
    }

    const shortCommitId = await this._execute(`git rev-parse --short ${commitNumber.trim()}`);
    const parsedAuthor = authorMatch[0].trim();
    const parsedCommits = commits.map((e) => e.trim());
    const parsedDate = date
      .split('   ')[1]
      .split(' ')
      .slice(0, 5)
      .join(' '); //the data looks like this 'Date:   Fri Nov 6 15:06:38 2020 -0500'

    const commitData = {
      number: shortCommitId,
      author: parsedAuthor,
      date: parsedDate,
      commits: parsedCommits,
    };

    return commitData;
  }

  private _execute(command: string) {
    const { exec } = require('child_process');
    return new Promise(function(resolve, reject) {
      exec(command, (error: Error, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
          return;
        }
        if (stderr) {
          reject(stderr);
          return;
        }

        resolve(stdout.trim());
      });
    });
  }
}
