import { Client, ColorResolvable, MessageEmbed } from "discord.js";
import express from "express";
import { Socket } from "socket.io";
import { Vault } from "../../Web3/Vault";
import { config } from "dotenv";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import path from "path";
import { COLORS, URL, IPFS_GATEWAY, VAULT_URL } from "../../constants";
import axios from "axios";
import stream from "stream";
import https from "https";
import fs from "fs";
import { UI } from "../UI";
import Keyv from "keyv";

config();

const lol1RoleId = "953629558685458462";
const lol2RoleId = "953629686506860587";
const lol3RoleId = "953629734418415616";

const app = express();
app.use(express.static(path.join(__dirname, "../../", "client/build")));

type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

type NFT = {
  name: string;
  value: string;
};
export class User {
  private guildId: string;
  private client: Client<boolean>;
  private address: string | undefined;
  private userId: string;
  private vaultAddress: string | undefined;
  private usersDb: Keyv;

  constructor({
    client,
    userId,
    guildId,
    usersDb,
    address,
    vaultAddress,
  }: {
    client: Client<boolean>;
    userId: string;
    guildId: string;
    usersDb: Keyv;
    address?: string;
    vaultAddress?: string
  }) {
    this.client = client;
    this.userId = userId;
    this.guildId = guildId;
    this.usersDb = usersDb;
    this.address = address
    this.vaultAddress = vaultAddress
  }

  public getUserId = () => {
    return this.userId;
  };

  public getVaultAddress = () => {
    return this.vaultAddress;
  };

  public getAddress = () => {
    return this.address;
  };

  public startAccountListener = ({ socket }: { socket: IoSocket }) => {
    socket.on("account", ({ account, userId }) => {
      this?.onAccountChange({ account, userId });
    });
  };

  private sendMessageToUser = ({
    color = COLORS.primary,
    title,
    url,
    description,
    image,
    thumbnail,
  }: {
    color?: ColorResolvable;
    title?: string;
    url?: string;
    description?: string;
    image?: string;
    thumbnail?: string;
  }) => {
    const embed = UI.getMessageEmbedWith({
      color,
      title,
      url,
      description,
      image,
      thumbnail,
    });

    this.client.users.cache.get(this.userId)?.send({ embeds: [embed] });
  };

  private sendMessageToChannel = ({
    color = COLORS.primary,
    uris,
  }: {
    color?: ColorResolvable;
    title?: string;
    url?: string;
    description?: string;
    image?: string;
    thumbnail?: string;
    uris?: string[];
  }) => {
    const embeds: MessageEmbed[] = [];
    const user = this.client.users.cache.get(this.userId);

    uris?.map((uri) => {
      embeds.push(UI.getMessageEmbedWith({ thumbnail: uri, color }));
    });

    user?.send({ embeds, options: {} });
  };

  public getNftMessage = ({
    uri,
    color = COLORS.primary,
  }: {
    uri: string;
    color?: ColorResolvable;
  }) => {
    const embed = new MessageEmbed().setColor(color);
    embed.setImage(uri);

    return embed;
  };

