"use strict";
exports.__esModule = true;
require('dotenv').config();
var express_1 = require("express");
var discord_js_1 = require("discord.js");
var socket_io_1 = require("socket.io");
var bot = new discord_js_1["default"].Client();
bot.on("message", function (ctx) {
    console.log({ ctx: ctx });
    if (ctx.content === "ciao") {
        ctx.reply(ctx.content);
    }
    if (ctx.content === "/start") {
        ctx.reply("https://web3-discord-bot.herokuapp.com/");
    }
});
bot.login("OTQ4NTc0OTUzMDUyMTg0NjQ2.Yh9zRA.fl8D5fRSvR6c74j-Aox2J3PlHzI");
var app = (0, express_1["default"])();
//app.use(express.static("public"));
var DEFAULT_PORT = 3333;
var PORT = process.env.PORT || DEFAULT_PORT;
var INDEX = '/index.html';
var server = app
    .use(function (_req, res) { return res.sendFile(INDEX, { root: __dirname }); })
    .listen(PORT, function () { return console.log("Listening on ".concat(PORT)); });
var io = new socket_io_1.Server(server);
io.on("connection", function (socket) {
    socket.on("account", function (msg) {
        console.log("message: ".concat(msg));
    });
});
