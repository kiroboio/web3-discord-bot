import { SlashCommandBuilder } from "@discordjs/builders";

export enum Commands {
  Help = 'help',
  SetChain = 'set-chain',
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

export const adminOnlyCommands = [Commands.SetChain, Commands.AddRole, Commands.DeleteRole]


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
}: {
  roles: { name: string; value: string; amount: string }[];
}) => {

  const roleChoices = roles.map(
    (role) => [role.name, role.name] as [string, string]
  );
  const colorChoices = colors.map(
    (color) => [color, color] as [string, string]
  );
  return [
    new SlashCommandBuilder()
      .setName(Commands.Help)
      .setDescription("Get this bot slash commands info"),
    new SlashCommandBuilder()
      .setName(Commands.SetChain)
      .setDescription("Set Ethereum chain")
      .addStringOption((option) =>
        option
          .setName("chain-name")
          .setDescription("Ethereum chain name")
          .addChoices([["main", "1"], ["rinkeby", "4"]])
      )
      .setDefaultPermission(false),

    new SlashCommandBuilder()
      .setName(Commands.Connect)
      .setDescription("Connect to metamask account"),

    new SlashCommandBuilder()
      .setName(Commands.Disconnect)
      .setDescription("Disconnect from metamask account"),

    new SlashCommandBuilder()
      .setName(Commands.MyVault)
      .setDescription("Show My Vault Info"),

    new SlashCommandBuilder()
      .setName(Commands.AddRole)
      .setDescription("Add Kirobo role according to Kiro amount")
      .addStringOption((option) =>
        option
          .setName("role-name")
          .setDescription("Add role name")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("kiro-amount-required")
          .setDescription(
            "Amount of Kiro on user balance (including Vault) required to get this role"
          )
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("color")
          .setDescription("Role color")
          .addChoices(colorChoices)
      )
      .addStringOption((option) =>
        option.setName("emoji").setDescription("Role emoji")
      )
      .setDefaultPermission(false),

    new SlashCommandBuilder()
      .setName(Commands.GetRoles)
      .setDescription("Get Kirobo roles"),

    new SlashCommandBuilder()
      .setName(Commands.MyRole)
      .setDescription("Get my Kirobo role according to Kiro amount"),

    new SlashCommandBuilder()
      .setName(Commands.DeleteRole)
      .setDescription("Delete Kirobo role by name")
      .addStringOption((option) =>
        option
          .setName("role-name")
          .setDescription("Role name")
          .addChoices(roleChoices)
      )
      .setDefaultPermission(false),

    new SlashCommandBuilder()
      .setName(Commands.GetNfts)
      .setDescription("Get nfts data. TBA")
      .setDefaultPermission(false),

    new SlashCommandBuilder()
      .setName(Commands.SendNft)
      .setDescription("Send nft image. TBA")
      .setDefaultPermission(false),
  ].map((command) => command.toJSON());
};
