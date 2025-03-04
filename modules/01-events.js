const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  moment = require("moment"),
  { GoogleSpreadsheet } = require("google-spreadsheet"),
  config = require('../config/config.json');

const ductTapeExclude = true;
let emojis = [];
const Module = new Augur.Module()
.addEvent("channelCreate", (channel) => {
  try {
    if (channel.guild?.id == u.sf.ldsg) {
      if (channel.permissionsFor(channel.client.user)?.has(["ViewChannel", "ManageChannels"])) {
        channel.permissionOverwrites.create(u.sf.roles.muted, {
          // text
          ViewChannel: false,
          AddReactions: false,
          SendMessages: false,
          ReadMessageHistory: false,
          // voice
          Connect: false,
          Speak: false,
          Stream: false
        }, { reason: "New channel permissions update" })
        .catch(e => u.errorHandler(e, `Update New Channel Permissions: ${channel.name}`));

        // Keep Duct Tape Out
        if (ductTapeExclude) {
          channel.permissionOverwrites.create(u.sf.roles.ducttape, {
            // text
            ViewChannel: false,
            AddReactions: false,
            SendMessages: false,
            ReadMessageHistory: false,
            // voice
            Connect: false,
            Speak: false,
            Stream: false
          }, { reason: "New channel permissions update" })
          .catch(e => u.errorHandler(e, `Update New Channel Permissions: ${channel.name}`));
        }
      } else {
        u.errorLog.send({ embeds: [
          u.embed({
            title: "Update New Channel Permissions",
            description: `Insufficient permissions to update channel ${channel.name}. Muted permissions need to be applied manually.`
          })
        ] });
      }
    }
  } catch (error) {
    u.errorHandler(error, "Set permissions on channel create");
  }
})
.addEvent("guildBanAdd", (guildBan) => {
  const guild = guildBan.guild;
  const user = guildBan.user;
  if (guild.id == u.sf.ldsg) {
    if (guild.client.ignoreNotifications?.has(user.id)) {
      guild.client.ignoreNotifications.delete(user.id);
    } else {
      guild.channels.cache.get(u.sf.channels.modlogs).send({
        embeds: [
          u.embed({
            author: user,
            title: `${user.username} has been banned`,
            color: 0x0000ff
          })
        ]
      });
    }
  }
})
.addEvent("guildMemberAdd", async (member) => {
  try {
    if (member.guild.id == u.sf.ldsg) {
      const guild = member.guild;

      const user = await Module.db.user.fetchUser(member.id, false);
      const general = guild.channels.cache.get(u.sf.channels.general);
      const welcomeChannel = guild.channels.cache.get(u.sf.channels.welcome);
      const modLogs = guild.channels.cache.get(u.sf.channels.modlogs);

      const embed = u.embed()
      .setColor(0x7289da)
      .setDescription("Account Created:\n" + member.user.createdAt.toLocaleDateString())
      .setTimestamp()
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

      let welcomeString;

      if (user) { // Member is returning
        const toAdd = user.roles.filter(role => (
          guild.roles.cache.has(role) &&
          !guild.roles.cache.get(role).managed &&
          ![u.sf.roles.live, u.sf.roles.management, u.sf.roles.manager, u.sf.roles.mod,
            u.sf.roles.team, u.sf.roles.headofhouse, u.sf.roles.emberguardian,
            u.sf.roles.destinyclansmanager, u.sf.roles.volunteer].includes(role)
        ));
        if (user.roles.length > 0) member = await member.roles.add(toAdd);

        let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
        if (roleString.length > 1024) roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + " ...";

        embed.setTitle(member.displayName + " has rejoined the server.")
          .addFields({ name: "Roles", value: roleString });
        welcomeString = `Welcome back, ${member}! Glad to see you again.`;

      } else { // Member is new
        const welcome = u.rand([
          "Welcome",
          "Hi there",
          "Glad to have you here",
          "Ahoy"
        ]);
        const info1 = u.rand([
          "Take a look at",
          "Check out",
          "Head on over to"
        ]);
        const info2 = u.rand([
          "to get started",
          "for some basic community rules",
          "and join in the chat"
        ]);
        const info3 = u.rand([
          "What brings you our way?",
          "How'd you find us?",
          "What platforms/games do you play?"
        ]);
        welcomeString = `${welcome}, ${member}! ${info1} ${welcomeChannel} ${info2}. ${info3}\n\nTry \`!profile\` over in <#${u.sf.channels.botspam}> if you'd like to opt in to roles or share IGNs.`;
        embed.setTitle(member.displayName + " has joined the server.");

        Module.db.user.newUser(member.id);
      }

      if (!member.client.ignoreNotifications?.has(member.id)) {
        modLogs.send({ embeds: [embed] });
      } else {
        member.client.ignoreNotifications.delete(member.id);
      }

      const pizza = false,
        milestone = 5000;
      if (pizza && (guild.members.size < milestone)) welcomeString += `\n*${milestone - guild.members.size} more members until we have a pizza party!*`;
      if (!member.roles.cache.has(u.sf.roles.muted) && !member.user.bot) await general.send({ content: welcomeString, allowedMentions: { parse: ['users'] } });
      if (guild.members.size == milestone) {
        await general.send(`:tada: :confetti_ball: We're now at ${milestone} members! :confetti_ball: :tada:`);
        await modLogs.send(`:tada: :confetti_ball: We're now at ${milestone} members! :confetti_ball: :tada:\n*pinging for effect: ${guild.members.cache.get(u.sf.other.ghost)} ${guild.members.cache.get(u.sf.ownerId)}*`);
      }
    }
  } catch (e) { u.errorHandler(e, "New Member Add"); }
})
.addEvent("guildMemberRemove", async (member) => {
  try {
    if (member.guild.id == u.sf.ldsg) {
      await Module.db.user.updateTenure(member);
      if (!member.client.ignoreNotifications?.has(member.id)) {
        const user = await Module.db.user.fetchUser(member);
        const embed = u.embed({
          author: member,
          title: `${member.displayName} has left the server`,
          color: 0x5865f2,
        })
        .addFields(
          { name: "Joined", value: moment(member.joinedAt).fromNow(), inline: true },
          { name: "Posts", value: (user?.posts || 0) + " Posts", inline: true }
        );
        member.guild.channels.cache.get(u.sf.channels.modlogs).send({ embeds: [embed] });
      }
    }
  } catch (error) { u.errorHandler(error, `Member Leave: ${u.escapeText(member.displayName)} (${member.id})`); }
})
.addEvent("userUpdate", async (oldUser, newUser) => {
  try {
    const ldsg = newUser.client.guilds.cache.get(u.sf.ldsg);
    const newMember = ldsg.members.cache.get(newUser.id);
    if (newMember && (!newMember.roles.cache.has(u.sf.roles.trusted) || newMember.roles.cache.has(u.sf.roles.untrusted))) {
      const user = await Module.db.user.fetchUser(newMember).catch(u.noop);
      const embed = u.embed({ author: oldUser })
      .setTitle("User Update")
      .setFooter({ text: `${user.posts} Posts in ${moment(newMember?.joinedTimestamp).fromNow(true)}` });
      if (oldUser.tag !== newUser.tag) {
        embed.addFields({ name: "**Username Update**", value: `**Old:** ${u.escapeText(oldUser.tag)}\n**New:** ${u.escapeText(newUser.tag)}` });
      }
      if (oldUser.avatar !== newUser.avatar) {
        embed.addFields({ name: "**Avatar Update**", value: "See Below" }).setImage(newUser.displayAvatarURL({ dynamic: true }));
      } else {
        embed.setThumbnail(newUser.displayAvatarURL());
      }
      ldsg.channels.cache.get(u.sf.channels.userupdates).send({ content: `${newUser}: ${newUser.id}`, embeds: [embed] });
    }
  } catch (error) { u.errorHandler(error, `User Update Error: ${u.escapeText(newUser?.username)} (${newUser.id})`); }
})
.setInit(async () => {
  if (!config.google.sheets.config) return console.log("No Sheets ID");
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    const channels = await doc.sheetsByTitle["Sponsor Channels"].getRows();
    emojis = Array.from(channels.map(x => [x["Sponsor ID"], x["Emoji ID"]]));
    emojis = emojis.concat([
      ["buttermelon", u.sf.emoji.buttermelon],
      ["noice", u.sf.emoji.noice],
      ["carp", "🐟"]
    ]);
  } catch (e) { u.errorHandler(e, "Load Sponsor Reactions"); }
})
.addEvent("messageCreate", async (msg) => {
  if (!msg.author.bot && msg.guild && msg.guild.id == u.sf.ldsg) {
    for (const [sponsor, emoji] of emojis) {
      if (msg.mentions.members.has(sponsor)) await msg.react(emoji).catch(u.noop);
      // Filter out sponsors and test for trigger words
      else if (!msg.guild.members.cache.has(sponsor) && Math.random() < 0.3 && msg.content.toLowerCase().includes(sponsor)) await msg.react(emoji).catch(u.noop);
    }
  }
});


module.exports = Module;
