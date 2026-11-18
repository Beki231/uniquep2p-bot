const {
  User, Order, ADMIN_CHAT_ID,
  exchangeRates, escapeHTML,
  tg, answerCb, createText, clearAdminOrderButtons,
  mainMenuKeyboard, checkPaused, declineOrder
} = require("./lib");

function buildAddressPrompt(netKey) {
  const t = createText();

  if (netKey === "binance") {
    t.add("📌", "5397782960512444700");
    t.add(" እባክዎ የ Binance");
    t.add("💰", "5202068941580550229");
    t.add(" ID ቁጥርዎን ያስገቡ፡-\n\n");
    t.add("💬", "5443038326535759644");
    t.add(" ምሳሌ፦ 1197432698");
  } else if (netKey === "bep20") {
    t.add("📌", "5397782960512444700");
    t.add(" እባክዎ የ USDT BEP-20");
    t.add("🔶", "5291786530606562380");
    t.add(" አድራሻዎን ያስገቡ፡-\n\n");
    t.add("💬", "5443038326535759644");
    t.add(" ምሳሌ፦ 0x71C83920F...");
  } else if (netKey === "ton") {
    t.add("📌", "5397782960512444700");
    t.add(" እባክዎ የ TON");
    t.add("🤑", "5350716797622442220");
    t.add(" Wallet አድራሻዎን ያስገቡ፡-\n\n");
    t.add("💬", "5443038326535759644");
    t.add(" ምሳሌ፦ UQCYZuyq...");
  } else if (netKey === "aptos") {
    t.add("📌", "5397782960512444700");
    t.add("እባክዎ የ Aptos");
    t.add("😟", "5327975761833913214");
    t.add(" Wallet አድራሻዎን ያስገቡ፡-\n\n");
    t.add("💬", "5443038326535759644");
    t.add(" ምሳሌ፦ ox71hcj....");
  } else {
    return null;
  }

  return t;
}

const NET_NAMES = {
  binance: "Binance ID",
  bep20: "BEP-20",
  ton: "TON",
  aptos: "Aptos"
};

