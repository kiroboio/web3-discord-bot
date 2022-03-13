import {
  CacheType,
  Client,
  CommandInteraction,
  Intents,
  MessageEmbed,
} from "discord.js";
import express from "express";
import { Server, Socket } from "socket.io";
import { Vault } from "../web3/Vault";
import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { Contract } from "web3-eth-contract";
import path from "path";
import crypto from "crypto";

config();

const app = express();
app.use(express.static(path.join(__dirname, "../../", "client/build")));

const DEFAULT_PORT = 3334;
const PORT = process.env.PORT || DEFAULT_PORT;
const URL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:${DEFAULT_PORT}`
    : `https://web3-discord-bot.herokuapp.com`;
const URL_METAMASK =
  "https://metamask.app.link/dapp/web3-discord-bot.herokuapp.com";
const INDEX = "/index.html";

const server = app
  .get("/", (_req, res) => {
    res.sendFile(INDEX);
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const clientId = process.env.CLIENT_ID || "";

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

const io: IO = new Server(server);
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_PRESENCES],
});
const rest = new REST({ version: "9" }).setToken(process.env.TOKEN || "");

class User {
  public client: Client<boolean>;
  public sessionId: string;
  public channelId: string;
  public address: string | undefined;

  private userId: string;
  private vaultContract: Contract | undefined;
  private sendMessageToUser = ({ message }: { message: string }) => {
    this.client.users.cache.get(this.userId)?.send(message);
  };

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

  public onAccountChange = async ({
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

  public getUserId = () => {
    return this.userId;
  };

  public getVaultContract = () => {
    return this.vaultContract;
  };

  public getAddress = () => {
    return this.address;
  };

  public accountListener = ({ socket }: { socket: IoSocket }) => {
    if (this.sessionId !== socket.id) return;

    socket.on("account", ({ account, sessionId }) => {
      if (this.sessionId !== sessionId) return;
      this?.onAccountChange({ account, sessionId });
    });
  };
}

class Bot {
  private client: Client<boolean>;
  private io: IO;
  private rest: REST;
  private users: { [key: string]: User | undefined } = {};
  constructor({
    client,
    rest,
  }: {
    client: Client<boolean>;
    rest: REST;
    io: IO;
  }) {
    this.client = client;
    this.rest = rest;
    this.io = io;
  }

  public setCommands = ({ guilds }: { guilds: string[] }) => {
    guilds.map(this.setCommand);
  };

  public setCommand = (guildId: string) => {
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
        // console.log({ interaction }, interaction.user)
        if (interaction.commandName === "connect") {
          if (this.users[interaction.user.id]) {
            interaction.reply("already connected");
            return;
          }

          const that = this;
          crypto.randomBytes(48, async (_err, buffer) => {
            const token = buffer.toString("hex");

            const guild = that.client.guilds.cache.get(
              interaction?.guild?.id || ""
            );
            const user = guild?.members.cache.get(interaction.user.id);
            const presence = user?.guild.presences.cache.get(
              interaction.user.id
            );

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
              .setDescription(
                `Connect to metamask account in metamask browser`
              );

            if (presence?.clientStatus?.mobile !== "online") {
              interaction.reply({
                embeds: [embedDesktopLink],
                ephemeral: true,
              });
            } else if (
              presence?.clientStatus?.desktop !== "online" &&
              presence?.clientStatus?.web !== "online"
            ) {
              interaction.reply({
                embeds: [embedMobileLink],
                ephemeral: true,
              });
            } else {
              interaction.reply({
                embeds: [embedDesktopLink, embedMobileLink],
                ephemeral: true,
              });
            }

            that.createUser({
              userId: interaction.user.id,
              channelId: interaction.channelId,
              token: { token },
              interaction,
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
      });
    });
    this.client.login(process.env.TOKEN);
  };

  public createUser = ({
    userId,
    channelId,
    token,
    interaction,
  }: {
    channelId: string;
    userId: string;
    token: { token: string };
    interaction: CommandInteraction<CacheType>;
  }) => {
    const connectListener = (socket: IoSocket) => {
      if (token.token === "") {
        interaction.editReply({
          content: "Your token has expired try to '/connect' again",
        });
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
      });

      this.users[userId] = user;
      this.users[userId]?.accountListener({ socket });
    };
    setTimeout(() => {
      token.token = "";
    }, 60000);
    this.io.on("connection", connectListener);
  };
}

const bot = new Bot({ client, rest, io });

client.on("ready", () => {
  const guilds: string[] = client.guilds.cache.map((guild) => guild.id);
  bot.setCommands({ guilds });
});

client.on("guildCreate", (guild) => {
  bot.setCommand(guild.id);
});

bot.runClient();

export { bot };
