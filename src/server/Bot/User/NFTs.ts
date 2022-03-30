import axios from "axios";
import { CacheType, Client, ColorResolvable, CommandInteraction, MessageAttachment, MessageEmbed } from "discord.js";
import { COLORS, IPFS_GATEWAY, VAULT_URL } from "../../constants";
import stream from "stream";
import https from "https";
import fs from "fs";
import path from "path";
import { UI } from "../UI";
import Canvas from "canvas";

export type NFT = {
  name: string;
  value: string;
  type: "base64" | "url";
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

    if(!res.result) return;
    const nfts: { wallet: NFT[], vault: NFT[] } = { wallet: [], vault: []}
    
    nfts.wallet = res.result.filter((nft: NFT) => !!nft)
    nfts.vault = res.result_vault.filter((nft: NFT) => !!nft)

    return nfts;
  };

  public getNftsEmbeds = async ({
    interaction,
    type,
    chainId
  }: {
    interaction: CommandInteraction<CacheType>;
    type: "Vault" | "Wallet";
    chainId: 1 | 4;
  }) => {
    // const user = this.users[interaction.user.id];
    // if (!user) {
    //   interaction.editReply({ content: "not connected" });
    // }

    //await interaction.deferReply();
    const nfts = await this?.getNfts({
      chain: chainId === 1 ? "eth" : "rinkeby",
    });

    if (!nfts || (!nfts.wallet.length && !nfts.vault.length)) {
      return;
    }

    const nftsEmbeds = await this.getNftsMessageEmbed({
      nfts: type === "Vault" ? nfts.vault : nfts.wallet,
      type,
      username: interaction.user.username,
    });

    return nftsEmbeds;
  };

  private getNftsMessageEmbed = async ({
    nfts,
    type,
  }: // username,
  {
    nfts: NFT[];
    type: "Wallet" | "Vault";
    username: string;
  }) => {
    const embeds: MessageEmbed[] = [];
    const attachments: MessageAttachment[] = [];

    const logoAttachment = UI.getMessageImageAttachment({
      imageName: "kirogo",
    });

    attachments.push(logoAttachment);
    const max = nfts.length < 4 ? nfts.length : 4;
    for (let i = 0; i < max; i++) {
      if (nfts[i].type === "base64") {
        const canvas = await this.getNftCanvas(nfts[i]);
        const nftFileName = nfts[i].name + i + type;
        const nftAttachment = new MessageAttachment(
          canvas.toBuffer(),
          `${nftFileName}.png`
        );
        attachments.push(nftAttachment);

        embeds.push(
          UI.getMessageEmbedWith({
            url: `https://vault.kirobo.me/overview`,
            image: `attachment://${nftFileName}.png`,
            footer: {
              text: "Kirobo Vault",
              iconURL: "attachment://kirogo.png",
            },
          })
        );
      } else {
        embeds.push(
          UI.getMessageEmbedWith({
            url: `https://vault.kirobo.me/overview`,
            image: nfts[i].value,
            footer: {
              text: "Kirobo Vault",
              iconURL: "attachment://kirogo.png",
            },
          })
        );
      }
    }

    return { embeds, attachments };
  };

  private getNftCanvas = async (nft: NFT) => {
    const nftImage = await Canvas.loadImage(nft.value);
    const nativeWidth = nftImage.width;
    const nativeHeight = nftImage.height;

    const canvas = Canvas.createCanvas(nativeWidth, nativeHeight);
    const context = canvas.getContext("2d");

    context.drawImage(nftImage, 0, 0, nativeWidth, nativeHeight);

    return canvas;
  };

  private transformNft = async (nft: any) => {
    if(!nft.token_uri) return;
    
    let token_uri: string | undefined;
    let type: string | undefined
    const nftUriArray = nft.token_uri.split(",");
    if (nftUriArray[0] === "data:application/json;base64") {
      token_uri = JSON.parse(atob(nftUriArray[nftUriArray.length - 1]))?.image;
      type = "base64"
    } else {
      token_uri = await this.tryGetImage({ url: nft.token_uri });
      type = "url";
    }

    if (!token_uri) return;
    return {
      name: nft.name.trim().split(" ").join("-").toLowerCase(),
      value: token_uri,
      type,
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
