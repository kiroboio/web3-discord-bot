import {
  Client,
  MessageEmbed,
  Presence,
} from "discord.js";
import { Server, Socket } from "socket.io";
import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import crypto from "crypto";
import { User } from "../User";
import { DEFAULT_PORT } from "../constants";

config();

const URL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:${DEFAULT_PORT}`
    : `https://web3-discord-bot.herokuapp.com`;
const URL_METAMASK =
  "https://metamask.app.link/dapp/web3-discord-bot.herokuapp.com";

const clientId = process.env.CLIENT_ID || "";

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

export class Bot {
  private client: Client<boolean>;
  private io: IO;
  private rest: REST;
  private users: { [key: string]: User | undefined } = {};
  constructor({
    client,
    rest,
    io,
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
        if (interaction.commandName === "connect") {
          if (this.users[interaction.user.id]) {
            interaction.reply({ content: "already connected", ephemeral: true});
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
  }: {
    channelId: string;
    userId: string;
    token: { token: string };
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
