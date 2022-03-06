"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const express_1 = __importDefault(require("express"));
const discord_js_1 = __importDefault(require("discord.js"));
const socket_io_1 = require("socket.io");
const bot = new discord_js_1.default.Client();
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
const app = (0, express_1.default)();
//app.use(express.static("public"));
const DEFAULT_PORT = 3333;
const PORT = process.env.PORT || DEFAULT_PORT;
const INDEX = '/index.html';
const server = app
    .use((_req, res) => res.sendFile(INDEX, { root: __dirname }))
    .listen(PORT, () => console.log(`Listening on ${PORT}`));
const io = new socket_io_1.Server(server);
io.on("connection", (socket) => {
    socket.on("account", (msg) => {
        console.log(`message: ${msg}`);
    });
});
