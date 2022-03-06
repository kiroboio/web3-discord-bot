require('dotenv').config()
import express from "express";
import Discord from "discord.js";
import { Server } from "socket.io";

const bot = new Discord.Client();

bot.on("message", (ctx) => {
  console.log({ ctx });
  if (ctx.content === "ciao") {
    ctx.reply(ctx.content);
  }

  if (ctx.content === "/start") {
    ctx.reply(`https://web3-discord-bot.herokuapp.com/`);
  }
});

bot.login(process.env.BOT_TOKEN);

const app = express();


//app.use(express.static("public"));


const DEFAULT_PORT = 3333;
const PORT = process.env.PORT || DEFAULT_PORT;
const INDEX = '/index.html';

const server = app
  .use((_req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = new Server(server);
io.on("connection", (socket) => {
  socket.on("account", (msg) => {
    console.log(`message: ${msg}`);
  });
});
