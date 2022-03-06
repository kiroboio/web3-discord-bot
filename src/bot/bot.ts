import Discord from "discord.js";

const bot = new Discord.Client();

bot.on("message", (ctx) => {
  if (ctx.content === "ciao") {
    ctx.reply(ctx.content);
  }

  if (ctx.content === "/start") {
    ctx.reply(`https://web3-discord-bot.herokuapp.com/`);
  }
});

export { bot }