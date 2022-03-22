import {
  ColorResolvable,
  MessageEmbed,
  Presence,
  MessageActionRow,
  MessageButton,
  MessageButtonStyleResolvable,
  MessageAttachment,
  EmbedAuthorData,
} from "discord.js";
import path from "path";
import { COLORS, URL, URL_METAMASK } from "../constants";

export class UI {
  public static getMessageEmbedWith = ({
    color = COLORS.primary,
    title,
    url,
    description,
    image,
    thumbnail,
    author,
  }: {
    color?: ColorResolvable;
    title?: string;
    url?: string;
    description?: string;
    image?: string;
    thumbnail?: string;
    author?: EmbedAuthorData;
  }) => {
    const embed = new MessageEmbed().setColor(color);
    if (title) {
      embed.setTitle(title);
    }

    if (url) {
      embed.setURL(url);
    }

    if (author) {
      embed.setAuthor(author);
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

  public static getButton = ({
    label,
    customId,
    style = "PRIMARY",
  }: {
    label: string;
    customId: string;
    style?: MessageButtonStyleResolvable;
  }) => {
    return new MessageActionRow().addComponents(
      new MessageButton().setCustomId(customId).setLabel(label).setStyle(style)
    );
  };

  public static getMessageImageAttachment = ({
    imageName,
  }: {
    imageName: string;
  }) => {
    const pathToImages = path.join(__dirname, "../../", "images");
    const attachment = new MessageAttachment(
      `${pathToImages}/${imageName}.png`,
      `${imageName}.png`
    );

    return attachment;
  };

  public static getConnectUrl = ({
    token,
    presence,
    userId,
  }: {
    presence: Presence | undefined;
    token: string;
    userId: string;
  }) => {
    const desktopLink = `${URL}?token=${token}&userId=${userId}`;
    const mobileLink = `${URL_METAMASK}?token=${token}$userId=${userId}`;
    if (presence?.clientStatus?.mobile !== "online") {
      return desktopLink;
    }

    if (presence?.clientStatus?.mobile === "online") {
      return mobileLink;
    }

    return desktopLink;
  };

  public static getConnectReply = ({
    token,
    presence,
    userId,
  }: {
    presence: Presence | undefined;
    token: string;
    userId: string;
  }) => {
    const url = this.getConnectUrl({ token, presence, userId });

    const embededLink = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Connect")
      .setURL(url)
      .setDescription(`Connect to metamask account`);

    return {
      embeds: [embededLink],
      ephemeral: true,
    };
  };
}
