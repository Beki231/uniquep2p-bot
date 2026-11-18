const {
  ADMIN_CHAT_ID, STATS_BANNER_URL,
  User, Order, Settings, Rate,
  state, exchangeRates, tg, answerCb, clearAdminOrderButtons, escapeHTML
} = require("../lib");

// SELL FLOW ADMIN RECEIPT (admin sends receipt photo)
async function handleReceiptPhoto(msg) {
  if (!state.pendingReceiptOrder) return false;

  if (msg.photo && msg.photo.length > 0) {
    const order = await Order.findOne({ orderId: state.pendingReceiptOrder });
    if (order && order.status === "pending" && order.orderType === "sell") {
      order.status = "approved";
      const adminReceiptPhotoId = msg.photo[msg.photo.length - 1].file_id;
      order.receiptFileId = adminReceiptPhotoId;
      await order.save();

      await clearAdminOrderButtons(order.adminMessageId);

      const isTele = order.method === "Telebirr";
      const bankName = isTele ? "Telebirr" : "CBE";
      const bankEmoji = isTele ? "5931638668031695373" : "5931351583827696128";
      const checkEmoji = "5039529134078821602";
      const usdtEmoji = "4956601935592424315";
      const etbEmoji = "4958926882994127612";
      const bankIconEmoji = "5282843764451195532";
      const okEmoji = "6266967801580231067";

      const finalMsg =
        `<tg-emoji emoji-id="${checkEmoji}">🎉</tg-emoji> <b>ትዕዛዝዎ በተሳካ ሁኔታ ደርሷል</b><tg-emoji emoji-id="${okEmoji}">✅</tg-emoji>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `<tg-emoji emoji-id="${usdtEmoji}">💵</tg-emoji> <b>መጠን:</b> ${order.amount} USDT\n` +
        `<tg-emoji emoji-id="${etbEmoji}">💰</tg-emoji> <b>የሚከፈለው:</b> ${Number(order.total || 0).toLocaleString()} ETB\n` +
        `<tg-emoji emoji-id="${bankIconEmoji}">🖥</tg-emoji> <b>ወደ:</b> ${bankName}<tg-emoji emoji-id="${bankEmoji}">🏦</tg-emoji> (<code>${escapeHTML(order.account)}</code>)\n\n` +
        `አድሚኑ ደረሰኙን አረጋግጦ ክፍያውን ወዲያውኑ ገቢ ያደርጋል<tg-emoji emoji-id="${okEmoji}">✅</tg-emoji>!`;

      try {
        await tg("sendPhoto", {
          chat_id: order.userId,
          photo: adminReceiptPhotoId,
          caption: finalMsg,
          parse_mode: "HTML"
        });
      } catch (e) {
        console.error("User receipt send error:", e.message);
      }

      await tg("sendMessage", { chat_id: msg.chat.id, text: `✅ ደረሰኙ ለተጠቃሚው በተሳካ ሁኔታ ተልኳል!` });

      state.pendingReceiptOrder = null;
      return true;
    }
    return false;
  }

  if (msg.text === "/cancel") {
    state.pendingReceiptOrder = null;
    await tg("sendMessage", { chat_id: msg.chat.id, text: `❌ የደረሰኝ መላክ ሂደት ተሰርዟል።` });
    return true;
  }

  return false;
}

// ADMIN COMMANDS
async function handleCommand(msg) {
  if (!msg.text) return false;
  const text = msg.text.trim();

  if (text === "/stats") {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const approvedOrders = await Order.countDocuments({ status: "approved" });
    const pendingOrders = await Order.countDocuments({ status: "pending" });
    const declinedOrders = await Order.countDocuments({ status: "declined" });

    const statsMsg =
      `📊 <b>የአጠቃላይ ሁኔታ ዳሽቦርድ (Stats)</b>\n━━━━━━━━━━━━━━━━━━\n` +
      `👥 <b>ጠቅላላ ተጠቃሚዎች:</b> ${totalUsers}\n` +
      `📦 <b>ጠቅላላ ትዕዛዞች:</b> ${totalOrders}\n━━━━━━━━━━━━━━━━━━\n` +
      `✅ <b>የጸደቁ:</b> ${approvedOrders} | ⏳ <b>በሂደት:</b> ${pendingOrders} | ❌ <b>ውድቅ:</b> ${declinedOrders}`;

    await tg("sendMessage", { chat_id: msg.chat.id, text: statsMsg, parse_mode: "HTML" });
    return true;
  }

  if (text === "/statics" || text === "Statics") {
    const totalUsers = await User.countDocuments();
    const now = new Date();
    const localTime = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    const dateStr = localTime.toISOString().split("T")[0];
    const hours = localTime.getHours() % 12 || 12;
    const minutes = String(localTime.getMinutes()).padStart(2, "0");
    const ampm = localTime.getHours() >= 12 ? "PM" : "AM";

    const staticsCaption = `📊 <b>Bot Statistics</b>\n\n👥 <b>Total Users: ${totalUsers}</b>\n\n📅 <b>Date: ${dateStr}</b>\n⏰ <b>Time: ${hours}:${minutes} ${ampm}</b>`;
    await tg("sendPhoto", {
      chat_id: msg.chat.id,
      photo: STATS_BANNER_URL,
      caption: staticsCaption,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "🔐 Admin Panel", callback_data: "open_admin_panel" }]] }
    });
    return true;
  }

  if (text === "/daily") {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const approvedOrdersToday = await Order.find({ status: "approved", createdAt: { $gte: startOfDay } });

    const count = approvedOrdersToday.length;
    const totalUSDT = approvedOrdersToday.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalETB = approvedOrdersToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const dailyMsg =
      `📅 <b>የዛሬ ዕለታዊ ሪፖርት (Daily Summary)</b>\n━━━━━━━━━━━━━━━━━━\n` +
      `✅ <b>የተጠናቀቁ ትዕዛዞች:</b> ${count}\n` +
      `💵 <b>ጠቅላላ የተሸጠ USDT:</b> ${totalUSDT.toFixed(2)} USDT\n` +
      `💰 <b>የተከፈለ ብር:</b> ${totalETB.toLocaleString()} ETB\n━━━━━━━━━━━━━━━━━━`;

    await tg("sendMessage", { chat_id: msg.chat.id, text: dailyMsg, parse_mode: "HTML" });
    return true;
  }

  if (text.startsWith("/broadcast ")) {
    const broadcastMsg = text.replace("/broadcast ", "").trim();
    if (!broadcastMsg) return true;

    const allUsers = await User.find({}, "telegramId");
    let successCount = 0;

    await tg("sendMessage", { chat_id: msg.chat.id, text: `📢 መልእክት ለ ${allUsers.length} ተጠቃሚዎች እየተላከ ነው...` });

    for (const u of allUsers) {
      try {
        await tg("sendMessage", { chat_id: u.telegramId, text: broadcastMsg, parse_mode: "HTML" });
        successCount++;
      } catch (e) {}
    }

    await tg("sendMessage", { chat_id: msg.chat.id, text: `✅ ብሮድካስት ተጠናቋል! ለ ${successCount} ተጠቃሚዎች ደርሷል።` });
    return true;
  }

  if (text.startsWith("/send ")) {
    const parts = text.split(" ");
    const targetId = parts[1];
    const directMsg = parts.slice(2).join(" ").trim();

    if (!targetId || !directMsg) {
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        text: "⚠️ አጠቃቀም፦ <code>/send &lt;user_id&gt; &lt;መልእክት&gt;</code>",
        parse_mode: "HTML"
      });
      return true;
    }

    try {
      await tg("sendMessage", {
        chat_id: targetId,
        text: `📩 <b>ከአድሚን የተላከ መልእክት፦</b>\n\n${directMsg}`,
        parse_mode: "HTML"
      });
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        text: `✅ መልእክቱ ለ <code>${escapeHTML(targetId)}</code> ተልኳል!`,
        parse_mode: "HTML"
      });
    } catch (err) {
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        text: `❌ መልእክቱን መላክ አልተቻለም። ተጠቃሚው ቦቱን ዘግቶት ሊሆን ይችላል።`
      });
    }
    return true;
  }

  if (text.startsWith("/ban ")) {
    const targetId = Number(text.split(" ")[1]);
    if (targetId) {
      await User.findOneAndUpdate({ telegramId: targetId }, { isBanned: true });
      await tg("sendMessage", { chat_id: msg.chat.id, text: `🚫 ተጠቃሚ <code>${targetId}</code> ታግዷል!`, parse_mode: "HTML" });
      return true;
    }
  }

  if (text.startsWith("/unban ")) {
    const targetId = Number(text.split(" ")[1]);
    if (targetId) {
      await User.findOneAndUpdate({ telegramId: targetId }, { isBanned: false });
      await tg("sendMessage", { chat_id: msg.chat.id, text: `✅ ተጠቃሚ <code>${targetId}</code> ተነስቷል!`, parse_mode: "HTML" });
      return true;
    }
  }

  if (text.startsWith("/pause")) {
    const reason = text.replace("/pause", "").trim() || "ቦቱ ለአጭር ጊዜ ጥገና ቆሟል።";
    await Settings.findOneAndUpdate({ key: "v2_settings" }, { isPaused: true, pauseReason: reason }, { upsert: true });
    await tg("sendMessage", { chat_id: msg.chat.id, text: `⏸️ ቦቱ ቆሟል!` });
    return true;
  }

  if (text === "/resume") {
    await Settings.findOneAndUpdate({ key: "v2_settings" }, { isPaused: false }, { upsert: true });
    await tg("sendMessage", { chat_id: msg.chat.id, text: `▶️ ቦቱ ስራ ጀምሯል!` });
    return true;
  }

  if (text.startsWith("/setbuyrate")) {
    const p = text.split(/\s+/).filter(x => x.trim() !== "");
    if (p.length >= 2) {
      const newBuyRate = Number(p[1]);
      if (!isNaN(newBuyRate) && newBuyRate > 0) {
        exchangeRates.buyRate = newBuyRate;
        await Rate.findOneAndUpdate(
          { key: "v2_rates" },
          { $set: { buyRate: newBuyRate } },
          { upsert: true, new: true }
        );
        await tg("sendMessage", {
          chat_id: msg.chat.id,
          text: `✅ <b>የ USDT መግዣ ተመን (Buy Rate) በተሳካ ሁኔታ ተቀይሯል!</b>\n━━━━━━━━━━━━━━━━━━\n💵 1 USDT = <b>${newBuyRate} ETB</b>`,
          parse_mode: "HTML"
        });
        return true;
      }
    }
    await tg("sendMessage", {
      chat_id: msg.chat.id,
      text: "⚠️ <b>ስህተት፦</b> እባክዎ አዲሱን የመግዣ ዋጋ አስገብተው ይላኩ!\n\n<i>ለምሳሌ፦</i> <code>/setbuyrate 193</code>",
      parse_mode: "HTML"
    });
    return true;
  }

  if (text.startsWith("/setrates")) {
    const p = text.split(/\s+/).filter(x => x.trim() !== "");
    if (p.length >= 5) {
      const t1 = Number(p[1]);
      const t2 = Number(p[2]);
      const t3 = Number(p[3]);
      const t4 = Number(p[4]);

      if (!isNaN(t1) && !isNaN(t2) && !isNaN(t3) && !isNaN(t4)) {
        exchangeRates.tier1 = t1;
        exchangeRates.tier2 = t2;
        exchangeRates.tier3 = t3;
        exchangeRates.tier4 = t4;

        await Rate.findOneAndUpdate(
          { key: "v2_rates" },
          { $set: { tier1: t1, tier2: t2, tier3: t3, tier4: t4 } },
          { upsert: true, new: true }
        );

        await tg("sendMessage", {
          chat_id: msg.chat.id,
          text: `✅ <b>ተመኖች በተሳካ ሁኔታ ተቀይረዋል!</b>\n━━━━━━━━━━━━━━━━━━\n🔹 0.5 - 0.9 USDT ➡️ <b>${t1} ETB</b>\n🔹 1.0 - 10 USDT ➡️ <b>${t2} ETB</b>\n🔹 11 - 30 USDT ➡️ <b>${t3} ETB</b>\n🔥 31+ USDT ➡️ <b>${t4} ETB</b>`,
          parse_mode: "HTML"
        });
        return true;
      }
    }

    await tg("sendMessage", {
      chat_id: msg.chat.id,
      text: "⚠️ <b>ስህተት፦</b> እባክዎ 4ቱን ተመኖች በክፍተት አስገብተው ይላኩ!\n\n<i>ለምሳሌ፦</i> <code>/setrates 178 180 182 185</code>",
      parse_mode: "HTML"
    });
    return true;
  }

  return false;
}

// ADMIN CALLBACKS: panel + ban
async function openPanel(callback) {
  await answerCb(callback.id);

  const panelHelpText =
    `🔐 <b>የአድሚን መቆጣጠሪያ ፓነል (Admin Panel Commands)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ <b>/setrates</b> - ተመኖችን ለመቀየር\n` +
    `2️⃣ <b>/setbuyrate</b> - መግዣ ዋጋ ለመቀየር\n` +
    `3️⃣ <b>/pause</b> - ቦቱን ለማቆም\n` +
    `4️⃣ <b>/resume</b> - ቦቱን ለማስጀመር\n` +
    `5️⃣ <b>/broadcast</b> - ማስታወቂያ ለመላክ\n` +
    `6️⃣ <b>/send</b> - ለተጠቃሚ መልእክት ለመላክ\n` +
    `7️⃣ <b>/stats</b> - ስታቲስቲክስ ለማየት\n` +
    `8️⃣ <b>/daily</b> - የዛሬ ሪፖርት ለማየት\n` +
    `9️⃣ <b>/statics</b> - የቀጥታ ዳሽቦርድ ለማየት\n` +
    `🔟 <b>/ban /unban</b> - ተጠቃሚን ለማገድ/ለማንሳት`;

  await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: panelHelpText, parse_mode: "HTML" });
}

async function banUser(callback) {
  const targetId = Number(callback.data.split(":")[1]);
  await User.findOneAndUpdate({ telegramId: targetId }, { isBanned: true });
  await clearAdminOrderButtons(callback.message?.message_id);
  await answerCb(callback.id, `User ${targetId} Banned!`);
  await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: `🚫 ተጠቃሚ ${targetId} ታግዷል!` });
}

module.exports = { handleReceiptPhoto, handleCommand, openPanel, banUser };
