import { CacheType, Client, CommandInteraction, TextChannel } from "discord.js";
import { Server, Socket } from "socket.io";
import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import crypto from "crypto";
import { User } from "./User";
import Keyv from "keyv";
import { Roles } from "./Roles";
import { Permissions } from "./Permissions";
import { getCommands, Commands } from "./commands";
import { UI } from "./UI";
import { VAULT_URL } from "../constants";
import open from "open";

config();

const clientId = process.env.CLIENT_ID || "";

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

export type CommandType = {
  id: string;
  application_id: string;
  version: string;
  default_permission: true;
  default_member_permissions: null;
  type: 1;
  name: string;
  description: string;
  guild_id: string;
  options: {
    name: string;
    description: string;
    choices?: { name: string; value: string }[];
  }[];
};

export class Bot {
  public static rest: REST;
  public usersDb: Keyv;
  public permissions;

  private client: Client<boolean>;
  private io: IO;
  private users: { [key: string]: User | undefined } = {};
  private roles;
  constructor({
    client,
    rest,
    io,
    rolesDb,
    usersDb,
  }: {
    client: Client<boolean>;
    rest: REST;
    io: IO;
    rolesDb: Keyv;
    usersDb: Keyv;
  }) {
    Bot.rest = rest;

    this.client = client;
    this.io = io;
    this.usersDb = usersDb;
    this.roles = new Roles({ client, rolesDb });
    this.permissions = new Permissions({ client });
  }

