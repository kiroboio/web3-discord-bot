import { ColorResolvable, MessageEmbed, Presence } from "discord.js";
import { COLORS, URL, URL_METAMASK } from "../constants";

export class UI {
  public static getMessageEmbedWith = ({
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

    return embed;
  };
  public static getConnectReply = ({
    token,
    presence,
  }: {
    presence: Presence | undefined;
    token: string;
  }) => {
    const desktopLink = `${URL}?token=${token}`;
    const mobileLink = `${URL_METAMASK}?token=${token}`;

    const embedDesktopLink = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Connect")
      .setURL(desktopLink)
      .setDescription(`Connect to metamask account`);

    const embedMobileLink = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Connect")
      .setURL(mobileLink)
      .setDescription(`Connect to metamask account in metamask browser`);

    if (presence?.clientStatus?.mobile !== "online") {
      return {
        embeds: [embedDesktopLink],
        ephemeral: true,
      };
    } else if (
      presence?.clientStatus?.desktop !== "online" &&
      presence?.clientStatus?.web !== "online"
    ) {
      return {
        embeds: [embedMobileLink],
        ephemeral: true,
      };
    } else {
      return {
        embeds: [embedDesktopLink, embedMobileLink],
        ephemeral: true,
      };
    }
  };
}
