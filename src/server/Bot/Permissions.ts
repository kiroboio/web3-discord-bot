import { Routes } from "discord-api-types/v9";
import { Client, Permissions as DiscordPermissions } from "discord.js";
import { config } from "dotenv";
import { Bot, CommandType } from "./Bot";
import { Roles } from "./Roles";

config();

const clientId = process.env.CLIENT_ID || "";

export class Permissions {
  private client: Client<boolean>;
  private roles: Roles;

  constructor({ client, roles }: { client: Client<boolean>; roles: Roles }) {
    this.client = client;
    this.roles = roles;
  }

  public setGuildsAdminCommandsPermissions = ({
    guilds,
  }: {
    guilds: string[];
  }) => {
    guilds.forEach((guildId) => {
      this.setAdminCommandsPermissions({ guildId });
    });
  };

  public setAdminCommandsPermissions = async ({
    guildId,
  }: {
    guildId: string;
  }) => {
    const commands: CommandType[] = (await Bot.rest
      .get(Routes.applicationGuildCommands(clientId, guildId))
      .catch((e) => console.error({ error: e.message }))) as CommandType[];
    if (!commands) return;
    const roleAdminCommands = commands.filter(
      (command) => command.name === "add-role" || command.name === "delete-role"
    );
    if (!roleAdminCommands) return;

    const users = this.client.guilds.cache.get(guildId)?.members.cache.values();
    if (!users) return;

    const botAdminRoleId = await this.roles.createBotAdminRole({ guildId });
    if (!botAdminRoleId) return;

    for (const user of users) {
      if (!user.permissions.has(DiscordPermissions.FLAGS.MANAGE_ROLES))
        continue;
      user.roles.add(botAdminRoleId);
    }

    roleAdminCommands.map((cmd) =>
      Bot.rest
        .put(Routes.applicationCommandPermissions(clientId, guildId, cmd.id), {
          body: {
            permissions: [
              {
                id: botAdminRoleId,
                type: 1,
                permission: true,
              },
            ],
          },
        })
        .catch((e) => console.error(e.message))
    );
  };
}
