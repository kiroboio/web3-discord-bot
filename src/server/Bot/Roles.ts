import {
  CacheType,
  Client,
  ColorResolvable,
  CommandInteraction,
  EmbedFieldData,
} from "discord.js";
import Keyv from "keyv";
import { VAULT_URL } from "../constants";
import { Bot } from "./Bot";
import { UI } from "./UI";

type RoleDb = { amount: string; emoji: string | null; color?: string };
type Role = {
  name: string;
  value: string;
  amount: string;
  id: string;
  color: number;
  emoji: string | null;
};
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
    emoji,
    color,
  }: {
    roleName: string;
    amount: string;
    guildId: string;
    emoji: string | null;
    color?: ColorResolvable;
  }) => {
    await this.rolesDb.set(roleName, { amount, emoji, color } as RoleDb);
    const guild = this.client.guilds.cache.get(guildId);

    if (!guild) return;
    for (const role of guild.roles.cache.values()) {
      if (role.name === roleName) return;
    }

    await guild.roles.create({ name: roleName, color });
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

  public sendRoles = async (interaction: CommandInteraction<CacheType>) => {
    if (!interaction.guildId) {
      interaction.reply("guild not found");
      return;
    }
    const roles = await this.getRoles({ guildId: interaction.guildId });
    const fields: EmbedFieldData[] = roles.map((role) => {
      const name = role.emoji
        ? `${role.emoji} ${role.name.toUpperCase()}: ${role.amount} Kiro`
        : `${role.name.toLocaleUpperCase()}: ${role.amount} Kiro`;

      return { name, value: "\u200b" };
    });

    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });
    const embed = UI.getMessageEmbedWith({
      title: `Kirobo Role`,
      url: VAULT_URL,
      fields,
      thumbnail: "attachment://vault.png",
      footer: { text: "Kirobo", iconURL: "attachment://kirogo.png" },
    });

    interaction.reply({ embeds: [embed], files: [attachment, logoAttachment] });
  };

  public sendRole = async (interaction: CommandInteraction<CacheType>) => {
    if (!interaction.guildId) {
      interaction.reply("guild not found");
      return;
    }
    const role = await this.getUserRole({ guildId: interaction.guildId, userId: interaction.user.id });

    let name: string
    if(role) {
      name = role.emoji
      ? `${role.emoji} ${role.name.toUpperCase()}: ${role.amount} Kiro`
      : `${role.name.toLocaleUpperCase()}: ${role.amount} Kiro`;
    } else {
      name = "You don't have any role, try to get some Kiro"
    }
    const field: EmbedFieldData = { name, value: "\u200b" };


    

    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });
    const embed = UI.getMessageEmbedWith({
      title: `${interaction.user.username} role`,
      url: VAULT_URL,
      fields: [field],
      thumbnail: "attachment://vault.png",
      footer: { text: "Kirobo", iconURL: "attachment://kirogo.png" },
    });

    interaction.reply({ embeds: [embed], files: [attachment, logoAttachment] });
  };

  public getRoles = async ({ guildId }: { guildId: string }) => {
    const guild = this.client.guilds.cache.get(guildId);

    const roles = [];
    if (!guild) return [];
    for (const role of guild.roles.cache.values()) {
      const roleDb: RoleDb = await this.rolesDb.get(role.name);
      if (roleDb) {
        roles.push({
          name: role.name,
          value: role.name,
          amount: roleDb.amount,
          id: role.id,
          color: role.color,
          emoji: roleDb.emoji,
        });
      }
    }
    return roles;
  };

  public getUserRole = async ({
    guildId,
    userId,
  }: {
    guildId: string;
    userId: string;
  }) => {
    const guild = this.client.guilds.cache.get(guildId);

    let role: Role | undefined;

    if (!guild) return role;

    const member = guild.members.cache.get(userId);
    if (!member) return role;

    for (const roleItems of member.roles.cache.values()) {
      const roleDb: RoleDb = await this.rolesDb.get(roleItems.name);
      if (roleDb && parseFloat(roleDb.amount) > parseFloat(role?.amount || "-1") ) {
        role = {
          name: roleItems.name,
          value: roleItems.name,
          amount: roleDb.amount,
          id: roleItems.id,
          color: roleItems.color,
          emoji: roleDb.emoji,
        };
      }
    }
    return role;
  };
}
