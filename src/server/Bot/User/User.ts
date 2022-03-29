import {
  Client,
  ColorResolvable,
  EmbedFieldData,
  EmbedFooterData,
  MessageAttachment,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import express from "express";
import { Socket } from "socket.io";
import { Vault } from "../../../Web3/Vault";
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
  private socket: IoSocket | null;

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
    channelId,
    chainId,
  }: {
    socket: IoSocket;
    channelId: string;
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
      this?.handleAccountChange({ account, userId, channelId, chainId });
      socket.emit("connectedAccount", account);
    };
    socket.on("account", listener);

    socket.on("disconnect", () => {
      this.socket = null;
    });

    socket.on(
      "transactionSendSuccess",
      ({ trxHash, channelId }: { trxHash: string; channelId: string }) => {
        console.log({ trxHash, chainId })
        const channel = this.client.channels.cache.get(channelId) as TextChannel

        const embed = UI.getMessageEmbedWith({ title:`:tada: Transaction sent successfully`, fields: [{ name: 'Hash', value: trxHash }] })
        channel?.send({ embeds: [embed] });
      }
    );

    socket.on(
      "transactionSendFailed",
      ({ error, channelId }: { error: string; channelId: string }) => {
        const channel = this.client.channels.cache.get(channelId) as TextChannel

        const embed = UI.getMessageEmbedWith({ title:`:face_with_symbols_over_mouth: Transaction failed`, fields: [{ name: 'Error', value: error }] })
        channel?.send({ embeds: [embed] });
      }
    );
  };

  public emitSendKiro = ({
    addressTo,
    chainId,
    amount,
    channelId,
  }: {
    chainId: string;
    amount: string;
    addressTo: string;
    channelId: string;
  }) => {
    if (!this.socket) return false;
    this.socket.emit("sendKiro", {
      addressTo,
      chainId,
      amount,
      channelId,
    });
    return true;
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
    channelId,
  }: {
    account: string;
    userId: string;
    chainId: 1 | 4;
    channelId?: string;
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
    if (message && channelId) {
      this.sendMessage({
        embeds: message.embeds,
        files: message.files,
        channelId,
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
