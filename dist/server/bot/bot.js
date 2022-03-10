"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const discord_js_1 = require("discord.js");
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const Vault_1 = require("../web3/Vault");
const dotenv_1 = require("dotenv");
const rest_1 = require("@discordjs/rest");
const v9_1 = require("discord-api-types/v9");
const builders_1 = require("@discordjs/builders");
const path_1 = __importDefault(require("path"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
app.use(express_1.default.static(path_1.default.join(__dirname, "../../", "client/build")));
const DEFAULT_PORT = 3334;
const PORT = process.env.PORT || DEFAULT_PORT;
const URL = process.env.NODE_ENV === "development"
    ? `http://localhost:${DEFAULT_PORT}/`
    : `https://web3-discord-bot.herokuapp.com/`;
const INDEX = "/index.html";
const server = app
    .use((_req, res) => {
    res.sendFile(INDEX);
})
    .listen(PORT, () => console.log(`Listening on ${PORT}`));
const clientId = process.env.CLIENT_ID || "";
const guildId = process.env.GUILD_ID || "";
const io = new socket_io_1.Server(server);
const client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS] });
const rest = new rest_1.REST({ version: "9" }).setToken(process.env.TOKEN || "");
class User {
    constructor({ client, userId, channelId, sessionId, }) {
        this.sendMessageToUser = ({ message }) => {
            var _a;
            (_a = this.client.users.cache.get(this.userId)) === null || _a === void 0 ? void 0 : _a.send(message);
        };
        this.onAccountChange = ({ account, sessionId, }) => __awaiter(this, void 0, void 0, function* () {
            if (this.sessionId !== sessionId)
                return;
            if (!account || account === this.address)
                return;
            this.address = account;
            yield Vault_1.Vault.setVaultContract({ address: account, chainId: 4 });
            const vaultContract = Vault_1.Vault.contract[account];
            this.vaultContract = vaultContract;
            const vaultContractAddress = vaultContract
                ? vaultContract.options.address
                : "vault not found";
            this.sendMessageToUser({ message: vaultContractAddress });
        });
        this.getUserId = () => {
            return this.userId;
        };
        this.getVaultContract = () => {
            return this.vaultContract;
        };
        this.getAddress = () => {
            return this.address;
        };
        this.accountListener = ({ socket }) => {
            if (this.sessionId !== socket.id)
                return;
            socket.on("account", ({ account, sessionId }) => {
                if (this.sessionId !== sessionId)
                    return;
                this === null || this === void 0 ? void 0 : this.onAccountChange({ account, sessionId });
            });
        };
        this.client = client;
        this.userId = userId;
        this.channelId = channelId;
        this.sessionId = sessionId;
    }
}
class Bot {
    constructor({ client, rest, }) {
        this.users = {};
        this.setCommands = () => {
            const commands = [
                new builders_1.SlashCommandBuilder()
                    .setName("connect")
                    .setDescription("Connect with metamask account"),
                new builders_1.SlashCommandBuilder()
                    .setName("disconnect")
                    .setDescription("Disconnect metamask"),
                new builders_1.SlashCommandBuilder()
                    .setName("vault")
                    .setDescription("Replies with vault address"),
            ].map((command) => command.toJSON());
            this.rest
                .put(v9_1.Routes.applicationGuildCommands(clientId, guildId), {
                body: commands,
            })
                .then(() => console.log("Successfully registered application commands."))
                .catch(console.error);
        };
        this.runClient = () => {
            this.client.once("ready", () => {
                this.client.on("interactionCreate", (interaction) => __awaiter(this, void 0, void 0, function* () {
                    if (!interaction.isCommand())
                        return;
                    if (interaction.commandName === "connect") {
                        if (this.users[interaction.user.id]) {
                            interaction.reply("already connected");
                            return;
                        }
                        this.createUser({
                            userId: interaction.user.id,
                            channelId: interaction.channelId,
                        });
                        interaction.reply({
                            content: `web: ${URL} metamask: ${`https://metamask.app.link/dapp/web3-discord-bot.herokuapp.com`}`,
                            ephemeral: true,
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
                }));
            });
            this.client.login(process.env.TOKEN);
        };
        this.createUser = ({ userId, channelId, }) => {
            this.io.removeAllListeners("connection");
            const connectListener = (socket) => {
                var _a;
                if (this.users[userId])
                    return;
                const user = new User({
                    client: this.client,
                    channelId,
                    userId,
                    sessionId: socket.id,
                });
                this.users[userId] = user;
                (_a = this.users[userId]) === null || _a === void 0 ? void 0 : _a.accountListener({ socket });
            };
            this.io.on("connection", connectListener);
        };
        this.client = client;
        this.rest = rest;
        this.io = io;
    }
}
const bot = new Bot({ client, rest, io });
exports.bot = bot;
bot.setCommands();
bot.runClient();
