import {
  CacheType,
  Client,
  ColorResolvable,
  CommandInteraction,
  EmbedFieldData,
  EmbedFooterData,
  MessageAttachment,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import express from "express";
import { Socket } from "socket.io";
import { Vault } from "../../../client/src/Web3/Vault";
import { config } from "dotenv";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import path from "path";
import { COLORS, URL, VAULT_URL } from "../../constants";

import { UI } from "../UI";
import Keyv from "keyv";
import { Roles } from "../Roles";
import { NFTs } from "./NFTs";

config();

const app = express();
app.use(express.static(path.join(__dirname, "../../", "client/build")));

type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

export class User extends NFTs {
  private guildId: string;
  private usersDb: Keyv;
  private roles: Roles;
  public socket: IoSocket | null;

  constructor({
    client,
    userId,
    guildId,
    usersDb,
    address,
    vaultAddress,
    roles,
  }: {
    client: Client<boolean>;
    userId: string;
    guildId: string;
    usersDb: Keyv;
    roles: Roles;
    address?: string;
    vaultAddress?: string;
  }) {
    super({ client, userId, address, vaultAddress });
    this.guildId = guildId;
    this.usersDb = usersDb;
    this.roles = roles;
  }

  public getUserId = () => {
    return this.userId;
  };

  public getVaultAddress = () => {
    return this.vaultAddress;
  };

  public getAddress = () => {
    return this.address;
  };

  public removeAllListeners = () => {
    if (!this.socket) return;
    this.socket.removeAllListeners("account");
  };

  public startAccountListener = ({
    socket,
    interaction,
    chainId,
  }: {
    socket: IoSocket;
    interaction: CommandInteraction<CacheType>;
    chainId: 1 | 4;
  }) => {
    this.socket = socket;
    const listener = ({
      account,
      userId,
    }: {
      account: string;
      userId: string;
    }) => {
      this?.handleAccountChange({ account, userId, interaction, chainId });
      socket.emit("connectedAccount", account);
    };
    socket.on("account", listener);

    socket.on("disconnect", () => {
      this.socket = null;
    });

    socket.on(
      "transactionSendSuccess",
      ({
        trxHash,
        channelId,
        url,
      }: {
        trxHash: string;
        channelId: string;
        url?: string;
      }) => {
        const channel = this.client.channels.cache.get(
          channelId
        ) as TextChannel;

        const embed = UI.getMessageEmbedWith({
          title: `:tada: Transaction sent successfully`,
          url,
          fields: [{ name: "Hash", value: trxHash }],
        });
        channel?.send({ embeds: [embed] });
      }
    );

    socket.on(
      "transactionSendFailed",
      ({
        error,
        channelId,
        url,
      }: {
        error: string;
        channelId: string;
        url?: string;
      }) => {
        const channel = this.client.channels.cache.get(
          channelId
        ) as TextChannel;

        const embed = UI.getMessageEmbedWith({
          title: `:face_with_symbols_over_mouth: Transaction failed`,
          color: "RED",
          url,
          fields: [{ name: "Error", value: error }],
        });
        channel?.send({ embeds: [embed] });
      }
    );

    socket.on(
      "deposits",
      ({ deposits, userId }: {
        deposits: {
          id: string;
          to: string;
        }[];
        userId: string;
      }) => {
        const depositButtons = deposits.map((deposit) => ({
          label: `UNDO transfer to ${this.shortenAddress(deposit.to)}`,
          customId: `guild:${this.guildId}_deposit:${deposit.id}`,
        }));

        const user = this.client.users.cache.get(
          userId
        );

        const embed = UI.getMessageEmbedWith({
          title: `Deposits`,
        });

        depositButtons.forEach((_button, i) => {
          const index = i + 1;
          if(index % 5 === 0 || index === depositButtons.length) {
            const gap = index % 5 === 0 ? 5 : index % 5;
            user?.send({ embeds: [embed], components: [UI.getButtonsWithId(depositButtons.slice(index - gap, index))] })
          }
        });
      }
    );

    socket.on(
      "collects",
      ({ collects, userId }: {
        collects: {
          id: string;
          from: string;
        }[];
        userId: string;
      }) => {
        const collectButtons = collects.map((collect) => ({
          label: `Collect transfer from ${this.shortenAddress(collect.from)}`,
          customId: `guild:${this.guildId}_collect:${collect.id}`,
        }));

        const user = this.client.users.cache.get(
          userId
        );
        const embed = UI.getMessageEmbedWith({
          title: `Collects`,
        });

        collectButtons.forEach((_button, i) => {
          const index = i + 1;
          if(index % 5 === 0 || index === collectButtons.length) {
            const gap = index % 5 === 0 ? 5 : index % 5;
            user?.send({ embeds: [embed], components: [UI.getButtonsWithId(collectButtons.slice(index - gap, index))] })
          }
        });
      }
    );
  };

  public emitGetTransaction = ({ type, userId }: { type: "DEPOSIT" | "COLLECT", userId: string }) => {
    if (!this.socket) return false;
    this.socket.emit("getTransactions", {
      type,
      userId,
    });
    return true;
  };

  public undo = ({ id }: { id: string }) => {
    if (!this.socket) return false;
    this.socket.emit("retrieve", {
      id,
    });
    return true;
  };

  public collect = ({ id, passcode }: { id: string, passcode: string }) => {
    if (!this.socket) return false;
    this.socket.emit("collect", {
      id,
      passcode
    });
    return true;
  };


  public emitSend = ({
    addressTo,
    chainId,
    amount,
    channelId,
    currency,
    type,
    url,
  }: {
    chainId: string;
    amount: string;
    addressTo: string;
    channelId: string;
    type: "wallet" | "vault";
    currency: string;
    url?: string;
  }) => {
    if (!this.socket) return false;
    this.socket.emit("send", {
      addressTo,
      chainId,
      amount,
      channelId,
      type,
      url,
      currency,
    });
    return true;
  };

  public emitSendEthSafe = ({
    addressTo,
    chainId,
    amount,
    channelId,
    type,
    passcode,
    url,
  }: {
    chainId: string;
    amount: string;
    addressTo: string;
    channelId: string;
    type: "wallet" | "vault";
    passcode: string;
    url?: string;
  }) => {
    if (!this.socket) return false;
    this.socket.emit("sendKiro", {
      addressTo,
      chainId,
      amount,
      channelId,
      type,
      url,
      passcode,
    });
    return true;
  };

  private shortenAddress = (address?: string | null, length = 4): string => {
    if (!address) return "";
    if (address.length < length * 2 + 5) return address;
  
    const left = address.slice(0, length + 2);
    const right = address.slice(address.length - length);
    return `${left}...${right}`;
  };
  

  private getMessageToUserEmbeds = ({
    color = COLORS.primary,
    title,
    url,
    description,
    image,
    thumbnail,
    files,
    footer,
    fields,
  }: {
    color?: ColorResolvable;
    title?: string;
    url?: string;
    description?: string;
    image?: string;
    thumbnail?: string;
    files?: MessageAttachment[];
    footer?: EmbedFooterData;
    fields?: EmbedFieldData[];
  }) => {
    const embed = UI.getMessageEmbedWith({
      color,
      title,
      url,
      description,
      image,
      thumbnail,
      fields,
      footer,
    });

    return { embeds: [embed], files };
  };

  public sendMessage = ({
    channelId,
    embeds,
    files,
  }: {
    channelId: string;
    embeds: MessageEmbed[] | undefined;
    files?: MessageAttachment[] | undefined;
  }) => {
    const channel = this.client.channels.cache.get(channelId) as TextChannel;
    channel.send({ embeds, files });
  };

  public handleAccountChange = async ({
    account,
    userId,
    chainId,
    interaction,
  }: {
    account: string;
    userId: string;
    chainId: 1 | 4;
    interaction?: CommandInteraction<CacheType>;
  }) => {
    if (userId !== this.userId) return;
    if (!account) return;

    this.address = account;
    this.usersDb.set(this.userId, { wallet: account });
    await Vault.setVaultContract({ address: account, chainId });

    const vaultContract = Vault.contract[account];
    this.vaultAddress = vaultContract?.options.address;
    this.usersDb.set(this.userId, {
      wallet: account,
      vault: vaultContract?.options.address,
    });

    const balance = await Vault.getKiroBalance({
      address: this.address,
      vaultAddress: this.vaultAddress,
      chainId,
    });

    const message = await this.getVaultMessage({ chainId });
    if (message && interaction) {
      const channel = this.client.channels.cache.get(interaction?.channelId) as TextChannel;
      channel.send({
        embeds: message.embeds,
        files: message.files,
      });
    }
    await this.updateUserRoles({ totalBalance: balance.total });
  };

  public getVaultMessage = async ({ chainId }: { chainId: 1 | 4 }) => {
    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });

    if (!this.address) return;
    const balance = await Vault.getKiroBalance({
      address: this.address,
      vaultAddress: this.vaultAddress,
      chainId,
    });

    const userName = this.client.users.cache.get(this.userId)?.username;
    return this.getMessageToUserEmbeds({
      title: userName
        ? `${userName.charAt(0).toUpperCase() + userName.slice(1)} Vault`
        : "Vault",
      url: VAULT_URL,
      thumbnail: "attachment://vault.png",
      footer: { text: "Kirobo", iconURL: "attachment://kirogo.png" },
      files: [attachment, logoAttachment],
      fields: [
        {
          name: "Chain",
          value: chainId === 1 ? "Main" : "Rinkeby",
          inline: false,
        },
        {
          name: "Wallet Address",
          value: this.address,
          inline: false,
        },
        {
          name: "Vault Address",
          value: this.vaultAddress
            ? this.vaultAddress
            : "Vault not found :confounded:",
          inline: false,
        },
        {
          name: "Wallet Kiro Balance",
          value: balance.wallet,
          inline: true,
        },
        {
          name: "Vault Kiro Balance",
          value: balance.vault || "0",
          inline: true,
        },
      ],
    });
  };

  public getSendTrxMessage = async ({
    chainId,
    symbol,
    userToId,
    amount,
    addressFrom,
    addressTo,
  }: {
    chainId: 1 | 4;
    symbol: string;
    userToId: string;
    amount: string;
    addressFrom: string;
    addressTo: string;
  }) => {
    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });

    if (!this.address) return;

    const userName = this.client.users.cache.get(this.userId)?.username;
    const userToName = this.client.users.cache.get(userToId)?.username;
    return this.getMessageToUserEmbeds({
      title: `Sending ${symbol}`,
      url: URL,
      thumbnail: "attachment://vault.png",
      footer: { text: "Kirobo", iconURL: "attachment://kirogo.png" },
      files: [attachment, logoAttachment],
      fields: [
        {
          name: "Chain",
          value: chainId === 1 ? "Main" : "Rinkeby",
          inline: false,
        },
        {
          name: `From ${userName}`,
          value: addressFrom,
          inline: false,
        },
        {
          name: `To ${userToName}`,
          value: addressTo,
          inline: false,
        },
        {
          name: `Amount`,
          value: `${amount} ${symbol}`,
          inline: false,
        },
      ],
    });
  };

  public updateUserRoles = async ({
    totalBalance,
  }: {
    totalBalance: string;
  }) => {
    const balanceNumber = parseFloat(totalBalance);
    const guild = this.client.guilds.cache.get(this.guildId);
    if (!guild) return;

    const user = guild.members.cache.get(this.userId);
    if (!user) return;
    const roles = await this.roles.getRoles({ guildId: guild.id });

    roles.forEach(async (role) => {
      const guildRole = guild.roles.cache.get(role.id);
      if (parseFloat(role.amount) <= balanceNumber && guildRole) {
        user.roles.add(guildRole.id).catch(console.error);
      }
      if (
        parseFloat(role.amount) > balanceNumber &&
        guildRole &&
        user.roles.cache.has(guildRole.id)
      ) {
        user.roles.remove(guildRole.id).catch(console.error);
      }
    });
  };
}
