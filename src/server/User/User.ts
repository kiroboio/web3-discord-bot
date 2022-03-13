import { Client, ColorResolvable, MessageEmbed } from "discord.js";
import express from "express";
import { Socket } from "socket.io";
import { Vault } from "../Web3/Vault";
import { config } from "dotenv";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { Contract } from "web3-eth-contract";
import path from "path";
import { COLORS, URL } from "../constants";

config();

const app = express();
app.use(express.static(path.join(__dirname, "../../", "client/build")));

type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

export class User {
  public channelId: string;

  private client: Client<boolean>;
  private sessionId: string;
  private address: string | undefined;
  private userId: string;
  private vaultContract: Contract | undefined;

  constructor({
    client,
    userId,
    channelId,
    sessionId,
  }: {
    client: Client<boolean>;
    userId: string;
    channelId: string;
    sessionId: string;
  }) {
    this.client = client;
    this.userId = userId;
    this.channelId = channelId;
    this.sessionId = sessionId;
  }

  public getUserId = () => {
    return this.userId;
  };

  public getVaultContract = () => {
    return this.vaultContract;
  };

  public getAddress = () => {
    return this.address;
  };

  public startAccountListener = ({ socket }: { socket: IoSocket }) => {
    if (this.sessionId !== socket.id) return;

    socket.on("account", ({ account, sessionId }) => {
      if (this.sessionId !== sessionId) return;
      this?.onAccountChange({ account, sessionId });
    });
  };

  private sendMessageToUser = ({
    color = COLORS.primary,
    title,
    url,
    description,
    image,
    thumbnail,
  }: {
    color?: ColorResolvable;
    title?: string;
    url?: string;
    description?: string;
    image?: string;
    thumbnail?: string;
  }) => {
    const embed = new MessageEmbed().setColor(color);
    if (title) {
      embed.setTitle(title);
    }

    if (url) {
      embed.setURL(url);
    }

    if (description) {
      embed.setDescription(description);
    }

    if (image) {
      console.log({ image });
      embed.setImage(image);
    }

    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    this.client.users.cache.get(this.userId)?.send({ embeds: [embed] });
  };

  private onAccountChange = async ({
    account,
    sessionId,
  }: {
    account: string;
    sessionId: string;
  }) => {
    if (this.sessionId !== sessionId) return;
    if (!account || account === this.address) return;

    this.address = account;
    await Vault.setVaultContract({ address: account, chainId: 4 });
    const vaultContract = Vault.contract[account];
    this.vaultContract = vaultContract;
    const vaultContractAddress = vaultContract
      ? vaultContract.options.address
      : "vault not found";

    this.sendMessageToUser({
      title: "Your Vault",
      url: "https://vault.kirobo.me",
      description: vaultContractAddress,
      thumbnail: `${URL}/images/vault.png`,
    });
  };
}
