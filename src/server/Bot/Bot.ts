import {
  CacheType,
  Client,
  ColorResolvable,
  CommandInteraction,
  EmbedField,
  TextChannel,
  Permissions as DiscordPermissions,
  MessageAttachment,
  MessageEmbed,
} from "discord.js";
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
import { getCommands, Commands, adminOnlyCommands } from "./commands";
import { UI } from "./UI";
import { VAULT_URL, MONGO_URL, BOT_NAME } from "../constants";
import open from "open";
import { Web3Subscriber } from "../../Web3/Web3Subscriber";
import { Vault } from "../../Web3/Vault";
import { Guild } from "./Guild";
import Canvas from "canvas";
import { NFT } from "./User/NFTs";

config();

const clientId = process.env.CLIENT_ID || "";

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

export type DbUser = { wallet: string, vault: string }
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
  public permissions;
  public guilds: { [key: string]: Guild | undefined } = {};

  private client: Client<boolean>;
  private io: IO;
  private users: { [key: string]: User | undefined } = {};

  private roles;
  private chainId: 1 | 4 = 4;
  constructor({
    client,
    rest,
    io,
  }: {
    client: Client<boolean>;
    rest: REST;
    io: IO;
  }) {
    Bot.rest = rest;

    this.client = client;
    this.io = io;
    this.roles = new Roles({ client });
    this.permissions = new Permissions({ client, roles: this.roles });
    this.subscribeUsers();
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

  public static setNftSubCommands = async ({
    values,
    guildId,
  }: // withPrevChoices,
  {
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
    const command = commands.find(
      (command) => command.name === Commands.SendNft
    );

    if (!command) return;

    // const prevChoices = withPrevChoices
    //   ? command.options[0]?.choices?.map(
    //       (choice) => [choice.name, choice.value] as [string, string]
    //     )
    //   : [];
    const currentChoices = values.map(
      (choice) => [choice.name, choice.name] as [string, string]
    );
    const cc = new SlashCommandBuilder()
      .setName(command.name)
      .setDescription(command.description)
      .addStringOption((option) =>
        option
          .setName("nft")
          .setDescription("send nft")
          //.addChoices(prevChoices ? prevChoices : [])
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
    await Promise.all(
      guilds.map(async (guildId) => {
        for (const user of users) {
          const dbUser = (await this.guilds[guildId]?.usersDb.get(user.id)) as
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
      })
    );
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
      if (channel.name === `${BOT_NAME}-config`) {
        await channel.delete();
      }
    }
    const channel = await guild.channels
      .create(`${BOT_NAME}-config`, {
        reason: `Config for ${BOT_NAME}`,
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
    const buttons = UI.getButtonsRow({
      label: "Connect",
      customId: "connect",
      secondLabel: "Help",
      secondCustomId: "help",
    });

    guildChannel
      .send({
        embeds: [connectMessage],
        components: [buttons],
        files: [attachment, logoAttachment],
      })
      .then((message) => message.pin());
  };

  public setGuilds = ({ guilds }: { guilds: string[] }) => {
    return guilds.map(this.setGuild);
  };

  public setGuild = (guildId: string) => {
    const keyvRoles = new Keyv(`${MONGO_URL}`, {
      namespace: `guild:${guildId}:roles`,
    });
    const keyvUsers = new Keyv(`${MONGO_URL}`, {
      namespace: `guild:${guildId}:users`,
    });

    const newGuild = new Guild({
      usersDb: keyvUsers,
      rolesDb: keyvRoles,
      guildId,
    });
    this.guilds[guildId] = newGuild;
    this.roles.guilds[guildId] = newGuild;
  };

  public deleteGuild = (guildId: string) => {
    const guild = this.guilds[guildId];

    guild?.rolesDb.clear();
    guild?.usersDb.clear();

    delete this.guilds[guildId];
    delete this.roles.guilds[guildId];
  };

  public setCommands = async ({ guilds }: { guilds: string[] }) => {
    return Promise.all(guilds.map(this.setCommand));
  };

  public setCommand = async (guildId: string) => {
    const roles = await this.roles.getRoles({ guildId });
    this.client.emojis.cache.values();
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

        case Commands.Help:
          await this.help(interaction);
          break;
      }
    }

    if (!interaction.isCommand()) return;
    switch (interaction.commandName) {
      case Commands.Help:
        await this.help(interaction);
        break;
      case Commands.SetChain:
        await this.setChain(interaction);
        break;
      case Commands.GetChain:
        await this.getChain(interaction);
        break;
      case Commands.Connect:
        await this.connect(interaction);
        break;
      case Commands.Disconnect:
        await this.disconnect(interaction);
        break;
      case Commands.MyVault:
        if (!(await this.isUserExist(interaction))) return;
        await this.getMyVault(interaction);

        break;
      case Commands.AddRole:
        await this.addRole(interaction);
        break;
      case Commands.GetRoles:
        await this.roles.sendRoles(interaction);
        break;
      case Commands.MyRole:
        if (!(await this.isUserExist(interaction))) return;
        await this.roles.sendRole(interaction);
        break;
      case Commands.DeleteRole:
        await this.deleteRole(interaction);
        break;
      case Commands.SendKiro:
        if (!(await this.isUserExist(interaction))) return;
        await this.sendKiro(interaction);
        break;
    }
  };

  private isUserExist = async (interaction: CommandInteraction<CacheType>) => {
    if (!interaction.guildId) return;
    const user = await this.guilds[interaction.guildId]?.usersDb.get(
      interaction.user.id
    );
    if (!user) {
      const connectButton = UI.getButton({
        label: "Connect",
        customId: "connect",
      });
      interaction.reply({
        content: "Not connected",
        ephemeral: true,
        components: [connectButton],
      });
      return false;
    }

    return true;
  };

  private help = async (interaction: CommandInteraction<CacheType>) => {
    if (!interaction.guildId) return;
    const roles = await this.roles.getRoles({ guildId: interaction.guildId });
    this.client.emojis.cache.values();
    const commands = getCommands({ roles });

    const member = this.client.guilds.cache
      .get(interaction.guildId)
      ?.members.cache.get(interaction.user.id);

    const isRoleManager = member?.permissions?.has(
      DiscordPermissions.FLAGS.MANAGE_ROLES
    );

    const fields: EmbedField[] = [];
    commands.forEach((command) => {
      if (
        !isRoleManager &&
        adminOnlyCommands.includes(command.name as Commands)
      )
        return;
      fields.push({
        name: `/${command.name}`,
        // @ts-expect-error: description exists
        value: command?.description,
        inline: false,
      });
    });

    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });
    const connectMessage = UI.getMessageEmbedWith({
      thumbnail: "attachment://vault.png",
      fields,
      author: {
        name: "Kirobo Vault Bot",
        iconURL: "attachment://kirogo.png",
        url: VAULT_URL,
      },
    });

    interaction.reply({
      embeds: [connectMessage],
      files: [attachment, logoAttachment],
      ephemeral: true,
    });
  };

  private getChainReply = ({ chainId }: { chainId: string | null }) => {
    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });
    const connectMessage = UI.getMessageEmbedWith({
      title: "Current Chain",
      color: chainId === "1" ? "BLUE" : "ORANGE",
      description: chainId === "1" ? "Main" : "Rinkeby",
      thumbnail: "attachment://vault.png",
      footer: {
        text: "Kirobo",
        iconURL: "attachment://kirogo.png",
      },
    });

    return {
      embeds: [connectMessage],
      files: [attachment, logoAttachment],
      ephemeral: true,
    };
  };

  private getChain = async (interaction: CommandInteraction<CacheType>) => {
    interaction.reply(this.getChainReply({ chainId: String(this.chainId) }));
  };

  private setChain = async (interaction: CommandInteraction<CacheType>) => {
    const chainId: "1" | "4" | null = interaction.options.getString(
      "chain-name"
    ) as "1" | "4" | null;

    this.chainId = chainId ? (Number(chainId) as 1 | 4) : 1;

    await this.handleChainChange();

    interaction.reply(this.getChainReply({ chainId }));
  };

  private connect = async (interaction: CommandInteraction<CacheType>) => {
    if (!interaction.guildId) return;
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

  private getMyVault = async (interaction: CommandInteraction<CacheType>) => {
    interaction.deferReply();
    const user = this.users[interaction.user.id];
    if (!user) {
      const connectButton = UI.getButton({
        label: "Connect",
        customId: "connect",
      });
      return interaction.editReply({
        content: "your address not found, try to connect",
        components: [connectButton],
      });
    }

    const message = await user.getVaultMessage({
      chainId: this.chainId,
    });
    const nftEmbeds = await this.getNfts({ interaction, type: "Vault" });

    return interaction.editReply({
      embeds: message?.embeds.concat(nftEmbeds?.embeds || []),
      files: message?.files?.concat(nftEmbeds?.attachments || []),
    });
  };

  private connectOnButtonClick = async (
    interaction: CommandInteraction<CacheType>
  ) => {
    if (!interaction.guildId) return;
    crypto.randomBytes(48, async (_err, buffer) => {
      const token = buffer.toString("hex");
      const guild = this.client.guilds.cache.get(interaction?.guild?.id || "");
      const user = guild?.members.cache.get(interaction.user.id);
      const presence = user?.guild.presences.cache.get(interaction.user.id);
      interaction.reply({ content: "Connect to metamask", ephemeral: true });
      const url = UI.getConnectUrl({
        presence,
        token,
        userId: interaction.user.id,
      });
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

    if (!interaction.guildId) return;
    await this.guilds[interaction.guildId]?.usersDb.delete(interaction.user.id);
    const user = this.users[interaction.user.id];
    user?.removeAllListeners();
    await this.roles.deleteUserRoles({
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    delete this.users[interaction.user.id];
    interaction.reply({ content: "disconnected", ephemeral: true });
  };
  private addRole = async (interaction: CommandInteraction<CacheType>) => {
    const roleName = interaction.options.getString("role-name");
    const amount = interaction.options.getInteger("kiro-amount-required");
    const color = interaction.options.getString("color") as ColorResolvable;
    const emoji = interaction.options.getString("emoji");

    if (!roleName)
      return interaction.reply({
        content: "role name required",
        ephemeral: true,
      });
    if (!amount)
      return interaction.reply({ content: "amount required", ephemeral: true });

    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.reply("failed to fetch guild id");
    try {
      await this.roles.createRole({
        roleName,
        amount: amount.toString(),
        guildId,
        color,
        emoji,
      });
      return interaction.reply({ content: "added", ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: e.message, ephemeral: true });
    }
  };

  private deleteRole = async (interaction: CommandInteraction<CacheType>) => {
    const roleName = interaction.options.getString("role-name");

    if (!roleName)
      return interaction.reply({
        content: "role name required",
        ephemeral: true,
      });

    const guildId = interaction.guild?.id;
    if (!guildId)
      return interaction.reply({
        content: "failed to fetch guild id",
        ephemeral: true,
      });
    try {
      await this.roles.deleteRole({ roleName, guildId });
      return interaction.reply({ content: "deleted", ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: e.message, ephemeral: true });
    }
  };

  private sendKiro = async (interaction: CommandInteraction<CacheType>) => {
    const user = interaction.options.getUser("user-name");
    if (!user) {
      return interaction.reply({
        content: `user not found`,
        ephemeral: true,
      });
    }

    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.reply({ content: "failed to fetch guild id", ephemeral: true });

    // const dbUserFrom = await this.guilds[guildId]?.usersDb.get(
    //   interaction.user.id
    // ) as DbUser

    const dbUserTo = await this.guilds[guildId]?.usersDb.get(
      user.id
    ) as DbUser
    if (!dbUserTo) {
      return interaction.reply({
        content: `user ${user.username} not connected with his web3 account`,
        ephemeral: true,
      });
    }

    const amount = interaction.options.getInteger("amount");
    if (!amount)
      return interaction.reply({ content: "amount required", ephemeral: true });

    const walletType = interaction.options.getString("wallet-type") as
      | "wallet"
      | "vault";

    if (!walletType)
      return interaction.reply({ content: "wallet type required", ephemeral: true });

    // interaction.deferReply();
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const presence = member?.guild.presences.cache.get(interaction.user.id);
    switch (walletType) {
      case "vault":
        const res = UI.getSendKiroReply({ presence, addressTo: dbUserTo.wallet, amount: String(amount), chainId: String(this.chainId)  })
        console.log({ res })
        interaction.reply(res)
        break;
    
      default:
        break;
    }

  };

  private getNfts = async ({
    interaction,
    type,
  }: {
    interaction: CommandInteraction<CacheType>;
    type: "Vault" | "Wallet";
  }) => {
    const user = this.users[interaction.user.id];
    if (!user) {
      interaction.editReply({ content: "not connected" });
    }

    //await interaction.deferReply();
    const nfts = await user?.getNfts({
      chain: this.chainId === 1 ? "eth" : "rinkeby",
    });

    if (!nfts || (!nfts.wallet.length && !nfts.vault.length)) {
      interaction.editReply({ content: "not found" });
      return;
    }

    const nftsEmbeds = await this.getNftsMessageEmbed({
      nfts: type === "Vault" ? nfts.vault : nfts.wallet,
      type,
      username: interaction.user.username,
    });

    return nftsEmbeds;
  };

  private getNftsMessageEmbed = async ({
    nfts,
    type,
  }: // username,
  {
    nfts: NFT[];
    type: "Wallet" | "Vault";
    username: string;
  }) => {
    const embeds: MessageEmbed[] = [];
    const attachments: MessageAttachment[] = [];

    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });

    attachments.push(logoAttachment);
    for (let i = 0; i < nfts.length; i++) {
      if (nfts[i].type === "base64") {
        const canvas = await this.getNftCanvas(nfts[i]);
        const nftFileName = nfts[i].name + i + type;
        const nftAttachment = new MessageAttachment(
          canvas.toBuffer(),
          `${nftFileName}.png`
        );
        attachments.push(nftAttachment);

        embeds.push(
          UI.getMessageEmbedWith({
            url: `https://vault.kirobo.me/overview`,
            image: `attachment://${nftFileName}.png`,
            footer: {
              text: "Kirobo Vault",
              iconURL: "attachment://kirogo.png",
            },
          })
        );
      } else {
        embeds.push(
          UI.getMessageEmbedWith({
            url: `https://vault.kirobo.me/overview`,
            image: nfts[i].value,
            footer: {
              text: "Kirobo Vault",
              iconURL: "attachment://kirogo.png",
            },
          })
        );
      }
    }

    return { embeds, attachments };
  };

  private getNftCanvas = async (nft: NFT) => {
    const nftImage = await Canvas.loadImage(nft.value);
    const nativeWidth = nftImage.width;
    const nativeHeight = nftImage.height;

    const canvas = Canvas.createCanvas(nativeWidth, nativeHeight);
    const context = canvas.getContext("2d");

    context.drawImage(nftImage, 0, 0, nativeWidth, nativeHeight);

    return canvas;
  };

  private connectUser = async ({
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

      user?.startAccountListener({
        socket,
        channelId: interaction.channelId,
        chainId: this.chainId,
      });
    };
    setTimeout(() => {
      token.token = "";
    }, 60000);

    this.io.off("connection", connectListener);
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
    const usersDb = this.guilds[guildId]?.usersDb;
    if (!usersDb) throw new Error(`Users db for guildId ${guildId} not found`);
    const user = new User({
      client: this.client,
      userId,
      guildId,
      usersDb,
      address,
      vaultAddress,
      roles: this.roles,
    });
    this.users[userId] = user;

    return user;
  };

  public handleChainChange = async () => {
    for (const user of Object.values(this.users)) {
      if (!user) continue;

      const address = user.getAddress();
      if (!address) continue;

      user.handleAccountChange({
        account: address,
        userId: user.getUserId(),
        chainId: Number(this.chainId) as 1 | 4,
      });
    }
  };

  private subscribeUsers = () => {
    Web3Subscriber.subscribeOnNewBlock({
      chainId: String(this.chainId) as "1" | "4",
      callback: async () => {
        for (const user of Object.values(this.users)) {
          if (!user) continue;

          const address = user.getAddress();
          if (!address) continue;

          const balance = await Vault.getKiroBalance({
            address,
            vaultAddress: user.getVaultAddress(),
            chainId: Number(this.chainId) as 1 | 4,
          });
          await user.updateUserRoles({ totalBalance: balance.total });
        }
      },
    });
  };
}
