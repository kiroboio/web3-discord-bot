import { CacheType, Client, CommandInteraction, Intents } from "discord.js";
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
const URL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:${DEFAULT_PORT}/`
    : `https://web3-discord-bot.herokuapp.com/`;
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
  private userId: string;
  //private interaction: CommandInteraction<CacheType>;

  private address: string | undefined;
  private vaultContract: Contract | undefined;

  constructor({
    socket,
    client,
    userId,
    interaction,
  }: {
    client: Client<boolean>;
    socket: IoSocket;
    userId: string;
    interaction: CommandInteraction<CacheType>;
  }) {
    this.socket = socket;
    this.client = client;
    this.userId = userId;

    const accountListener = async (address: string) => {
      console.log(`account ${address}`);
      if (!address) return;
      this.address;
      await Vault.setVaultContract({ address, chainId: 4 });
      const vaultContract = Vault.contract[address];
      this.vaultContract = vaultContract;
      const vaultContractAddress = vaultContract
        ? vaultContract.options.address
        : "vault not found";

      if (interaction.user.id !== this.userId) return;
      interaction.followUp(vaultContractAddress);
      this.runClient();
    };

    this.socket.on("account", ({ account, userId }) => {
      console.log({ serverUserId: userId, serverUserAccount: account })
      if(userId !== this.userId) return;

      accountListener(account);
    });
  }

  public runClient = () => {
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isCommand()) return;
      if (
        interaction.commandName === "vault" &&
        interaction.user.id === this.userId
      ) {
        interaction.reply(
          this.vaultContract?.options.address || "Vault not found"
        );
      }
    });
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
  private rest: REST;
  private users: { [key: string]: User } = {};
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
          this.runSocket({ userId: interaction.user.id, interaction });
          interaction.reply(URL);
        }
      });
    });
    this.client.login(process.env.TOKEN);
  };

  public runSocket = ({
    userId,
    interaction,
  }: {
    userId: string;
    interaction: CommandInteraction<CacheType>;
  }) => {
    this.io.on("connection", (socket) => {
      const user = new User({
        client: this.client,
        socket,
        userId,
        interaction,
      });
      this.users[userId] = user;

      console.log({ users: this.users });
      socket.emit("userId", { userId });
    });
  };
}

const bot = new Bot({ client, io, rest });
bot.setCommands();
bot.runClient();

export { bot };
