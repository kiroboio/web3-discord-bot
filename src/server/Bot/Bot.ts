import {
  Client,
  MessageEmbed,
  OverwriteResolvable,
  Presence,
  Permissions,
  GuildMember,
  PartialGuildMember,
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
config();

const clientId = process.env.CLIENT_ID || "";

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

type CommandType = {
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
  private client: Client<boolean>;
  private io: IO;
  private rest: REST;
  private users: { [key: string]: User | undefined } = {};
  private rolesDb: Keyv;
  public usersDb: Keyv;
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
    this.client = client;
    this.rest = rest;
    this.io = io;
    this.rolesDb = rolesDb;
    this.usersDb = usersDb;
  }

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
    const permissions: OverwriteResolvable[] = [];
    for (const member of guild.members.cache.values()) {
      if (!member.permissions.has(Permissions.FLAGS.KICK_MEMBERS)) {
        permissions.push({
          id: member.id,
          deny: [Permissions.FLAGS.VIEW_CHANNEL],
        });
      }
    }
    guild.channels
      .create("web3-kirobo-config", {
        reason: "Config for web3-kirobo-bot",
        permissionOverwrites: permissions,
      })
      .catch(console.error);
  };

  public setNewMemberBotChannelPermissions = ({
    member,
  }: {
    member: GuildMember | PartialGuildMember;
  }) => {
    if (!member.guild.id || !member.id) return;
    const guildId = member.guild.id;
    const userId = member.id;
    const guild = this.client.guilds.cache.get(guildId);

    if (!guild) return;
    for (const channel of guild.channels.cache.values()) {
      if (channel.name === "web3-kirobo-config") {
        const permissions = member.permissions.has(
          Permissions.FLAGS.KICK_MEMBERS
        )
          ? { VIEW_CHANNEL: true }
          : { VIEW_CHANNEL: false };
        // @ts-expect-error: wrong typing, permissionOverwrites exist
        channel.permissionOverwrites.edit(userId, permissions);
        return;
      }
    }
  };

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
    const commands: CommandType[] = (await this.rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as CommandType[];
    const command = commands.find((command) => command.name === "add-role");
    if (!command) return;

    const roles = this.client.guilds.cache.get(guildId)?.roles.cache.values();
    if (!roles) return;
    for (const role of roles) {
      if (role.name !== "kirobo-bot-admin") {
        await this.rest
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
    }
  };


  public setCommands = async ({ guilds }: { guilds: string[] }) => {
    return Promise.all(guilds.map(this.setCommand));
  };

  public setCommand = async (guildId: string) => {
    const roles = await this.getRoles({ guildId });
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

    await this.rest
      .put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      })
      .then(() => console.log("Successfully registered application commands."))
      .catch(console.error);
  };

  public deleteAllCommands = async ({ guildId }: { guildId: string }) => {
    const commands: CommandType[] = (await this.rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as CommandType[];
    commands.map((cmd) => {
      const deleteUrl = `${Routes.applicationGuildCommands(
        clientId,
        guildId
      )}/${cmd.id}` as `/${string}`;
      this.rest.delete(deleteUrl);
    });
  };

  public setSubCommands = async ({
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
    const commands: CommandType[] = (await this.rest.get(
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
    console.log({ prevChoices, currentChoices });
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
    this.rest
      .patch(Routes.applicationGuildCommand(clientId, guildId, command.id), {
        body: cc.toJSON(),
      })
      .then(() => console.log("Successfully registered application commands."))
      .catch(console.error);
  };

  public runClient = () => {
    this.client.once("ready", () => {
      this.client.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand()) return;
        if (interaction.commandName === "connect") {
          if (this.users[interaction.user.id]) {
            interaction.reply({
              content: "already connected",
              ephemeral: true,
            });
            return;
          }
          crypto.randomBytes(48, async (_err, buffer) => {
            const token = buffer.toString("hex");
            const guild = this.client.guilds.cache.get(
              interaction?.guild?.id || ""
            );
            const user = guild?.members.cache.get(interaction.user.id);
            const presence = user?.guild.presences.cache.get(
              interaction.user.id
            );

            const reply = this.getConnectReply({ presence, token });
            interaction.reply(reply);

            this.createUser({
              userId: interaction.user.id,
              channelId: interaction.channelId,
              token: { token },
              guildId: interaction?.guild?.id || "",
            });
          });
        }
        if (interaction.commandName === "disconnect") {
          if (!this.users[interaction.user.id]) {
            interaction.reply("not connected");
            return;
          }

          delete this.users[interaction.user.id];
          interaction.reply({ content: "disconnected", ephemeral: true });
        }

        if (interaction.commandName === "get-nfts") {
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
          this.setSubCommands({
            commandName: "send-nft",
            values: nfts,
            guildId: interaction?.guild?.id || "",
            subCommandName: "nft",
            withPrevChoices: true,
          });

          interaction.editReply({ content: "succeed" });
        }
        if (interaction.commandName === "send-nft") {
          if (!this.users[interaction.user.id])
            return interaction.reply({ content: "not connected" });

          const uri = interaction.options.getString("nft");
          if (!uri) return interaction.reply({ content: "wrong uri" });
          const embed = this.users[interaction.user.id]?.getNftMessage({ uri });
          if (!embed) return interaction.reply({ content: "not found" });
          interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === "add-role") {
          const roleName = interaction.options.getString("role-name");
          const amount = interaction.options.getInteger("kiro-amount-required");
          if (!roleName) return interaction.reply("role name required");
          if (!amount) return interaction.reply("amount required");

          const guildId = interaction.guild?.id;
          if (!guildId) return interaction.reply("failed to fetch guild id");
          try {
            await this.createRole({
              roleName,
              amount: amount.toString(),
              guildId,
            });
            interaction.reply("added");
          } catch (e) {
            interaction.reply(e.message);
          }
        }

        if (interaction.commandName === "delete-role") {
          const roleName = interaction.options.getString("role-name");

          if (!roleName) return interaction.reply("role name required");

          const guildId = interaction.guild?.id;
          if (!guildId) return interaction.reply("failed to fetch guild id");
          try {
            console.log({ roleName });
            await this.deleteRole({ roleName, guildId });
            interaction.reply("deleted");
          } catch (e) {
            interaction.reply(e.message);
          }
        }

        if (interaction.commandName === "get-roles") {
          const guildId = interaction.guild?.id;
          if (!guildId) return interaction.reply("failed to fetch guild id");
          try {
            const roles = await this.getRoles({ guildId });
            console.log({ roles });
          } catch (e) {
            interaction.reply(e.message);
          }
        }
      });
    });
    this.client.login(process.env.TOKEN);
  };

  private updateRoleCommands = async ({ guildId }: { guildId: string }) => {
    const roles = await this.getRoles({ guildId });
    this.setSubCommands({
      guildId,
      values: roles,
      commandName: "delete-role",
      subCommandName: "role-name",
      withPrevChoices: false,
    });
  };

  private createRole = async ({
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

  private deleteRole = async ({
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

  private getRoles = async ({ guildId }: { guildId: string }) => {
    const guild = this.client.guilds.cache.get(guildId);

    const roles = [];
    if (!guild) return [];
    for (const role of guild.roles.cache.values()) {
      const amount = await this.rolesDb.get(role.name);
      if (amount) {
        roles.push({
          name: role.name,
          value: role.name,
          amount,
        });
      }
    }
    return roles;
  };

  public getData = async ({ roleName }: { roleName: string }) => {
    return await this.rolesDb.get(roleName);
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