  public static setSubCommands = async ({
    commandName,
    subCommandName,
    values,
    guildId,
    withPrevChoices,
  }: {
    commandName: "send-nft" | "delete-role";
    subCommandName: "nft" | "role-name";
    values: {
      name: string;
      value: string;
    }[];
    guildId: string;
    withPrevChoices: boolean;
  }) => {
    const commands: CommandType[] = (await Bot.rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as CommandType[];
    const command = commands.find((command) => command.name === commandName);

    if (!command) return;

    const prevChoices = withPrevChoices
      ? command.options[0]?.choices?.map(
          (choice) => [choice.name, choice.value] as [string, string]
        )
      : [];
    const currentChoices = values.map(
      (choice) => [choice.name, choice.value] as [string, string]
    );
    const cc = new SlashCommandBuilder()
      .setName(command.name)
      .setDescription(command.description)
      .addStringOption((option) =>
        option
          .setName(subCommandName)
          .setDescription(subCommandName)
          .addChoices(prevChoices ? prevChoices : [])
          .addChoices(currentChoices)
      );
    Bot.rest
      .patch(Routes.applicationGuildCommand(clientId, guildId, command.id), {
        body: cc.toJSON(),
      })
      .then(() => console.log("Successfully registered application commands."))
      .catch(console.error);
  };

  public setConnectedUsers = async ({ guilds }: { guilds: string[] }) => {
    const users = this.client.users.cache.values();
    guilds.forEach(async (guildId) => {
      for (const user of users) {
        const dbUser = (await this.usersDb.get(user.id)) as
          | { wallet: string; vault?: string }
          | undefined;
        if (!dbUser) continue;

        this.createUser({
          userId: user.id,
          guildId,
          address: dbUser.wallet,
          vaultAddress: dbUser.vault,
        });
      }
    });
  };

  public setGuildsBotChannel = ({ guilds }: { guilds: string[] }) => {
    guilds.forEach((guildId) => {
      this.setGuildBotChannel({ guildId });
    });
  };

  public setGuildBotChannel = async ({ guildId }: { guildId: string }) => {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    for (const channel of guild.channels.cache.values()) {
      if (channel.name === "web3-kirobo-config") {
        return;
      }
    }
    const channel = await guild.channels
      .create("web3-kirobo-config", {
        reason: "Config for web3-kirobo-bot",
      })
      .catch(console.error);

    if (!channel) return;
    const guildChannel = this.client.channels.cache.get(
      channel.id
    ) as TextChannel;

    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });
    const connectMessage = UI.getMessageEmbedWith({
      description:
        "This is a read-only connection. Do not share your private keys. We will never ask for your seed phrase.",
      thumbnail: "attachment://vault.png",
      author: {
        name: "Kirobo Vault",
        iconURL: "attachment://kirogo.png",
        url: VAULT_URL,
      },
    });
    const connectButton = UI.getButton({
      label: "Connect",
      customId: "connect",
    });
    guildChannel.send({
      embeds: [connectMessage],
      components: [connectButton],
      files: [attachment, logoAttachment],
    }).then((message) => message.pin());
  };

  public setCommands = async ({ guilds }: { guilds: string[] }) => {
    return Promise.all(guilds.map(this.setCommand));
  };

  public setCommand = async (guildId: string) => {
    const roles = await this.roles.getRoles({ guildId });
    const commands = getCommands({ roles });

    await Bot.rest
      .put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      })
      .then(() => console.log("Successfully registered application commands."))
      .catch(console.error);
  };

  public deleteAllCommands = async ({ guildId }: { guildId: string }) => {
    const commands: CommandType[] = (await Bot.rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as CommandType[];
    commands.map((cmd) => {
      const deleteUrl = `${Routes.applicationGuildCommands(
        clientId,
        guildId
      )}/${cmd.id}` as `/${string}`;
      Bot.rest.delete(deleteUrl);
    });
  };

  public runClient = () => {
    this.client.once("ready", () => {
      this.client.on("interactionCreate", this.handleInteraction);
    });
    this.client.login(process.env.TOKEN);
  };

  private handleInteraction = async (
    interaction: CommandInteraction<CacheType>
  ) => {
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case Commands.Connect:
          await this.connectOnButtonClick(interaction);
          break;
      }
    }

    if (!interaction.isCommand()) return;
    switch (interaction.commandName) {
      case Commands.Connect:
        await this.connect(interaction);
        break;
      case Commands.Disconnect:
        await this.disconnect(interaction);
        break;
      case Commands.GetNfts:
        await this.getNfts(interaction);
        break;
      case Commands.SendNft:
        await this.sendNft(interaction);
        break;
      case Commands.AddRole:
        await this.addRole(interaction);
        break;
      case Commands.GetRoles:
        await this.getRoles(interaction);
        break;
      case Commands.DeleteRole:
        await this.deleteRole(interaction);
        break;
    }
  };

  private connect = async (interaction: CommandInteraction<CacheType>) => {
    const user = this.users[interaction.user.id];
    if(user) {
      interaction.reply({ content: "Already connected", ephemeral: true })
      await user.sendVaultMessage({ channelId: interaction.channelId })
      return;
    }
    crypto.randomBytes(48, async (_err, buffer) => {
      const token = buffer.toString("hex");
      const guild = this.client.guilds.cache.get(interaction?.guild?.id || "");
      const user = guild?.members.cache.get(interaction.user.id);
      const presence = user?.guild.presences.cache.get(interaction.user.id);

      const reply = UI.getConnectReply({
        presence,
        token,
        userId: interaction.user.id,
      });
      interaction.reply(reply);

      this.connectUser({
        userId: interaction.user.id,
        token: { token },
        guildId: interaction?.guild?.id || "",
        interaction,
      });
    });
  };

  private connectOnButtonClick = async(
    interaction: CommandInteraction<CacheType>
  ) => {
    const user = this.users[interaction.user.id];
    if(user) {
      interaction.reply({ content: "Already connected", ephemeral: true })
      await user.sendVaultMessage({ channelId: interaction.channelId })
      return;
    }
    crypto.randomBytes(48, async (_err, buffer) => {
      const token = buffer.toString("hex");
      const guild = this.client.guilds.cache.get(interaction?.guild?.id || "");
      const user = guild?.members.cache.get(interaction.user.id);
      const presence = user?.guild.presences.cache.get(interaction.user.id);

      const url = UI.getConnectUrl({
        presence,
        token,
        userId: interaction.user.id,
      });
      interaction.reply({ content: "Connect to metamask account", ephemeral: true })
      open(url);

      this.connectUser({
        userId: interaction.user.id,
        token: { token },
        guildId: interaction?.guild?.id || "",
        interaction,
      });
    });
  };

  private disconnect = async (interaction: CommandInteraction<CacheType>) => {
    if (!this.users[interaction.user.id]) {
      interaction.reply("not connected");
      return;
    }

    await this.usersDb.delete(interaction.user.id);
    delete this.users[interaction.user.id];
    interaction.reply({ content: "disconnected", ephemeral: true });
  };
  private addRole = async (interaction: CommandInteraction<CacheType>) => {
    const roleName = interaction.options.getString("role-name");
    const amount = interaction.options.getInteger("kiro-amount-required");
    if (!roleName) return interaction.reply("role name required");
    if (!amount) return interaction.reply("amount required");

    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.reply("failed to fetch guild id");
    try {
      await this.roles.createRole({
        roleName,
        amount: amount.toString(),
        guildId,
      });
      return interaction.reply("added");
    } catch (e) {
      return interaction.reply(e.message);
    }
  };

  private getRoles = async (interaction: CommandInteraction<CacheType>) => {
    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.reply("failed to fetch guild id");
    try {
      const roles = await this.roles.getRoles({ guildId });
      console.log({ roles });
    } catch (e) {
      return interaction.reply(e.message);
    }
  };

  private deleteRole = async (interaction: CommandInteraction<CacheType>) => {
    const roleName = interaction.options.getString("role-name");

    if (!roleName) return interaction.reply("role name required");

    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.reply("failed to fetch guild id");
    try {
      await this.roles.deleteRole({ roleName, guildId });
      return interaction.reply("deleted");
    } catch (e) {
      return interaction.reply(e.message);
    }
  };

  private getNfts = async (interaction: CommandInteraction<CacheType>) => {
    const user = this.users[interaction.user.id];
    if (!user) {
      interaction.reply({ content: "not connected" });
    }

    await interaction.deferReply();
    const nfts = await user?.getNfts({ chain: "rinkeby" });

    if (!nfts || !nfts.length) {
      interaction.editReply({ content: "not found" });
      return;
    }

    Bot.setSubCommands({
      commandName: "send-nft",
      values: nfts,
      guildId: interaction?.guild?.id || "",
      subCommandName: "nft",
      withPrevChoices: true,
    });

    return interaction.editReply({ content: "succeed" });
  };

  private sendNft = (interaction: CommandInteraction<CacheType>) => {
    if (!this.users[interaction.user.id])
      return interaction.reply({ content: "not connected" });

    const uri = interaction.options.getString("nft");
    if (!uri) return interaction.reply({ content: "wrong uri" });
    const embed = this.users[interaction.user.id]?.getNftMessage({ uri });
    if (!embed) return interaction.reply({ content: "not found" });
    return interaction.reply({ embeds: [embed] });
  };

  private connectUser = async({
    userId,
    token,
    guildId,
    interaction,
  }: {
    userId: string;
    token: { token: string };
    guildId: string;
    interaction: CommandInteraction<CacheType>;
  }) => {

    const connectListener = (socket: IoSocket) => {
      if (token.token === "") {
        return;
      }
      if (socket.handshake.query.token !== token.token) return;
      token.token = "";
      const user = this.createUser({
        userId,
        guildId,
      });

      user?.startAccountListener({ socket, channelId: interaction.channelId });
    };
    setTimeout(() => {
      token.token = "";
    }, 60000);

    this.io.off("connection", connectListener)
    this.io.on("connection", connectListener);
  };

  private createUser = ({
    userId,
    guildId,
    address,
    vaultAddress,
  }: {
    userId: string;
    guildId: string;
    address?: string;
    vaultAddress?: string;
  }) => {
    const user = new User({
      client: this.client,
      userId,
      guildId,
      usersDb: this.usersDb,
      address,
      vaultAddress,
      roles: this.roles,
    });
    this.users[userId] = user;

    return user;
  };
}
