import { SlashCommandBuilder } from "@discordjs/builders";

export enum Commands {
  Connect = "connect",
  Disconnect = "disconnect",
  GetNfts = "get-nfts",
  SendNft = "send-nft",
  GetRoles = "get-roles",
  DeleteRole = "delete-role",
  AddRole = "add-role",
  MyVault = "my-vault",
}

export const getCommands = ({
  roles,
}: {
  roles: { name: string; value: string; amount: string }[];
}) => {
  const roleChoices = roles.map(
    (role) => [role.name, role.name] as [string, string]
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
