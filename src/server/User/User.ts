import { Client } from "discord.js";
import express from "express";
import { Socket } from "socket.io";
import { Vault } from "../Web3/Vault";
import { config } from "dotenv";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { Contract } from "web3-eth-contract";
import path from "path";

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

  private sendMessageToUser = ({ message }: { message: string }) => {
    this.client.users.cache.get(this.userId)?.send(message);
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
    this.sendMessageToUser({ message: vaultContractAddress });
  };
}
