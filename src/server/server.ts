import { Client, Intents } from "discord.js";
import express from "express";
import { Server } from "socket.io";

import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import path from "path";
import { Bot } from "./Bot";
import { DEFAULT_PORT } from "./constants";
import Keyv from "keyv";
config();

const mongoUrl = "mongodb://localhost:27017/local"

const keyvRoles = new Keyv(`${mongoUrl}`, { namespace: "roles"});
const keyvUsers = new Keyv(`${mongoUrl}`, { namespace: "users"});

keyvRoles.on('error', err => console.error('Keyv connection error:', err));
keyvUsers.on('error', err => console.error('Keyv connection error:', err));


const app = express();
app.use(express.static(path.join(__dirname, "../", "client/build")));
app.use('/images', express.static(path.join(__dirname, "../", "images")));

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
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_PRESENCES,  Intents.FLAGS.GUILD_MEMBERS],
});
const rest = new REST({ version: "9" }).setToken(process.env.TOKEN || "");

const bot = new Bot({ client, rest, io, rolesDb: keyvRoles, usersDb: keyvUsers });

client.on("ready", async() => {
  const guilds: string[] = client.guilds.cache.map((guild) => guild.id);
  await bot.setCommands({ guilds });
  bot.setGuildsBotChannel({ guilds })
  bot.permissions.setGuildsAdminCommandsPermissions({ guilds })
  
});

client.on("guildCreate", (guild) => {
  bot.setCommand(guild.id);
  bot.setGuildBotChannel({ guildId: guild.id })
});

client.on("roleCreate", (member) => {
  bot.permissions.setAdminCommandsPermissions({ guildId: member.guild.id })
})

client.on("roleDelete", (member) => {
  bot.permissions.setAdminCommandsPermissions({ guildId: member.guild.id })
})







bot.runClient();

export { bot };
