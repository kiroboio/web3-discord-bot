import {
  ColorResolvable,
  MessageEmbed,
  Presence,
  MessageActionRow,
  MessageButton,
  MessageButtonStyleResolvable,
  MessageAttachment,
  EmbedAuthorData,
  EmbedFooterData,
  EmbedFieldData,
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
    footer,
    fields
  }: {
    color?: ColorResolvable;
    title?: string;
    url?: string;
    description?: string;
    image?: string;
    thumbnail?: string;
    author?: EmbedAuthorData;
    footer?: EmbedFooterData;
    fields?: EmbedFieldData[];
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

    if(footer) {
      embed.setFooter(footer);
    }

    if(fields) {
      embed.addFields(fields)
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
    )
  };

  public static getButtonsRow = ({
    label,
    customId,
    style = "PRIMARY",
    secondLabel,
    secondCustomId,
    secondStyle = "SECONDARY",
  }: {
    label: string;
    customId: string;
    secondLabel: string;
    secondCustomId: string;
    style?: MessageButtonStyleResolvable;
    secondStyle?: MessageButtonStyleResolvable;
  }) => {
    return new MessageActionRow().addComponents(
      [new MessageButton().setCustomId(customId).setLabel(label).setStyle(style), new MessageButton().setCustomId(secondCustomId).setLabel(secondLabel).setStyle(secondStyle)]
    )
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

  public static getSendKiroUrl = ({
    addressTo,
    presence,
    chainId,
    amount,
  }: {
    presence: Presence | undefined;
    addressTo: string;
    chainId: string;
    amount: string;
  }) => {
    const desktopLink = `${URL}?addressTo=${addressTo}&chainId=${chainId}&amount=${amount}`;
    const mobileLink = `${URL_METAMASK}?addressTo=${addressTo}&chainId=${chainId}&amount=${amount}`;
    if (presence?.clientStatus?.mobile !== "online") {
      return desktopLink;
    }

    if (presence?.clientStatus?.mobile === "online") {
      return mobileLink;
    }

    return desktopLink;
  };


  public static getSendKiroReply = ({
    addressTo,
    presence,
    chainId,
    amount,
  }: {
    presence: Presence | undefined;
    addressTo: string;
    chainId: string;
    amount: string;
  }) => {
    const url = this.getSendKiroUrl({ addressTo, presence, chainId, amount });

    const embededLink = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Connect")
      .setURL(url)
      .setDescription(`Send Kiro Transaction`);

    return {
      embeds: [embededLink],
      ephemeral: true,
    };
  };
}
