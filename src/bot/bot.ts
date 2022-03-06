import { Client, Intents } from "discord.js";
import express from "express";
import { Server } from "socket.io";
import { Vault } from "../web3/Vault";
import { config } from "dotenv";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";

config();

const app = express();
const DEFAULT_PORT = 3334;
const PORT = process.env.PORT || DEFAULT_PORT;
const INDEX = "/index.html";

const server = app
  .use((_req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const commands = [
  new SlashCommandBuilder()
    .setName("connect")
    .setDescription("Replies with vault address"),
].map((command) => command.toJSON());

const clientId = process.env.CLIENT_ID || "";
const guildId = process.env.GUILD_ID || "";

const io = new Server(server);

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const rest = new REST({ version: "9" }).setToken(process.env.TOKEN || "");
rest
  .put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
  .then(() => console.log("Successfully registered application commands."))
  .catch(console.error);

client.once("ready", (c) => {
  console.log(`Ready! pidor 3 Logged in as ${c.user.tag}`);
  client.on("interactionCreate", async (interaction: any) => {
    if (!interaction.isCommand()) return;
    console.log({ interaction });

    if (interaction.commandName === "connect") {
      //await interaction.deferReply();
      interaction.reply(`https://web3-discord-bot.herokuapp.com/`);
    }
  });
});

client.login(process.env.TOKEN);

io.on("connection", (socket) => {
  socket.on("account", async (address) => {
    console.log(`message t: ${address}`);
    if (!address) return;
    await Vault.setVaultContract({ address, chainId: 4 });
    const vaultContract = Vault.contract[address];
    // @ts-expect-error
    client.channels?.cache
      ?.get("691334057623027724")
      // @ts-expect-error
      .send(vaultContract ? vaultContract.options.address : "not found");
    // await interaction.followUp(
    //   vaultContract ? vaultContract.defaultAccount : "Vault wallet not found"
    // );
  });
});

export { client };
