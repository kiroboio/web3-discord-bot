import { Client } from "discord.js";
import Keyv from "keyv";
import { Bot } from "./Bot";

export class Roles {
  private client: Client<boolean>;
  private rolesDb: Keyv;
  constructor({ client, rolesDb }: { client: Client<boolean>; rolesDb: Keyv }) {
    this.client = client;
    this.rolesDb = rolesDb;
  }

  public updateRoleCommands = async ({ guildId }: { guildId: string }) => {
    const roles = await this.getRoles({ guildId });
    
    Bot.setSubCommands({
      guildId,
      values: roles,
      commandName: "delete-role",
      subCommandName: "role-name",
      withPrevChoices: false,
    });
  };

  public createRole = async ({
    roleName,
    amount,
    guildId,
  }: {
    roleName: string;
    amount: string;
    guildId: string;
  }) => {
    await this.rolesDb.set(roleName, amount);
    const guild = this.client.guilds.cache.get(guildId);

    if (!guild) return;
    for (const role of guild.roles.cache.values()) {
      if (role.name === roleName) return;
    }

    await guild.roles.create({ name: roleName });
    this.updateRoleCommands({ guildId });
  };

  public deleteRole = async ({
    roleName,
    guildId,
  }: {
    roleName: string;
    guildId: string;
  }) => {
    await this.rolesDb.delete(roleName);
    const guild = this.client.guilds.cache.get(guildId);

    if (!guild) return;
    for (const role of guild.roles.cache.values()) {
      if (role.name === roleName) {
        await guild.roles.delete(role.id);
      }
    }

    this.updateRoleCommands({ guildId });
  };

  public getRoles = async ({ guildId }: { guildId: string }) => {
    const guild = this.client.guilds.cache.get(guildId);

    const roles = [];
    if (!guild) return [];
    for (const role of guild.roles.cache.values()) {
      const amount = await this.rolesDb.get(role.name) as string;
      if (amount) {
        roles.push({
          name: role.name,
          value: role.name,
          amount,
          id: role.id,
        });
      }
    }
    return roles;
  };

  public getData = async ({ roleName }: { roleName: string }) => {
    return await this.rolesDb.get(roleName);
  };
}