// BUY: user text messages
async function handleMessage(ctx) {
  const { msg, user, text, userId } = ctx;

  if (text === "🟢 USDT መግዛት") {
    if (await checkPaused(userId)) return true;

    user.step = "awaiting_buy_agree";
    user.tempOrder = {};
    await user.save();

    const buyRateStr = `1 USDT = ${exchangeRates.buyRate} ETB`;

    const t = createText();
    t.add("↗️", "5429651785352501917");
    t.add(" ");
    t.add("የዛሬ የ USDT መግዣ ተመን (Rate)", null, true);
    t.add("\n\n");
    t.add("💵", "5040025580758631490");
    t.add(" ");
    t.add(buyRateStr, null, true);
    t.add("\n\n");
    t.add("🌟", "6267118537752450044");
    t.add("ለመግዛት ከተስማሙ «");
    t.add("✅", "6267008582294705964");
    t.add("ተስማምቻለሁ", null, true);
    t.add("» የሚለውን ይንኩ");
    t.add("👇", "5231102735817918643");

    await tg("sendMessage", {
      chat_id: userId,
      text: t.text,
      entities: t.entities,
      reply_markup: {
        keyboard: [
          [{ text: "✅ ተስማምቻለሁ" }],
          [{ text: "❌ ሰርዝ (Cancel)" }]
        ],
        resize_keyboard: true
      }
    });
    return true;
  }

  if ((text === "✅ ተስማምቻለሁ" || text === "ተስማምቻለሁ" || text === "ተስማምቻለሁ✔️") && user.step === "awaiting_buy_agree") {
    user.step = "awaiting_buy_amount";
    user.tempOrder = {};
    await user.save();

    const t = createText();
    t.add("↗️", "5429651785352501917");
    t.add(" ");
    t.add("መግዛት የሚፈልጉትን የ USDT መጠን ያስገቡ፡-", null, true);
    t.add("\n\n");
    t.add("⚠️", "6267039884016358504");
    t.add(" ዝቅተኛው መጠን 1 ");
    t.add("💵", "4956601935592424315");
    t.add(" USDT ነው!");

    await tg("sendMessage", {
      chat_id: userId,
      text: t.text,
      entities: t.entities,
      reply_markup: { keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]], resize_keyboard: true }
    });
    return true;
  }

  if (user.step === "awaiting_buy_amount") {
    const amt = parseFloat(text);
    if (isNaN(amt) || amt < 1) {
      const t = createText();
      t.add("⚠️", "6267039884016358504");
      t.add(" ");
      t.add("እባክዎ ትክክለኛ መጠን ያስገቡ (ዝቅተኛው 1 USDT ነው)፦", null, true);

      await tg("sendMessage", { chat_id: userId, text: t.text, entities: t.entities });
      return true;
    }

    const rate = exchangeRates.buyRate;
    const total = amt * rate;
    const totalFixed = total.toFixed(2);

    user.tempOrder = { amount: amt, rate, total };
    user.step = "awaiting_buy_network";
    await user.save();

    const buyNetKeyboard = {
      inline_keyboard: [
        [
          { text: "Binance ID", icon_custom_emoji_id: "5202068941580550229", callback_data: "buynet:binance" },
          { text: "BEP-20", icon_custom_emoji_id: "5291786530606562380", callback_data: "buynet:bep20" }
        ],
        [
          { text: "TON", icon_custom_emoji_id: "5350716797622442220", callback_data: "buynet:ton" },
          { text: "Aptos", icon_custom_emoji_id: "5327975761833913214", callback_data: "buynet:aptos" }
        ]
      ]
    };

    const amtDisplay = `${amt} USDT (${totalFixed} ETB)`;

    const t = createText();
    t.add("💵", "5040025580758631490");
    t.add(" የሚገዙት መጠን፦ ");
    t.add(amtDisplay, null, true);
    t.add("\n\n");
    t.add("✔️", "5039844895779455925");
    t.add("USDT በምን መቀበል ይፈልጋሉ", null, true);
    t.add("❓", "5436113877181941026");
    t.add("\n\n");
    t.add("⬇️", "5406745015365943482");
    t.add(" እባክዎ ከታች ካሉት አማራጮች አንዱን ይምረጡ፡-");

    await tg("sendMessage", {
      chat_id: userId,
      text: t.text,
      entities: t.entities,
      reply_markup: buyNetKeyboard
    });
    return true;
  }

  if (user.step === "awaiting_buy_address") {
    const walletAddress = text.trim();

    if (!walletAddress) {
      await tg("sendMessage", { chat_id: userId, text: "⚠️ እባክዎ አድራሻዎን በጽሁፍ ያስገቡ፦" });
      return true;
    }

    const orderId = `ORD-${Date.now()}`;
    const orderData = user.tempOrder || {};
    const netKey = orderData.networkKey || "binance";
    const netName = orderData.networkName || "Binance ID";
    const totalFixed = Number(orderData.total || 0).toFixed(2);

    try {
      const newBuyOrder = await Order.create({
        orderId,
        orderType: "buy",
        userId,
        userName: msg.from.first_name || "ደንበኛ",
        telegramUsername: msg.from.username || "",
        amount: Number(orderData.amount) || 0,
        total: Number(orderData.total) || 0,
        rate: Number(orderData.rate) || exchangeRates.buyRate,
        account: walletAddress,
        network: netName,
        networkKey: netKey,
        status: "awaiting_permission"
      });

      user.step = "awaiting_permission";
      user.tempOrder = {
        orderId,
        amount: orderData.amount,
        total: totalFixed,
        account: walletAddress,
        networkKey: netKey,
        networkName: netName
      };
      await user.save();

      let netEmoji = "💸";
      let netLabel = " Binance ID";
      let checkmarkEmojiId = "5039844895779455925";
      let usdtEmojiId = "5040025580758631490";
      const monitorEmojiId = "5039579582764680065";
      let networkEmojiId = "5965273136747257327";

      if (netKey === "ton") {
        netEmoji = "🤑"; netLabel = "TON";
        checkmarkEmojiId = "4956721670690702265";
        usdtEmojiId = "4956601935592424315";
        networkEmojiId = "5350716797622442220";
      } else if (netKey === "bep20") {
        netEmoji = "🔶"; netLabel = "Bep-20";
        checkmarkEmojiId = "4956721670690702265";
        usdtEmojiId = "4956601935592424315";
        networkEmojiId = "5291786530606562380";
      } else if (netKey === "aptos") {
        netEmoji = "😟"; netLabel = "Aptos";
        checkmarkEmojiId = "5039844895779455925";
        usdtEmojiId = "4956601935592424315";
        networkEmojiId = "5327975761833913214";
      }

      const sent = createText();
      sent.add("✔️", checkmarkEmojiId);
      sent.add(" የትዕዛዝ ጥያቄዎ ወደ Admin ተልኳል!\n\n");
      sent.add("💵", usdtEmojiId);
      sent.add(` መጠን፦ ${orderData.amount} USDT (${totalFixed} ETB)\n`);
      sent.add("🖥", monitorEmojiId);
      sent.add(" መቀበያዎ፦ ");
      sent.add(walletAddress, null, false, "code");
      sent.add(" (");
      sent.add(netEmoji, networkEmojiId);
      sent.add(netLabel);
      sent.add(")\n\n");
      sent.add("👨‍💻", "5190498849440931467");
      sent.add(" እባክዎ Admin እስኪያረጋግጥ ጥቂት ሰከንዶችን ይጠብቁ፤ እንደተፈቀደ የክፍያ አካውንቶች ይላኩሎታል።");

      await tg("sendMessage", {
        chat_id: userId,
        text: sent.text,
        entities: sent.entities,
        reply_markup: {
          keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]],
          resize_keyboard: true
        }
      });

      const netIconMap = {
        binance: "🟠 Binance ID",
        bep20: "🔶 BEP-20",
        ton: "💎 TON",
        aptos: "⚪ Aptos"
      };
      const netDisplay = netIconMap[netKey] || netName;
      const userTag = msg.from.username ? `@${msg.from.username}` : "የለውም";

      const adminBuyReqText =
        `🔔 <b>አዲስ የ USDT ግዢ ጥያቄ ደርሷል (ፍቃድ ይጠይቃል)!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>ትዕዛዝ ቁጥር፦</b> <code>${orderId}</code>\n` +
        `👤 <b>ደንበኛ፦</b> ${escapeHTML(userTag)} (${escapeHTML(msg.from.first_name || "ደንበኛ")})\n` +
        `🆔 <b>ID፦</b> <code>${userId}</code>\n` +
        `💵 <b>የሚገዛው መጠን፦</b> <b>${orderData.amount} USDT</b>\n` +
        `💰 <b>የሚከፍለው ብር፦</b> <b>${totalFixed} ETB</b>\n` +
        `🔗 <b>ኔትወርክ፦</b> ${netDisplay}\n` +
        `🎯 <b>መቀበያ Wallet/ID፦</b> <code>${escapeHTML(walletAddress)}</code>\n\n` +
        `👉 <i>ይህ ሰው ክፍያ እንዲፈጽም ይፈቀድ?</i>`;

      const sentAdminBuyMsg = await tg("sendMessage", {
        chat_id: ADMIN_CHAT_ID,
        text: adminBuyReqText,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `buy_allow:${orderId}` },
              { text: "❌ Decline", callback_data: `buy_reject:${orderId}` }
            ]
          ]
        }
      });

      if (sentAdminBuyMsg && sentAdminBuyMsg.message_id) {
        newBuyOrder.adminMessageId = sentAdminBuyMsg.message_id;
        await newBuyOrder.save();
      }
    } catch (err) {
      console.error("Buy order save error:", err.message);
    }
    return true;
  }

  if (user.step === "awaiting_buy_screenshot") {
    if (!msg.photo || msg.photo.length === 0) {
      await tg("sendMessage", { chat_id: userId, text: "⚠️ እባክዎ የከፈሉበትን ደረሰኝ በፎቶ (Screenshot) መልክ ይላኩ፦" });
      return true;
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const orderData = user.tempOrder || {};

    try {
      let order = await Order.findOne({ orderId: orderData.orderId, orderType: "buy" });
      if (!order) {
        order = await Order.findOne({ userId: userId, orderType: "buy", status: "approved" }).sort({ createdAt: -1 });
      }

      if (order) {
        order.customerProofFileId = fileId;
        order.status = "pending";
        await order.save();
      }

      user.step = "idle";
      user.tempOrder = {};
      await user.save();

      const s = createText();
      s.add("🛫", "5201691993775818138");
      s.add(" ትዕዛዝዎ እና የከፈሉበት ደረሰኝ በተሳካ ሁኔታ ደርሶናል!\n\n");
      s.add("👨‍💻", "5190498849440931467");
      s.add(" መረጃዎ ወደ Admin ተልኳል፤ በጥቂት ደቂቃዎች ውስጥ ተጣርቶ ዩኤስዲቲ (USDT) ይለቀቅሎታል።\n\n");
      s.add("💯", "5042297717242463211");
      s.add(" UNIQUE P2P STOREን ስለመረጡ እናመሰግናለን!");

      await tg("sendMessage", {
        chat_id: userId,
        text: s.text,
        entities: s.entities,
        reply_markup: mainMenuKeyboard
      });

      const currentOrderId = order ? order.orderId : (orderData.orderId || "N/A");

      const adminProofCaption =
        `🚨 <b>አዲስ የ USDT ግዢ የክፍያ ደረሰኝ (Screenshot)</b>\n━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>ስም:</b> ${escapeHTML(msg.from.first_name || "ደንበኛ")} (@${msg.from.username || "የለውም"})\n` +
        `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
        `🆔 <b>Order ID:</b> <code>${currentOrderId}</code>\n` +
        `💵 <b>USDT:</b> ${orderData.amount || (order ? order.amount : 0)}\n` +
        `💰 <b>Total:</b> ${orderData.total || (order ? order.total : 0)} ETB\n` +
        `🎯 <b>መቀበያ Wallet/ID:</b> <code>${escapeHTML(orderData.account || (order ? order.account : ""))}</code>\n━━━━━━━━━━━━━━━━━━`;

      const adminReceiptKeyboard = {
        inline_keyboard: [
          [
            { text: "✅ Order Complete (USDT ላክ)", callback_data: `buy_done:${currentOrderId}` }
          ],
          [
            { text: "❌ Decline", callback_data: `buy_reject:${currentOrderId}` },
            { text: "🚫 Ban User", callback_data: `ban_user:${userId}` }
          ]
        ]
      };

      const sentAdminMsg = await tg("sendPhoto", {
        chat_id: ADMIN_CHAT_ID,
        photo: fileId,
        caption: adminProofCaption,
        parse_mode: "HTML",
        reply_markup: adminReceiptKeyboard
      });

      if (sentAdminMsg && sentAdminMsg.message_id && order) {
        order.adminMessageId = sentAdminMsg.message_id;
        await order.save();
      }
    } catch (err) {
      console.error("Buy screenshot send error:", err);
    }
    return true;
  }

  return false;
}

// BUY: user callbacks (buynet:)
async function handleUserCallback(callback) {
  const data = callback.data || "";
  const cbUserId = callback.from.id;

  if (data.startsWith("buynet:")) {
    const netKey = data.replace("buynet:", "");
    const user = await User.findOne({ telegramId: cbUserId });

    await answerCb(callback.id);

    if (user && user.step === "awaiting_buy_network") {
      const prompt = buildAddressPrompt(netKey);
      if (!prompt) return;

      user.tempOrder = { ...(user.tempOrder || {}), networkKey: netKey, networkName: NET_NAMES[netKey] };
      user.step = "awaiting_buy_address";
      await user.save();

      await tg("sendMessage", {
        chat_id: cbUserId,
        text: prompt.text,
        entities: prompt.entities
      });
    }
    return;
  }
}

// BUY: admin callbacks (buy_allow, buy_done, buy_reject)
async function handleAdminCallback(ctx) {
  const { callback, action, order } = ctx;

  if (!["buy_allow", "buy_done", "buy_reject"].includes(action)) return false;

  if (order.orderType !== "buy") {
    await answerCb(callback.id, "⚠️ ይህ የግዢ ትዕዛዝ አይደለም!", true);
    return true;
  }

  const netKey = order.networkKey || "binance";
  const netDisplayName = NET_NAMES[netKey] || "Binance ID";

  if (action === "buy_allow") {
    if (order.status !== "awaiting_permission") {
      await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);
      await answerCb(callback.id, "⚠️ ይህ ትዕዛዝ አስቀድሞ ተስተናግዷል!", true);
      return true;
    }

    order.status = "approved";
    const buyingUser = await User.findOne({ telegramId: order.userId });
    if (buyingUser) {
      buyingUser.step = "awaiting_buy_screenshot";
      buyingUser.tempOrder = {
        orderId: order.orderId,
        amount: order.amount,
        total: order.total,
        account: order.account,
        networkKey: order.networkKey,
        networkName: order.network
      };
      await buyingUser.save();
    }
    await order.save();

    await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);

    const approvedText =
      `<tg-emoji emoji-id="6267225207560214192">✔️</tg-emoji> <b>ትዕዛዝዎ ተፈቅዷል፤ ክፍያ መፈጸም ይችላሉ!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<tg-emoji emoji-id="5965043124068687455">💵</tg-emoji> <b>የሚገዙት መጠን፦</b> <b>${order.amount} USDT</b>\n` +
      `<tg-emoji emoji-id="6267068789146260253">💰</tg-emoji> <b>የሚከፍሉት ጠቅላላ ብር፦</b> <b>${Number(order.total || 0).toLocaleString()} ETB</b>\n` +
      `<tg-emoji emoji-id="4956324463525233747">🖥</tg-emoji> <b>መቀበያዎ፦</b> <code>${escapeHTML(order.account)}</code> (${netDisplayName})\n\n` +
      `<tg-emoji emoji-id="5406745015365943482">⬇️</tg-emoji> <b>እባክዎ ትክክለኛውን ብር ከታች ባሉት አማራጮች ገቢ ያድርጉ፡-</b>\n\n` +
      `<tg-emoji emoji-id="5796159851734244538">🏦</tg-emoji> <b>Telebirr፦</b> <code>0949241461</code>\n` +
      `<tg-emoji emoji-id="5373012449597335010">👤</tg-emoji> <b>ስም፦</b> Bereket\n\n` +
      `<tg-emoji emoji-id="5796351978506298393">🏦</tg-emoji> <b>CBE ንግድ ባንክ፦</b> <code>1000725377421</code>\n` +
      `<tg-emoji emoji-id="5373012449597335010">👤</tg-emoji> <b>ስም፦</b> Bereket Wondimhun\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<tg-emoji emoji-id="5413879192267805083">🗓</tg-emoji> <b>ክፍያውን እንደፈጸሙ የከፈሉበትን ደረሰኝ (Screenshot) ከስር ይላኩ፡-</b>`;

    try {
      await tg("sendMessage", {
        chat_id: order.userId,
        text: approvedText,
        parse_mode: "HTML"
      });
    } catch (sendErr) {
      console.error("Failed to send approval message to user:", sendErr.message);
    }

    await answerCb(callback.id, "✅ Approved!");
    return true;
  }

  if (action === "buy_done") {
    if (order.status !== "pending") {
      await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);
      await answerCb(callback.id, "⚠️ ይህ ትዕዛዝ አስቀድሞ ተስተናግዷል!", true);
      return true;
    }

    order.status = "approved";
    await order.save();

    await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);
    await answerCb(callback.id, "✅ Order Completed!");

    const finalMsg =
      `✔️ የትዕዛዝ ማረጋገጫ እና ደረሰኝ፦\n\n` +
      `የ${order.amount} USDT💵 ግዥ ትዕዛዝዎ ጸድቋል!✅\n\n` +
      ` 🍾 ${order.amount}$💵  ወደ ${netDisplayName}💰 አካውንትዎ ገቢ ተደርጓል።\n\n` +
      ` ከUnique P2P ጋር ስለሰሩ እናመሰግናለን❤️‍🔥!`;

    const finalEntities = [
      { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "6267225207560214192" },
      { offset: finalMsg.indexOf("💵"), length: 2, type: "custom_emoji", custom_emoji_id: "5965043124068687455" },
      { offset: finalMsg.indexOf("✅"), length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" },
      { offset: finalMsg.indexOf("🍾"), length: 2, type: "custom_emoji", custom_emoji_id: "5042274086332400375" },
      { offset: finalMsg.lastIndexOf("💵"), length: 2, type: "custom_emoji", custom_emoji_id: "4956601935592424315" },
      { offset: finalMsg.indexOf(netDisplayName), length: netDisplayName.length, type: "bold" },
      { offset: finalMsg.indexOf("💰"), length: 2, type: "custom_emoji", custom_emoji_id: "5296437653770608702" },
      { offset: finalMsg.indexOf("❤️‍🔥"), length: 5, type: "custom_emoji", custom_emoji_id: "5042225965518816316" }
    ];

    try {
      await tg("sendMessage", {
        chat_id: order.userId,
        text: finalMsg,
        entities: finalEntities,
        reply_markup: mainMenuKeyboard
      });
    } catch (sendErr) {
      console.error("Failed to send completion message to user:", sendErr.message);
    }

    return true;
  }

  if (action === "buy_reject") {
    await declineOrder(order, callback);
    return true;
  }

  return false;
}

module.exports = { handleMessage, handleUserCallback, handleAdminCallback };
