import {
  Client,
  ColorResolvable,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import express from "express";
import { Socket } from "socket.io";
import { Vault } from "../Web3/Vault";
import { config } from "dotenv";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { Contract } from "web3-eth-contract";
import path from "path";
import { COLORS, URL, IPFS_GATEWAY, VAULT_URL } from "../constants";
import axios from "axios";
import stream from "stream";
import https from "https";
import fs from "fs";

config();

const app = express();
app.use(express.static(path.join(__dirname, "../../", "client/build")));

type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

export class User {
  public guildId: string;

  private channelId: string;
  private client: Client<boolean>;
  private sessionId: string;
  private address: string | undefined;
  private userId: string;
  private vaultContract: Contract | undefined;

  constructor({
    client,
    userId,
    channelId,
    sessionId,
    guildId,
  }: {
    client: Client<boolean>;
    userId: string;
    channelId: string;
    sessionId: string;
    guildId: string;
  }) {
    this.client = client;
    this.userId = userId;
    this.channelId = channelId;
    this.sessionId = sessionId;
    this.guildId = guildId;
  }

  public getUserId = () => {
    return this.userId;
  };

  public getVaultContract = () => {
    return this.vaultContract;
  };

  public getAddress = () => {
    return this.address;
  };

  public startAccountListener = ({ socket }: { socket: IoSocket }) => {
    if (this.sessionId !== socket.id) return;

    socket.on("account", ({ account, sessionId }) => {
      if (this.sessionId !== sessionId) return;
      this?.onAccountChange({ account, sessionId });
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
    const embed = new MessageEmbed().setColor(color);
    if (title) {
      embed.setTitle(title);
    }

    if (url) {
      embed.setURL(url);
    }

    if (description) {
      embed.setDescription(description);
    }

    if (image) {
      embed.setImage(image);
    }

    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    this.client.users.cache.get(this.userId)?.send({ embeds: [embed] });
  };


  private sendMessageToChannel = ({
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
    const embed = new MessageEmbed().setColor(color);
    if (title) {
      embed.setTitle(title);
    }

    if (url) {
      embed.setURL(url);
    }

    if (description) {
      embed.setDescription(description);
    }

    if (image) {
      embed.setImage(image);
    }

    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    const channel = this.client.channels.cache.get(this.channelId) as TextChannel
    channel.send({ embeds: [embed] });
  };

  

  public getNfts = async ({ chain }: { chain: "rinkeby" | "eth" }) => {
    const vaultAddress = this.vaultContract?.options?.address;
    const url = `${VAULT_URL}/api/nfts/${this.address}${
      vaultAddress ? `;${vaultAddress}` : ""
    }?chain=${chain}`;
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
              async (nft: any) => await this.transformNft(nft)
            ) || []
          ),
          result_vault: await Promise.all(
            response.data[1]?.nfts.map(
              async (nft: any) => await this.transformNft(nft)
            ) || []
          ),
        };
      })
      .catch((e) => {
        console.error({ error: e });
      });

    return res;
  };

  private transformNft = async (nft: any) => {
    const nftUriArray = nft.token_uri.split(",");
    let token_uri: string | undefined;
    if (nftUriArray[0] === "data:application/json;base64") {
      token_uri = JSON.parse(atob(nftUriArray[nftUriArray.length - 1]))?.image;
    } else {
      token_uri = await this.tryGetImage({ url: String(nft.token_uri) });
      if (token_uri)
        this.downloadImage({
          url: token_uri,
          name: nft.name,
        });
    }

    return {
      amount: String(nft.amount),
      block_number: String(nft.block_number),
      block_number_minted: String(nft.block_number_minted),
      contract_type: String(nft.contract_type),
      frozen: Number(nft.frozen),
      isValid: Number(nft.isValid),
      metadata: String(nft.metadata || "{}"),
      name: String(nft.name),
      owner_of: String(nft.owner_of),
      symbol: String(nft.symbol),
      synced_at: String(nft.synced_at),
      token_address: String(nft.token_address),
      token_id: String(nft.token_id),
      token_uri,
    };
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

  private downloadImage = async ({
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

          console.log({});
        });
      })
      .end();
  };

  public sendNftToChannel = ({ name }: { name: string}) => {

    this.sendMessageToChannel({
      title: "Your Vault",
      url: VAULT_URL,
      description: name,
      image: `${URL}/images/nfts/Twerky Bags.png`,
    });
    
  }

  private onAccountChange = async ({
    account,
    sessionId,
  }: {
    account: string;
    sessionId: string;
  }) => {
    if (this.sessionId !== sessionId) return;
    if (!account || account === this.address) return;

    this.address = account;
    await Vault.setVaultContract({ address: account, chainId: 4 });
    const vaultContract = Vault.contract[account];
    this.vaultContract = vaultContract;
    const vaultContractAddress = vaultContract
      ? vaultContract.options.address
      : "vault not found";

    this.sendMessageToUser({
      title: "Your Vault",
      url: VAULT_URL,
      description: vaultContractAddress,
      thumbnail: `${URL}/images/vault.png`,
    });
  };
}
