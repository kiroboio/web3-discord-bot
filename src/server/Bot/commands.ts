import { SlashCommandBuilder } from "@discordjs/builders";
import { GuildEmoji } from "discord.js";

export enum Commands {
  Connect = "connect",
  Disconnect = "disconnect",
  GetNfts = "get-nfts",
  SendNft = "send-nft",
  GetRoles = "get-roles",
  MyRole = "my-role",
  DeleteRole = "delete-role",
  AddRole = "add-role",
  MyVault = "my-vault",
}

const colors = [
  "DEFAULT",
  "WHITE",
  "AQUA",
  "GREEN",
  "BLUE",
  "YELLOW",
  "PURPLE",
  "LUMINOUS_VIVID_PINK",
  "GOLD",
  "ORANGE",
  "RED",
  "GREY",
  "NAVY",
  "DARK_BLUE",
  "DARK_PURPLE",
  "DARK_VIVID_PINK",
  "DARK_GOLD",
  "DARK_ORANGE",
  "DARK_RED",
  "LIGHT_GREY",
  "DARK_NAVY",
  "DARK_BUT_NOT_BLACK",
  "NOT_QUITE_BLACK",
  "RANDOM",
] as const;

export const getCommands = ({
  roles,
  emojies,
}: {
  roles: { name: string; value: string; amount: string }[];
  emojies: Map<string, GuildEmoji>;
}) => {
  const emojiesChoices: [string, string][] = [];
  for (const emoji of emojies.values()) {
    emojiesChoices.push([emoji.url, emoji.url]);
  }
  const roleChoices = roles.map(
    (role) => [role.name, role.name] as [string, string]
  );
  const colorChoices = colors.map(
    (color) => [color, color] as [string, string]
  );
  return [
    new SlashCommandBuilder()
      .setName(Commands.Connect)
      .setDescription("Connect metamask account to this bot"),

    new SlashCommandBuilder()
      .setName(Commands.Disconnect)
      .setDescription("Disconnect metamask account"),

    new SlashCommandBuilder()
      .setName(Commands.MyVault)
      .setDescription("Show My Vault Info"),

    new SlashCommandBuilder()
      .setName(Commands.GetRoles)
      .setDescription("get roles"),

    new SlashCommandBuilder()
      .setName(Commands.MyRole)
      .setDescription("get my role according kiro amount"),

    new SlashCommandBuilder()
      .setName(Commands.DeleteRole)
      .setDescription("delete role by name")
      .addStringOption((option) =>
        option
          .setName("role-name")
          .setDescription("role name")
          .addChoices(roleChoices)
      ),

    new SlashCommandBuilder()
      .setName(Commands.AddRole)
      .setDescription("add role")
      .addStringOption((option) =>
        option
          .setName("role-name")
          .setDescription("add role name")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("kiro-amount-required")
          .setDescription(
            "amount of kiro on user balance required to get this role"
          )
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("color")
          .setDescription("role color")
          .addChoices(colorChoices)
      )
      .addStringOption((option) =>
        option.setName("emoji").setDescription("role emoji")
      )
      .setDefaultPermission(false),
    new SlashCommandBuilder()
      .setName(Commands.GetNfts)
      .setDescription("get nfts data")
      .setDefaultPermission(false),

    new SlashCommandBuilder()
      .setName(Commands.SendNft)
      .setDescription("send nft image")
      .setDefaultPermission(false),
  ].map((command) => command.toJSON());
};
