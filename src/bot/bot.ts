import { Client, Intents } from "discord.js";
import express from "express";
import { Server, Socket } from "socket.io";
import { Vault } from "../web3/Vault";
import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { Contract } from "web3-eth-contract";

config();

const app = express();
const DEFAULT_PORT = 3334;
const PORT = process.env.PORT || DEFAULT_PORT;
const URL =`http://localhost:${DEFAULT_PORT}/`
  // process.env.NODE_ENV === "development"
  //   ? `http://localhost:${DEFAULT_PORT}/`
  //   : `https://web3-discord-bot.herokuapp.com/`;
const INDEX = "/index.html";

const server = app
  .use((_req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const clientId = process.env.CLIENT_ID || "";
const guildId = process.env.GUILD_ID || "";

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

const io: IO = new Server(server);
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const rest = new REST({ version: "9" }).setToken(process.env.TOKEN || "");

class User {
  public client: Client<boolean>;
  public socket: IoSocket;
  public accountListener:
    | (({
      account,
      userId,
    }: {
      account: string;
      userId: string;
    }) => Promise<void>)
    | undefined;
  public channelId: string;
  public address: string | undefined;

  private userId: string;
  private vaultContract: Contract | undefined;
  private sendMessageToUser = ({ message }: { message: string }) => {
    this.client.users.cache.get(this.userId)?.send(message);
  };
  // private sendMessageInChannel = ({ message }: { message: string }) => {
  //   // @ts-expect-error: send exist
  //   this.client.channels.cache.get(this.channelId)?.send(message);
  // };
  constructor({
    client,
    userId,
    channelId,
  }: {
    client: Client<boolean>;

    userId: string;
    channelId: string;
  }) {
    //this.socket = socket;
    this.client = client;
    this.userId = userId;
    this.channelId = channelId;
  }

  public onNewAccount = async ({ account }: { account: string }) => {
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

  public onAccountChange = async ({
    account,
    userId,
  }: {
    account: string;
    userId: string;
  }) => {
    if (userId !== this.userId) return;
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

  public removeAccountListener = () => {
    if (!this.accountListener) return;

    this.socket.removeListener("account", this.accountListener);
    this.accountListener = undefined;
  };

  public getUserId = () => {
    return this.userId;
  };

  public getVaultContract = () => {
    return this.vaultContract;
  };

  public getAddress = () => {
    return this.address;
  };
}

class Bot {
  private client: Client<boolean>;
  private io: IO;
  private socket: IoSocket;
  private rest: REST;
  private users: { [key: string]: User | undefined } = {};
  constructor({
    client,
    io,
    rest,
  }: {
    client: Client<boolean>;
    io: IO;
    rest: REST;
  }) {
    this.client = client;
    this.io = io;
    this.rest = rest;
  }

  public setCommands = () => {
    const commands = [
      new SlashCommandBuilder()
        .setName("connect")
        .setDescription("Connect with metamask account"),
      new SlashCommandBuilder()
        .setName("disconnect")
        .setDescription("Disconnect metamask"),
      new SlashCommandBuilder()
        .setName("vault")
        .setDescription("Replies with vault address"),
    ].map((command) => command.toJSON());

    this.rest
      .put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
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
            interaction.reply("already connected");
            return;
          }

          this.createUser({
            userId: interaction.user.id,
            channelId: interaction.channelId,
          });
          interaction.reply({ content: URL, ephemeral: true });
        }
        if (interaction.commandName === "disconnect") {
          if (!this.users[interaction.user.id]) {
            interaction.reply("not connected");
            return;
          }

          this.users[interaction.user.id]?.removeAccountListener();

          delete this.users[interaction.user.id];
          interaction.reply({ content: "disconnected", ephemeral: true });
        }
      });
    });
    this.client.login(process.env.TOKEN);
  };

  public runSocket = ({ id }: { id: string }) => {
    const accountListener = (socket: IoSocket) => {
      this.socket = socket;
      this.socket.emit("userId", { userId: id });
      this.socket.on("account", ({ account, userId }) => {
        console.log({ account, userId, id })
        if(id !== userId) return;

        const user = this.users[userId]
        user?.onAccountChange({ account, userId })
      })
      //this.io.off("connection", accountListener)
    }
    // this.io.off("connection", accountListener)
    this.io.on("connection", accountListener);
  };

  public createUser = ({
    userId,
    channelId,
  }: {
    channelId: string;
    userId: string;
  }) => {
    const user = new User({
      client: this.client,
      channelId,
      userId,
    });
    this.users[userId] = user;
    this.runSocket({ id: userId });
  };
}

const bot = new Bot({ client, io, rest });
bot.setCommands();
bot.runClient();

export { bot };
