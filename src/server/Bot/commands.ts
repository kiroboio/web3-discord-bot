import { SlashCommandBuilder } from "@discordjs/builders";

export enum Commands {
  Help = "help",
  SetChain = "set-chain",
  GetChain = "get-chain",
  Connect = "connect",
  Disconnect = "disconnect",
  MyVault = "get-my-vault",
  GetWalletNfts = "get-wallet-nfts",
  GetVaultNfts = "get-vault-nfts",
  SendNft = "send-nft",
  GetRoles = "get-roles",
  MyRole = "get-my-role",
  DeleteRole = "delete-role",
  AddRole = "add-role",
  SendKiro = "send-kiro",
}

export const adminOnlyCommands = [
  Commands.SetChain,
  Commands.AddRole,
  Commands.DeleteRole,
];


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
          .addChoices([
            ["main", "1"],
            ["rinkeby", "4"],
          ])
          .setRequired(true)
      )
      .setDefaultPermission(false),

    new SlashCommandBuilder()
      .setName(Commands.GetChain)
      .setDescription("Get current Ethereum chain"),

    new SlashCommandBuilder()
      .setName(Commands.Connect)
      .setDescription("Connect to metamask account"),

    new SlashCommandBuilder()
      .setName(Commands.Disconnect)
      .setDescription(
        "Disconnect from metamask account and remove your Kirobo roles"
      ),

    new SlashCommandBuilder()
      .setName(Commands.MyVault)
      .setDescription("Show my Vault info"),

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
      .setName(Commands.SendKiro)
      .setDescription("Send Kiro")
      .addStringOption((option) =>
        option
          .setName("wallet-type")
          .setDescription("Wallet to send from")
          .addChoices([["Vault", "vault"], ["Wallet", "wallet"]])
          .setRequired(true),
      )
      .addUserOption((option) => 
        option
          .setName("user-name")
          .setDescription("Connected user to send Kiro to")
          .setRequired(true),
      )
      .addIntegerOption((option) => 
        option
        .setName("amount")
        .setDescription("Amount of Kiro to send")
        .setRequired(true),
      )
      

    // new SlashCommandBuilder()
    //   .setName(Commands.GetWalletNfts)
    //   .setDescription("Get your wallets nfts (4 images max)."),

    // new SlashCommandBuilder()
    //   .setName(Commands.GetVaultNfts)
    //   .setDescription("Get your vault nfts (4 images max)."),

    // new SlashCommandBuilder()
    //   .setName(Commands.SendNft)
    //   .setDescription("Send nft image. TBA"),
  ].map((command) => command.toJSON());
};
