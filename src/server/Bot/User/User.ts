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
import { Vault } from "../../Web3/Vault";
import { config } from "dotenv";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import path from "path";
import { COLORS, VAULT_URL } from "../../constants";

import { UI } from "../UI";
import Keyv from "keyv";
import { Roles } from "../Roles";
import { Web3Vault } from "../../Web3/Web3Vault";
import { NFTs } from "./NFTs";
import Web3 from "web3";

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
  private socket: IoSocket;
  private eth: Web3["eth"];
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
    this.subscribe();
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
    if(this.socket) {
      this.socket.removeAllListeners("account")
    }
    if(this.eth) {
      this.eth.clearSubscriptions((error, result) => console.log({ clearSubscriptionsError: error, clearSubscriptions: result }));
    }
  }

  public startAccountListener = ({
    socket,
    channelId,
  }: {
    socket: IoSocket;
    channelId: string;
  }) => {
    const listener = ({
      account,
      userId,
    }: {
      account: string;
      userId: string;
    }) => {
      this?.handleAccountChange({ account, userId, channelId });
    };
    socket.once("account", listener);
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

  private handleAccountChange = async ({
    account,
    userId,
    channelId,
  }: {
    account: string;
    userId: string;
    channelId: string;
  }) => {
    if (userId !== this.userId) return;
    if (!account || account === this.address) return;

    this.address = account;
    this.usersDb.set(this.userId, { wallet: account });
    await Vault.setVaultContract({ address: account, chainId: 4 });

    const vaultContract = Vault.contract[account];
    this.vaultAddress = vaultContract?.options.address;

    if (vaultContract) {
      this.usersDb.set(this.userId, {
        wallet: account,
        vault: vaultContract.options.address,
      });
    }
    const balance = await Vault.getKiroBalance({
      address: this.address,
      vaultAddress: this.vaultAddress,
      chainId: 4,
    });

    const message = await this.getVaultMessage({ channelId });
    if(message) {
      this.sendMessage({ embeds: message.embeds, files: message.files, channelId })
    }
    await this.updateUserRoles({ totalBalance: balance.total });
  };

  public getVaultMessage = async ({ }: { channelId?: string }) => {
    const attachment = UI.getMessageImageAttachment({ imageName: "vault" });
    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });

    if (!this.address) return;
    const balance = await Vault.getKiroBalance({
      address: this.address,
      vaultAddress: this.vaultAddress,
      chainId: 4,
    });

    const userName = this.client.users.cache.get(this.userId)?.username;
    return this.getMessageToUserEmbeds({
      title: userName
        ? `${userName.charAt(0).toUpperCase() + userName.slice(1)} Vault`
        : "Vault",
      url: VAULT_URL,
      description: this.vaultAddress ? this.vaultAddress : "Vault not found =(",
      thumbnail: "attachment://vault.png",
      footer: { text: "Kirobo", iconURL: "attachment://kirogo.png" },
      files: [attachment, logoAttachment],
      fields: [
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

  private subscribe = () => {
    this.subscribeOnNewBlock({
      chainId: "4",
      callback: async (blockNumber) => {
        console.log({ blockNumber })
        if (!this.address) return;
        const balance = await Vault.getKiroBalance({
          address: this.address,
          vaultAddress: this.vaultAddress,
          chainId: 4,
        });
        this.updateUserRoles({ totalBalance: balance.total });
      },
    });
  };

  public subscribeOnNewBlock = ({
    chainId,
    callback,
  }: {
    chainId: "1" | "4";
    callback: (blockNumber: number) => void;
  }) => {
    const eth = Web3Vault.web3[chainId].eth
    this.eth = eth;
    this.eth
      .subscribe("newBlockHeaders")
      .on("data", (e) => {
        if (!e.number) return;
        callback(e.number);
      })
      .on("connected", async () => {})
      .on("error", (e) => console.log("subscribe error", e));

  
  };


  private updateUserRoles = async ({
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

    roles.forEach((role) => {
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