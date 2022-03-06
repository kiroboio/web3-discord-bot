import express from "express";
import { Server } from "socket.io";
import { bot } from "../bot"
import { Vault } from "../web3/Vault";
import { config } from "dotenv";
config();

bot.login(process.env.BOT_TOKEN);

const app = express();
const DEFAULT_PORT = 3333;
const PORT = process.env.PORT || DEFAULT_PORT;
const INDEX = "/index.html";

const server = app
  .use((_req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = new Server(server);
io.on("connection", (socket) => {
  socket.on("account", async(address) => {
    console.log(`message t: ${address}`);
    if(!address) return
    await Vault.setVaultContract({ address, chainId: 4 })
    console.log({ contract: Vault.contract })
  });
});