  public getNfts = async ({ chain }: { chain: "rinkeby" | "eth" }) => {
    const vaultAddress = this.vaultAddress

    const url = `${VAULT_URL}/api/nfts/${this.address}${
      vaultAddress ? `;${vaultAddress}` : ""
    }?chain=${chain}`;
    console.log({ address: this.address, vaultAddress });
    const res = await axios
      .get(url, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,PATCH,OPTIONS",
        },
      })
      .then(async (response) => {
        return {
          ...response.data,
          result: await Promise.all(
            response.data[0]?.nfts.map(
              async (nft: any) => (await this.transformNft(nft)) as NFT
            ) || []
          ),
          result_vault: await Promise.all(
            response.data[1]?.nfts.map(
              async (nft: any) => (await this.transformNft(nft)) as NFT
            ) || []
          ),
        };
      })
      .catch((e) => {
        console.error({ error: e });
      });

    const nfts: NFT[] = res.result
      .filter((nft: NFT) => !!nft)
      .concat(res.result_vault.filter((nft: NFT) => !!nft));
    if (!nfts.length) return nfts;
    this.sendMessageToChannel({
      uris: nfts.map((nft) => nft.value),
      title: "test",
    });
    return nfts;
  };

  private transformNft = async (nft: any) => {
    let token_uri: string | undefined;
    token_uri = await this.tryGetImage({ url: String(nft.token_uri) });
    if (token_uri) {
      return {
        name: nft.name.trim().split(" ").join("-").toLowerCase(),
        value: token_uri,
      };
    }

    return undefined;
  };

  private ipfsToHttps = (uri: string) => {
    const ipfsPos = uri.search("/ipfs/");
    if (ipfsPos > 0) {
      return `${IPFS_GATEWAY}${uri.slice(ipfsPos + 6)}`;
    }
    if (uri.startsWith("ipfs://")) {
      return `${IPFS_GATEWAY}${uri.replace(`ipfs://`, "")}`;
    }
    if (uri.startsWith("ipfs:/")) {
      return `${IPFS_GATEWAY}${uri.replace(`ipfs:/`, "")}`;
    }
    return uri;
  };

  private tryGetImage = async ({ url }: { url: string }) => {
    return axios
      .get(`${VAULT_URL}/api/nft/image/url?url=${this.ipfsToHttps(url)}`, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      })
      .then((response) => {
        const image = response.data.image;
        if (image) {
          return this.ipfsToHttps(image);
        }
        return undefined;
      })
      .catch(() => {
        return undefined;
      });
  };

  public downloadImage = async ({
    url,
    name,
  }: {
    url: string;
    name: string;
  }) => {
    https
      .request(url, (response) => {
        const data = new stream.Transform();
        response.on("data", (chunk) => {
          data.push(chunk);
        });

        response.on("end", async () => {
          fs.writeFileSync(
            path.join(__dirname, "../../", `images/nfts/${name}.png`),
            data.read()
          );
        });
      })
      .end();
  };

  private onAccountChange = async ({
    account,
    userId
  }: {
    account: string;
    userId: string
  }) => {
    if(userId !== this.userId) return
    if (!account || account === this.address) return;

    this.address = account;
    this.usersDb.set(this.userId, { wallet: account });
    await Vault.setVaultContract({ address: account, chainId: 4 });

    const vaultContract = Vault.contract[account];
    this.vaultAddress = vaultContract?.options.address
    const vaultContractAddress = vaultContract
      ? vaultContract.options.address
      : "vault not found";

    if (vaultContract) {
      this.usersDb.set(this.userId, {
        wallet: account,
        vault: vaultContract.options.address,
      });
    }
    this.sendMessageToUser({
      title: "Your Vault",
      url: VAULT_URL,
      description: vaultContractAddress,
      thumbnail: `${URL}/images/vault.png`,
    });

    const balance = await Vault.getKiroBalance({
      address: account,
      chainId: 4,
    });

    const balanceNumber = parseFloat(balance);
    const guild = this.client.guilds.cache.get(this.guildId);
    if (!guild) return;

    const user = guild.members.cache.get(this.userId);
    if (!user) return;

    const loser = guild.roles.cache.get(lol1RoleId);
    const poor = guild.roles.cache.get(lol2RoleId);
    const rich = guild.roles.cache.get(lol3RoleId);

    if (balanceNumber >= 0 && balanceNumber < 100 && loser) {
      user.roles.add(loser).catch(console.error);
    }
    if (balanceNumber >= 100 && balanceNumber < 200 && poor) {
      user.roles.add(poor).catch(console.error);
    }
    if (balanceNumber >= 200 && rich) {
      user.roles.add(rich).catch(console.error);
    }
  };
}
