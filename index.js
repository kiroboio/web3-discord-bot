const express =  require("express");
const http =  require("http");
const { Server } =  require("socket.io");
const Discord =  require("discord.js");

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

bot.login("OTQ4NTc0OTUzMDUyMTg0NjQ2.Yh9zRA.fl8D5fRSvR6c74j-Aox2J3PlHzI");

const app = express();
const server = http.createServer(app);


app.use(express.static("public"));

const io = new Server(server);
const DEFAULT_PORT = 3333;

app.get("/", (_req, res) => {
	console.log("get /")
	res.sendFile("front.html", { root: __dirname });
});

io.on("connection", (socket) => {
	socket.on("account", (msg) => {
		console.log(`message: ${msg}`);
	});
});

server.listen({ port: DEFAULT_PORT}, () => {
	console.log(`listening on *:${DEFAULT_PORT}`);
});
