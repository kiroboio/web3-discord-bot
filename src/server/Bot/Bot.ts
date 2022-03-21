import {
  CacheType,
  Client,
  CommandInteraction,
  MessageEmbed,
  Presence,
} from "discord.js";
import { Server, Socket } from "socket.io";
import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import crypto from "crypto";
import { User } from "../User";
import { URL, URL_METAMASK } from "../constants";
import Keyv from "keyv";
import { Roles } from "./Roles";
import { Permissions } from "./Permissions";

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

enum Commands {
  Connect = "connect",
  Disconnect = "disconnect",
  GetNfts = "get-nfts",
  SendNft = "send-nft",
  GetRoles = "get-roles",
  DeleteRole = "delete-role",
  AddRole = "add-role",
}

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

  public setGuildsBotChannel = ({ guilds }: { guilds: string[] }) => {
    guilds.forEach((guildId) => {
      this.setGuildBotChannel({ guildId });
    });
  };

  public setGuildBotChannel = ({ guildId }: { guildId: string }) => {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    for (const channel of guild.channels.cache.values()) {
      if (channel.name === "web3-kirobo-config") {
        return;
      }
    }
    guild.channels
      .create("web3-kirobo-config", {
        reason: "Config for web3-kirobo-bot",
      })
      .catch(console.error);
  };

  public setCommands = async ({ guilds }: { guilds: string[] }) => {
    return Promise.all(guilds.map(this.setCommand));
  };

  public setCommand = async (guildId: string) => {
    const roles = await this.roles.getRoles({ guildId });
    const roleChoices = roles.map(
      (role) => [role.name, role.name] as [string, string]
    );
    const commands = [
      new SlashCommandBuilder()
        .setName("connect")
        .setDescription("Connect with metamask account"),
      new SlashCommandBuilder()
        .setName("disconnect")
        .setDescription("Disconnect metamask"),
      new SlashCommandBuilder()
        .setName("get-nfts")
        .setDescription("get nfts data"),
      new SlashCommandBuilder()
        .setName("send-nft")
        .setDescription("send nft image"),
      new SlashCommandBuilder()
        .setName("get-roles")
        .setDescription("get roles"),
      new SlashCommandBuilder()
        .setName("delete-role")
        .setDescription("delete role by name")
        .addStringOption((option) =>
          option
            .setName("role-name")
            .setDescription("role name")
            .addChoices(roleChoices)
        ),
      new SlashCommandBuilder()
        .setName("add-role")
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
    ].map((command) => command.toJSON());

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
    if (!interaction.isCommand()) return;
    switch (interaction.commandName) {
      case Commands.Connect:
        this.connect(interaction);
        break;
      case Commands.Disconnect:
        this.disconnect(interaction);
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

  private connect = (interaction: CommandInteraction<CacheType>) => {
    if (this.users[interaction.user.id]) {
      interaction.reply({
        content: "already connected",
        ephemeral: true,
      });
      return;
    }
    crypto.randomBytes(48, async (_err, buffer) => {
      const token = buffer.toString("hex");
      const guild = this.client.guilds.cache.get(interaction?.guild?.id || "");
      const user = guild?.members.cache.get(interaction.user.id);
      const presence = user?.guild.presences.cache.get(interaction.user.id);

      const reply = this.getConnectReply({ presence, token });
      interaction.reply(reply);

      this.createUser({
        userId: interaction.user.id,
        channelId: interaction.channelId,
        token: { token },
        guildId: interaction?.guild?.id || "",
      });
    });
  };

  private disconnect = (interaction: CommandInteraction<CacheType>) => {
    if (!this.users[interaction.user.id]) {
      interaction.reply("not connected");
      return;
    }

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
      console.log({ roleName });
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

  private createUser = ({
    userId,
    channelId,
    token,
    guildId,
  }: {
    channelId: string;
    userId: string;
    token: { token: string };
    guildId: string;
  }) => {
    const connectListener = (socket: IoSocket) => {
      if (token.token === "") {
        return;
      }
      if (this.users[userId]) return;
      if (socket.handshake.query.token !== token.token) return;
      token.token = "";
      const user = new User({
        client: this.client,
        channelId,
        userId,
        sessionId: socket.id,
        guildId,
      });

      this.users[userId] = user;
      this.users[userId]?.startAccountListener({ socket });
    };
    setTimeout(() => {
      token.token = "";
    }, 60000);
    this.io.on("connection", connectListener);
  };

  private getConnectReply = ({
    token,
    presence,
  }: {
    presence: Presence | undefined;
    token: string;
  }) => {
    const desktopLink = `${URL}?token=${token}`;
    const mobileLink = `${URL_METAMASK}?token=${token}`;

    const embedDesktopLink = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Connect")
      .setURL(desktopLink)
      .setDescription(`Connect to metamask account`);

    const embedMobileLink = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Connect")
      .setURL(mobileLink)
      .setDescription(`Connect to metamask account in metamask browser`);

    if (presence?.clientStatus?.mobile !== "online") {
      return {
        embeds: [embedDesktopLink],
        ephemeral: true,
      };
    } else if (
      presence?.clientStatus?.desktop !== "online" &&
      presence?.clientStatus?.web !== "online"
    ) {
      return {
        embeds: [embedMobileLink],
        ephemeral: true,
      };
    } else {
      return {
        embeds: [embedDesktopLink, embedMobileLink],
        ephemeral: true,
      };
    }
  };
}
