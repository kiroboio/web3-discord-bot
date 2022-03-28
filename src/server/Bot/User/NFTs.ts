import axios from "axios";
import { Client, ColorResolvable, MessageEmbed } from "discord.js";
import { COLORS, IPFS_GATEWAY, VAULT_URL } from "../../constants";
import stream from "stream";
import https from "https";
import fs from "fs";
import path from "path";


type NFT = {
  name: string;
  value: string;
};

export class NFTs {
  protected address: string | undefined;
  protected vaultAddress: string | undefined;
  protected client: Client<boolean>;
  protected userId: string;

  constructor({
    client,
    userId,
    address,
    vaultAddress,
  }: {
    client: Client<boolean>;
    userId: string;

    address?: string;
    vaultAddress?: string;
  }) {
    this.client = client;
    this.userId = userId;

    this.address = address;
    this.vaultAddress = vaultAddress;
  }

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
    const vaultAddress = this.vaultAddress;

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
    //if (!nfts.length) return nfts;
    // this.sendMessageToChannel({
    //   uris: nfts.map((nft) => nft.value),
    //   title: "test",
    // });
    return nfts;
  };

  // private sendMessageToChannel = ({
  //   color = COLORS.primary,
  //   uris,
  // }: {
  //   color?: ColorResolvable;
  //   title?: string;
  //   url?: string;
  //   description?: string;
  //   image?: string;
  //   thumbnail?: string;
  //   uris?: string[];
  // }) => {
  //   const embeds: MessageEmbed[] = [];
  //   const user = this.client.users.cache.get(this.userId);

  //   uris?.map((uri) => {
  //     embeds.push(UI.getMessageEmbedWith({ thumbnail: uri, color }));
  //   });

  //   user?.send({ embeds, options: {} });
  // };

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
}
