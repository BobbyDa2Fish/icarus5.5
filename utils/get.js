// @ts-check
const Augur = require("augurbot-ts"),
  { ChannelType } = require("discord.js");

const Module = new Augur.Module();
const reportGetErr = (id, supposed) => { throw new Error(`Bad ID (${id}), it was supposed to be a ${supposed}`); };
const getC = (id) => Module.client.channels.cache.get(id);

module.exports = {

  channel: {
    nonThreadText: (id) => {
      const channel = getC(id);
      if (!channel?.isTextBased() || channel.isThread()) reportGetErr(id, `non thread text channel`);
      else return channel;
    },
    thread: (id) => {
      const channel = getC(id);
      if (!channel?.isThread()) reportGetErr(id, "thread channel");
      else return channel;
    },
    text: (id) => {
      const channel = getC(id);
      if (!channel?.isTextBased()) reportGetErr(id, "category channel");
      else return channel;
    },
    voice: (id) => {
      const channel = getC(id);
      if (!channel?.isVoiceBased()) reportGetErr(id, `voice channel`);
      else return channel;
    },
    category: (id) => {
      const channel = getC(id);
      if (channel?.type != ChannelType.GuildCategory) reportGetErr(id, "category channel");
      else return channel;
    },
    forum: (id) => {
      const channel = getC(id);
      if (channel?.type != ChannelType.GuildForum) reportGetErr(id, "forum channel");
      else return channel;
    },
    dm: (id) => {
      const channel = getC(id);
      if (!channel?.isDMBased()) reportGetErr(id, "category channel");
      else return channel;
    }
  }
};