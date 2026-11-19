const {
  User, exchangeRates, tg, answerCb, createText, checkMembership,
  backToMainKeyboard, mainMenuKeyboard, sendWelcome
} = require("./lib");

async function ensureUser(msg) {
  const userId = msg.from.id;
  let user = await User.findOne({ telegramId: userId });

  if (user && user.isBanned) {
    await tg("sendMessage", { chat_id: userId, text: "🚫 አካውንትዎ ታግዷል!" });
    return null;
  }

  if (!user) {
    user = await User.create({
      telegramId: userId,
      username: msg.from.username || "",
      firstName: msg.from.first_name || "",
      step: "idle"
    });
  }

  if (!user.isJoined) {
    const isMember = await checkMembership(userId);
    if (isMember) {
      user.isJoined = true;
      await user.save();
    } else {
      const joinText = `⚠️ ይቅርታ፣ ቦቱን ለመጠቀም መጀመሪያ ቻናላችንን መቀላቀል አለብዎት!\n\n👉 እባክዎ ከታች ያለውን ሊንክ ተጭነው ቻናሉን ከተቀላቀሉ በኋላ «🌟 ተቀላቅያለሁ (Check)» የሚለውን ይጫኑ፡-`;
      const joinEntities = [
        { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5447644880824181073" },
        { offset: joinText.indexOf("👉"), length: 2, type: "custom_emoji", custom_emoji_id: "5471978009449731768" },
        { offset: joinText.indexOf("🌟"), length: 2, type: "custom_emoji", custom_emoji_id: "6267118537752450044" }
      ];

      await tg("sendMessage", {
        chat_id: userId,
        text: joinText,
        entities: joinEntities,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "ቻናል ተቀላቀል (@Unique_Techs)",
                icon_custom_emoji_id: "6267129592998270736",
                url: "https://t.me/Unique_Techs"
              }
            ],
            [
              {
                text: "ተቀላቅያለሁ (Check)",
                icon_custom_emoji_id: "6267008582294705964",
                callback_data: "check_join"
              }
            ]
          ]
        }
      });
      return null;
    }
  }

  return user;
}

async function handleMessage(ctx) {
  const { user, text, userId } = ctx;

  if (text.startsWith("/start")) {
    user.step = "idle";
    user.tempOrder = {};
    await user.save();
    await sendWelcome(userId);
    return true;
  }

  if (text === "❌ ሰርዝ (Cancel)" || text === "🔙 ወደ ዋናው ሜኑ ተመለስ") {
    user.step = "idle";
    user.tempOrder = {};
    await user.save();

    await tg("sendMessage", {
      chat_id: userId,
      text: "✅ ወደ ዋናው ሜኑ ተመልሰዋል!",
      entities: [{ offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" }]
    });

    await sendWelcome(userId);
    return true;
  }

  if (text === "📊 የዛሬ ተመን") {
    const t = createText();

    t.add("📊", "4958506272551863292");
    t.add("የዛሬ የ USDT መሸጫ ዋጋዎች፦", null, true);
    t.add("\n━━━━━━━━━━━━━━━━━━\n");

    t.add("✅", "6267008582294705964");
    t.add(" 0.5 - 0.9 ");
    t.add("💵", "5965043124068687455");
    t.add(` ${exchangeRates.tier1} ETB`, null, true);
    t.add("\n");

    t.add("✅", "6267008582294705964");
    t.add(" 1.0 - 10 ");
    t.add("💵", "5965043124068687455");
    t.add(` ${exchangeRates.tier2} ETB`, null, true);
    t.add("\n");

    t.add("✅", "6267008582294705964");
    t.add(" 11 - 30 ");
    t.add("💵", "5965043124068687455");
    t.add(` ${exchangeRates.tier3} ETB`, null, true);
    t.add("\n");

    t.add("✅", "6267008582294705964");
    t.add(" 31+      ");
    t.add("💵", "5965043124068687455");
    t.add(` ${exchangeRates.tier4} ETB (ምርጥ ተመን)`, null, true);
    t.add("\n━━━━━━━━━━━━━━━━━━\n");

    t.add("📊", "4958506272551863292");
    t.add("የዛሬ የ USDT መግዣ ዋጋ፦", null, true);
    t.add("\n\n");

    t.add("✅", "6267008582294705964");
    t.add(`የምንሸጥበት ዋጋ፦ ${exchangeRates.buyRate} ብር `, null, true);
    t.add("💰", "6267068789146260253");
    t.add("\n━━━━━━━━━━━━━━━━━━\n");

    t.add("ለመሸጥ \"");
    t.add("✔️", "6267225207560214192");
    t.add(" USDT መሸጥ\" የሚለውን ይጫኑ!");

    await tg("sendMessage", {
      chat_id: userId,
      text: t.text,
      entities: t.entities,
      reply_markup: backToMainKeyboard
    });
    return true;
  }

  if (text === "🧑‍💻 ድጋፍ / አድሚን") {
    const t = createText();
    t.add("👨‍💻", "5190498849440931467");
    t.add("የደንበኞች ድጋፍ እና ማህበረሰብ");
    t.add("\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
    t.add("➡️", "5042341817966658405");
    t.add(" ማንኛውም ጥያቄ፣ አስተያየት ወይም እርዳታ ከፈለጉ በቀጥታ ያናግሩን፡-\n\n");
    t.add("🤝", "6264720734820505831");
    t.add(" Admin Support፦ ");
    t.add("@Aropc", null, false, "mention");
    t.add("\n");
    t.add("✅", "6267008582294705964");
    t.add(" Channel፦ ");
    t.add("@Unique_techs", null, false, "mention");
    t.add("\n\n");
    t.add("⏰", "6285240160120477644");
    t.add("የስራ ሰዓት፦ 24/7 ሁልጊዜ አለን!");
    t.add("✅", "4958610528588008305");

    await tg("sendMessage", {
      chat_id: userId,
      text: t.text,
      entities: t.entities,
      reply_markup: backToMainKeyboard
    });
    return true;
  }

  return false;
}

async function handleCheckJoin(callback) {
  const cbUserId = callback.from.id;
  const isMember = await checkMembership(cbUserId);

  if (!isMember) {
    await answerCb(callback.id, "⚠️ ቻናሉን ገና አልተቀላቀሉም! መጀመሪያ ተቀላቀሉ።", true);
    return;
  }

  await User.findOneAndUpdate({ telegramId: cbUserId }, { isJoined: true });
  await answerCb(callback.id, "🎉 እንኳን ደህና መጡ!");

  if (callback.message?.message_id) {
    try {
      await tg("deleteMessage", { chat_id: cbUserId, message_id: callback.message.message_id });
    } catch (e) {
      console.error("Delete force join msg error:", e.message);
    }
  }

  const joinedSuccessText = "🎉 እንኳን ደህና መጡ! ቻናሉን በተሳካ ሁኔታ ተቀላቅለዋል።";
  await tg("sendMessage", {
    chat_id: cbUserId,
    text: joinedSuccessText,
    entities: [
      { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5039529134078821602" },
      { offset: 3, length: joinedSuccessText.length - 3, type: "bold" }
    ]
  });

  await sendWelcome(cbUserId);
}

module.exports = { ensureUser, handleMessage, handleCheckJoin };
