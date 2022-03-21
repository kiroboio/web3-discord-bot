import { Routes } from "discord-api-types/v9";
import { Client } from "discord.js";
import { config } from "dotenv";
import { Bot, CommandType } from "./Bot";

config();

const clientId = process.env.CLIENT_ID || "";

export class Permissions {
  private client: Client<boolean>;

  constructor({ client }: { client: Client<boolean> }) {
    this.client = client;
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
    const commands: CommandType[] = (await Bot.rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as CommandType[];
    const command = commands.find((command) => command.name === "add-role");
    if (!command) return;

    const roles = this.client.guilds.cache.get(guildId)?.roles.cache.values();
    if (!roles) return;
    for (const role of roles) {
      if (role.name !== "kirobo-bot-admin") continue;
      await Bot.rest
        .put(
          Routes.applicationCommandPermissions(clientId, guildId, command.id),
          {
            body: {
              permissions: [
                {
                  id: role.id,
                  type: 1,
                  permission: true,
                },
              ],
            },
          }
        )
        .catch(console.error);
    }
  };
}
