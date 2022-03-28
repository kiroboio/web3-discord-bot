export const BOT_NAME = "web3-kirobo-vault";
export const VAULT_URL = 'https://vault.kirobo.me';
export const MONGO_URL = "mongodb://localhost:27017/local";
export const DEFAULT_PORT = 3334;
export const COLORS = { primary: "#0095FF" } as const;
export const URL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:${DEFAULT_PORT}`
    : `http://localhost:${DEFAULT_PORT}`//`https://web3-discord-bot.herokuapp.com`;
export const URL_METAMASK =
  "https://metamask.app.link/dapp/web3-discord-bot.herokuapp.com";
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';