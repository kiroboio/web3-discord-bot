import { Client, Intents } from "discord.js";
import express from "express";
import { Server } from "socket.io";

import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import path from "path";
import { Bot } from "./Bot";
import { DEFAULT_PORT } from "./constants";

config();

const app = express();
app.use(express.static(path.join(__dirname, "../", "client/build")));

const PORT = process.env.PORT || DEFAULT_PORT;
const INDEX = "/index.html";

const server = app
  .get("/", (_req, res) => {
    res.sendFile(INDEX);
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;


const io: IO = new Server(server);
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_PRESENCES],
});
const rest = new REST({ version: "9" }).setToken(process.env.TOKEN || "");

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
