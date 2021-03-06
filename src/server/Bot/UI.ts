import {
  ColorResolvable,
  MessageEmbed,
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
    fields,
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

    if (footer) {
      embed.setFooter(footer);
    }

    if (fields) {
      embed.addFields(fields);
    }

    return embed;
  };

  public static getButtonsWithId = (
    params: {
      label: string;
      customId: string;
      style?: MessageButtonStyleResolvable;
    }[]
  ) => {
    return new MessageActionRow().addComponents(
      params.map((param) =>
        new MessageButton().setLabel(param.label).setCustomId(param.customId).setStyle("PRIMARY")
      )
    );
  };

  public static getButton = ({
    label,
    url,
  }: {
    label: string;
    url: string;
    style?: MessageButtonStyleResolvable;
  }) => {
    const button = new MessageButton().setLabel(label).setStyle("LINK");

    if (url) button.setURL(url);

    return new MessageActionRow().addComponents(button);
  };

  public static getUrlButtons = ({
    label,
    url,
    secondLabel,
    secondUrl,
  }: {
    label: string;
    url: string;
    secondLabel: string;
    secondUrl: string;
  }) => {
    return new MessageActionRow().addComponents([
      new MessageButton().setStyle("LINK").setURL(url).setLabel(label),
      new MessageButton()
        .setStyle("LINK")
        .setURL(secondUrl)
        .setLabel(secondLabel),
    ]);
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
    return new MessageActionRow().addComponents([
      new MessageButton().setCustomId(customId).setLabel(label).setStyle(style),
      new MessageButton()
        .setCustomId(secondCustomId)
        .setLabel(secondLabel)
        .setStyle(secondStyle)
    ]);
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
    userId,
  }: {
    token: string;
    userId: string;
  }) => {
    const desktopLink = `${URL}?token=${token}&userId=${userId}`;
    const mobileLink = `${URL_METAMASK}?token=${token}&userId=${userId}`;

    return { desktopLink, mobileLink };
  };

  public static getConnectReply = ({
    token,
    userId,
  }: {
    token: string;
    userId: string;
  }) => {
    const embed = new MessageEmbed().setTitle(`Connect to metamask account`).setDescription(`These links will expire in 2 minutes`);

    const { desktopLink, mobileLink } = UI.getConnectUrl({ token, userId });
    return {
      embeds: [embed],
      ephemeral: true,
      components: [
        this.getUrlButtons({
          label: "Chrome App",
          url: desktopLink,
          secondLabel: "Metamask App",
          secondUrl: mobileLink,
        }),
      ],
    };
  };
}
