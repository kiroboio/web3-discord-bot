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
app.use("/images", express.static(path.join(__dirname, "../", "images")));

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
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
  ],
});

const rest = new REST({ version: "9" }).setToken(process.env.TOKEN || "");

const bot = new Bot({
  client,
  rest,
  io,

});

client.on("ready", async () => {
  const guilds: string[] = client.guilds.cache.map((guild) => guild.id);

  bot.setGuilds({ guilds })
  await bot.setCommands({ guilds });
  await bot.setConnectedUsers({ guilds });
  // await bot.handleChainChange();
  bot.setGuildsBotChannel({ guilds });
  bot.permissions.setGuildsAdminCommandsPermissions({ guilds });
  guilds.forEach((guildId) => bot.subscribeUsers({ guildId }) )
});

client.on("guildCreate", (guild) => {
  console.log({ guildCreate: "guildCreated", guild: guild.id });
  bot.setGuild(guild.id)
  bot.setCommand(guild.id);
  bot.setGuildBotChannel({ guildId: guild.id });
  bot.permissions.setAdminCommandsPermissions({ guildId: guild.id })
  bot.subscribeUsers({ guildId: guild.id })
});

client.on("guildDelete", (guild) => {
  console.log("guildDeleted", { guild: guild.id })
  bot.deleteGuild(guild.id)
})

client.on("roleCreate", (role) => {
  bot.permissions.setAdminCommandsPermissions({ guildId: role.guild.id })
})

client.on("roleDelete", (role) => {
  bot.permissions.setAdminCommandsPermissions({ guildId: role.guild.id })
  bot.guilds[role.guild.id]?.rolesDb.delete(role.name)
})

bot.runClient();

export { bot };
