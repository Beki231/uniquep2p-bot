const {
  User, Order, ADMIN_CHAT_ID,
  state, exchangeRates, getRate, escapeHTML,
  tg, answerCb, createText, clearAdminOrderButtons,
  mainMenuKeyboard, checkPaused, declineOrder
} = require("./lib");

// Networks (USDT receiving addresses for SELL)
const cryptoNetworks = {
  binance: {
    name: "Binance Pay UID",
    text:
      `🗓የመረጡት ኔትወርክ: Binance Pay🤪\n\n` +
      `📊 የመላኪያ አድራሻ:⬇️\n\n` +
      `🖥 Binance UID : 1182277662\n` +
      `👤 Nickname : UniqueTech\n\n` +
      `⬇️ USDT ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦`,
    entities: [
      { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5413879192267805083" },
      { offset: 2, length: 14, type: "bold" },
      { offset: 26, length: 2, type: "custom_emoji", custom_emoji_id: "6235497455215973322" },
      { offset: 30, length: 2, type: "custom_emoji", custom_emoji_id: "5231200819986047254" },
      { offset: 33, length: 11, type: "bold" },
      { offset: 44, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 48, length: 2, type: "custom_emoji", custom_emoji_id: "5282843764451195532" },
      { offset: 51, length: 13, type: "bold" },
      { offset: 65, length: 10, type: "code" },
      { offset: 76, length: 2, type: "custom_emoji", custom_emoji_id: "5373012449597335010" },
      { offset: 79, length: 10, type: "bold" },
      { offset: 90, length: 10, type: "code" },
      { offset: 102, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 105, length: 33, type: "bold" }
    ]
  },
  bep20: {
    name: "BEP-20 (BSC)",
    text:
      `🗓 የመረጡት ኔትወርክ: BEP-20🔶\n\n` +
      `📊 የመላኪያ አድራሻ:⬇️\n\n` +
      `🕯 Address : 0xdc6bffaecee233cb3a1b41513349fd4cf842a486\n\n` +
      `👆 Address በመንካት Copy አርጉ\n\n` +
      `⬇️ USDT ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦`,
    entities: [
      { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5413879192267805083" },
      { offset: 3, length: 14, type: "bold" },
      { offset: 22, length: 2, type: "custom_emoji", custom_emoji_id: "5291786530606562380" },
      { offset: 26, length: 2, type: "custom_emoji", custom_emoji_id: "5231200819986047254" },
      { offset: 29, length: 11, type: "bold" },
      { offset: 40, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 44, length: 2, type: "custom_emoji", custom_emoji_id: "5451882707875276247" },
      { offset: 47, length: 9, type: "bold" },
      { offset: 57, length: 42, type: "code" },
      { offset: 101, length: 2, type: "custom_emoji", custom_emoji_id: "5469718869536940860" },
      { offset: 104, length: 22, type: "italic" },
      { offset: 128, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 131, length: 33, type: "bold" }
    ]
  },
  ton: {
    name: "TON Network",
    text:
      `🗓 የመረጡት ኔትወርክ: TON📱\n\n` +
      `📊 የመላኪያ አድራሻ:⬇️\n\n` +
      `🕯 Address : UQBnagfOnShZYOgwPOfCy5Jx5dr80D9p4laxNvORleI4YT9j\n\n` +
      `👆 Address በመንካት Copy አርጉ\n\n` +
      `⬇️ USDT ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦`,
    entities: [
      { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5413879192267805083" },
      { offset: 3, length: 14, type: "bold" },
      { offset: 19, length: 2, type: "custom_emoji", custom_emoji_id: "5359320566304096699" },
      { offset: 23, length: 2, type: "custom_emoji", custom_emoji_id: "5931485612577136501" },
      { offset: 26, length: 11, type: "bold" },
      { offset: 37, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 41, length: 2, type: "custom_emoji", custom_emoji_id: "5451882707875276247" },
      { offset: 44, length: 9, type: "bold" },
      { offset: 54, length: 48, type: "code" },
      { offset: 104, length: 2, type: "custom_emoji", custom_emoji_id: "5469718869536940860" },
      { offset: 107, length: 22, type: "italic" },
      { offset: 131, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 134, length: 33, type: "bold" }
    ]
  },
  ltc: {
    name: "Litecoin (LTC)",
    text:
      `🗓 የመረጡት ኔትወርክ: LTC🪙\n\n` +
      `📊 የመላኪያ አድራሻ:⬇️\n\n` +
      `🕯 Address : LMSESUBB5Ee9JschXusNrqKTQjMSr4d6sc\n\n` +
      `👆 Address በመንካት Copy አርጉ\n\n` +
      `⬇️ USDT ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦`,
    entities: [
      { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5413879192267805083" },
      { offset: 3, length: 14, type: "bold" },
      { offset: 19, length: 2, type: "custom_emoji", custom_emoji_id: "5829979991886011025" },
      { offset: 23, length: 2, type: "custom_emoji", custom_emoji_id: "5231200819986047254" },
      { offset: 26, length: 11, type: "bold" },
      { offset: 37, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 41, length: 2, type: "custom_emoji", custom_emoji_id: "5451882707875276247" },
      { offset: 44, length: 9, type: "bold" },
      { offset: 54, length: 34, type: "code" },
      { offset: 90, length: 2, type: "custom_emoji", custom_emoji_id: "5469718869536940860" },
      { offset: 93, length: 22, type: "italic" },
      { offset: 117, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 120, length: 33, type: "bold" }
    ]
  },
  aptos: {
    name: "Aptos (APT)",
    text:
      `🗓 የመረጡት ኔትወርክ: Aptos😟\n\n` +
      `📊 የመላኪያ አድራሻ:⬇️\n\n` +
      `🕯 Address : 0xfb5ba0a2f6ea28cdaa4a5f1732ae94d88ac547279909e98768edc57607d53a72\n\n` +
      `👆 Address በመንካት Copy አርጉ\n\n` +
      `⬇️ USDT ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦`,
    entities: [
      { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5413879192267805083" },
      { offset: 3, length: 14, type: "bold" },
      { offset: 21, length: 2, type: "custom_emoji", custom_emoji_id: "5327975761833913214" },
      { offset: 25, length: 2, type: "custom_emoji", custom_emoji_id: "5042290883949495533" },
      { offset: 28, length: 11, type: "bold" },
      { offset: 39, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 43, length: 2, type: "custom_emoji", custom_emoji_id: "6001226849147951932" },
      { offset: 46, length: 9, type: "bold" },
      { offset: 56, length: 66, type: "code" },
      { offset: 124, length: 2, type: "custom_emoji", custom_emoji_id: "5469718869536940860" },
      { offset: 127, length: 22, type: "italic" },
      { offset: 151, length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
      { offset: 154, length: 33, type: "bold" }
    ]
  }
};

// SELL: user text messages
async function handleMessage(ctx) {
  const { msg, user, text, userId } = ctx;

  // Entry: "🔴 USDT መሸጥ"
  if (text === "🔴 USDT መሸጥ") {
    if (await checkPaused(userId)) return true;

    user.step = "awaiting_sell_agree";
    user.tempOrder = {};
    await user.save();

    const t = createText();

    t.add("🔥", "5039644681583985437");
    t.add("የ USDT መሸጫ ገጽ (SELL USDT)", null, true);
    t.add("\n━━━━━━━━━━━━━━━━━━━━━\n");

    t.add("📊", "5042290883949495533");
    t.add(" የዛሬ የመሸጫ ተመኖች (Rates)፦", null, true);
    t.add("\n\n");

    t.add("✅", "6267008582294705964");
    t.add("0.5 - 0.9");
    t.add("💵", "5409048419211682843");
    t.add(`${exchangeRates.tier1} ETB`, null, true);
    t.add("\n");

    t.add("✅", "6267008582294705964");
    t.add("1.0 - 10 ");
    t.add("💵", "5409048419211682843");
    t.add(`${exchangeRates.tier2} ETB`, null, true);
    t.add("\n");

    t.add("✅", "6267008582294705964");
    t.add(" 11 - 30 ");
    t.add("💵", "5409048419211682843");
    t.add(` ${exchangeRates.tier3} ETB`, null, true);
    t.add("\n");

    t.add("✅", "6267008582294705964");
    t.add(" 31+      ");
    t.add("💵", "5409048419211682843");
    t.add(`  ${exchangeRates.tier4} ETB`, null, true);
    t.add("\n\n");

    t.add("🔽", "5447183459602669338");
    t.add("ዝቅተኛ የመሸጫ መጠን፦ 0.5 USDT", null, true);
    t.add("\n\n");

    t.add("👇", "5231102735817918643");
    t.add(" ለመቀጠል «");
    t.add("✅", "6267008582294705964");
    t.add("ተስማምቻለሁ", null, true);
    t.add("» የሚለውን ይጫኑ፡-");

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

  // Agree
  if (text === "✅ ተስማምቻለሁ" && user.step === "awaiting_sell_agree") {
    user.step = "awaiting_amount";
    user.tempOrder = {};
    await user.save();

    const t = createText();
    t.add("💰", "5039789890133296083");
    t.add(" ");
    t.add("የሚሸጡትን የ USDT መጠን ያስገቡ፦", null, true);
    t.add("\n\n");
    t.add("🚫", "5039671744172917707");
    t.add("ዝቅተኛው መጠን 0.5 USDT ነው", null, false, "italic");

    await tg("sendMessage", {
      chat_id: userId,
      text: t.text,
      entities: t.entities,
      reply_markup: { keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]], resize_keyboard: true }
    });
    return true;
  }

  // Amount
  if (user.step === "awaiting_amount") {
    const amt = parseFloat(text);
    if (isNaN(amt) || amt < 0.5) {
      const t = createText();
      t.add("‼️", "4958534696645428119");
      t.add("እባክዎ ትክክለኛ መጠን ያስገቡ (ዝቅተኛው 0.5 USDT)፦", null, true);

      await tg("sendMessage", { chat_id: userId, text: t.text, entities: t.entities });
      return true;
    }

    const rate = getRate(amt);
    const total = amt * rate;

    user.tempOrder = { amount: amt, rate, total };
    user.step = "awaiting_network";
    await user.save();

    const netKeyboard = {
      inline_keyboard: [
        [
          { text: "Binance Uid", icon_custom_emoji_id: "5931458068951865704", callback_data: "net:binance" },
          { text: "Bep20", icon_custom_emoji_id: "5397896059886253421", callback_data: "net:bep20" }
        ],
        [
          { text: "Ton Network", icon_custom_emoji_id: "5359320566304096699", callback_data: "net:ton" },
          { text: "LiteCoin (Ltc)", icon_custom_emoji_id: "5829979991886011025", callback_data: "net:ltc" }
        ],
        [
          { text: "Aptos", icon_custom_emoji_id: "5327975761833913214", callback_data: "net:aptos" }
        ]
      ]
    };

    const totalStr = `${total.toLocaleString()} ETB`;

    const t = createText();
    t.add("🔥", "4956499161319998529");
    t.add(" ");
    t.add("መጠን:", null, true);
    t.add(` ${amt} USDT\n`);
    t.add("🕯", "4956492465465984073");
    t.add(" ");
    t.add("ተመን:", null, true);
    t.add(` 1 USDT = ${rate} ETB\n`);
    t.add("💰", "4958926882994127612");
    t.add(" ");
    t.add("የሚቀበሉት ድምር:", null, true);
    t.add(" ");
    t.add(totalStr, null, true);
    t.add("\n\n");
    t.add("⬇️", "5406745015365943482");
    t.add(" ");
    t.add("USDT የሚልኩበትን ኔትወርክ ይምረጡ፦", null, true);

    await tg("sendMessage", {
      chat_id: userId,
      text: t.text,
      entities: t.entities,
      reply_markup: netKeyboard
    });
    return true;
  }

  // Account (Telebirr / CBE)
  if (user.step === "awaiting_account") {
    const cleanAcc = text.replace(/\s+/g, "");
    const method = (user.tempOrder && user.tempOrder.method) || "Telebirr";

    if (method === "Telebirr" && !/^09\d{8}$/.test(cleanAcc)) {
      const t = createText();
      t.add("🏦", "5931638668031695373");
      t.add("የቴሌብር ቁጥር 09 የሚጀምር 10 ድጅት መሆን አለበት! ደግመው በትክክል ያስገቡ፦", null, true);
      await tg("sendMessage", { chat_id: userId, text: t.text, entities: t.entities });
      return true;
    }
    if (method === "CBE" && !/^\d{13}$/.test(cleanAcc)) {
      const t = createText();
      t.add("🏦", "5931351583827696128");
      t.add(" ");
      t.add("የንግድ ባንክ (CBE) አካውንት 13 ድጅት መሆን አለበት! ደግመው በትክክል ያስገቡ፦", null, true);
      await tg("sendMessage", { chat_id: userId, text: t.text, entities: t.entities });
      return true;
    }

    user.tempOrder = { ...(user.tempOrder || {}), account: cleanAcc };
    user.step = "awaiting_name";
    await user.save();

    const t = createText();
    t.add("✅", "6267008582294705964");
    t.add(" ");
    t.add("የአካውንቱን ሙሉ ስም ያስገቡ፦", null, true);

    await tg("sendMessage", { chat_id: userId, text: t.text, entities: t.entities });
    return true;
  }

  // Name
  if (user.step === "awaiting_name") {
    if (text.length < 3) {
      await tg("sendMessage", { chat_id: userId, text: "⚠️ እባክዎ ሙሉ ስም በትክክል ያስገቡ፦" });
      return true;
    }

    user.tempOrder = { ...(user.tempOrder || {}), name: text };
    user.step = "awaiting_screenshot";
    await user.save();

    const t = createText();
    t.add("✅", "6267008582294705964");
    t.add("የመጨረሻ ደረጃ፦", null, true);
    t.add("\n\nየላኩበትን ደረሰኝ");
    t.add("🗓", "4956214413578207998");
    t.add(" ");
    t.add("(Screenshot ፎቶ)", null, true);
    t.add(" አሁን ይላኩ፦");

    await tg("sendMessage", { chat_id: userId, text: t.text, entities: t.entities });
    return true;
  }

  // Screenshot
  if (user.step === "awaiting_screenshot") {
    if (!msg.photo || msg.photo.length === 0) {
      await tg("sendMessage", { chat_id: userId, text: "⚠️ እባክዎ የከፈሉበትን ደረሰኝ በፎቶ (Screenshot) መልክ ይላኩ፦" });
      return true;
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const orderId = `SELL-${Date.now()}`;
    const orderData = user.tempOrder || {};
    const method = orderData.method || "Telebirr";
    const account = orderData.account || "0987654321";
    const amount = Number(orderData.amount) || 4;
    const total = Number(orderData.total) || 720;

    try {
      const newOrder = await Order.create({
        orderId: orderId,
        orderType: "sell",
        userId: userId,
        userName: orderData.name || msg.from.first_name || "ደንበኛ",
        telegramUsername: msg.from.username || "",
        amount: amount,
        total: total,
        rate: Number(orderData.rate) || 0,
        account: account,
        method: method,
        network: orderData.networkName || "N/A",
        networkKey: orderData.networkKey || "",
        customerProofFileId: fileId,
        status: "pending"
      });

      user.step = "pending";
      user.tempOrder = {};
      await user.save();

      const isTele = method === "Telebirr";
      const t = createText();
      t.add("🎉", "5039529134078821602");
      t.add(" ትዕዛዝዎ በተሳካ ሁኔታ ደርሷል");
      t.add("✅", isTele ? "4958610528588008305" : "6266967801580231067");
      t.add("\n━━━━━━━━━━━━━━━━━━\n\n");
      t.add("💵", isTele ? "4956601935592424315" : "5965043124068687455");
      t.add(` መጠን: ${amount} USDT\n`);
      t.add("💰", isTele ? "4958926882994127612" : "6267068789146260253");
      t.add(` የሚከፈለው: ${total} ETB\n`);
      t.add("🖥", "5282843764451195532");
      t.add(` ወደ: ${isTele ? "Telebirr" : "CBE"}`);
      t.add("🏦", isTele ? "5931638668031695373" : "5931351583827696128");
      t.add(" (");
      t.add(String(account), null, false, isTele ? "phone_number" : null);
      t.add(")\n\nአድሚኑ ደረሰኙን አረጋግጦ ክፍያውን ወዲያውኑ ገቢ ያደርጋል");
      t.add("✅", "6266967801580231067");
      t.add("!");

      await tg("sendMessage", {
        chat_id: userId,
        text: t.text,
        entities: t.entities,
        reply_markup: {
          keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]],
          resize_keyboard: true
        }
      });

      const adminCaption =
        `🚨 <b>አዲስ P2P የሽያጭ ትዕዛዝ (Sell Order)</b>\n━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>ስም:</b> ${escapeHTML(orderData.name || msg.from.first_name || "ደንበኛ")} (@${msg.from.username || "የለውም"})\n` +
        `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
        `💵 <b>USDT:</b> ${amount}\n` +
        `📈 <b>Rate:</b> ${orderData.rate || 0} ETB\n` +
        `💰 <b>Total:</b> ${Number(total).toLocaleString()} ETB\n` +
        `🌐 <b>Network:</b> ${escapeHTML(orderData.networkName || "N/A")}\n` +
        `🏦 <b>Method:</b> ${escapeHTML(method)}\n` +
        `📱 <b>Account:</b> <code>${escapeHTML(account)}</code>\n━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Order:</b> <code>${orderId}</code>`;

      const adminKeyboard = {
        inline_keyboard: [
          [
            { text: "📸 ደረሰኝ ልከህ አጽድቅ", callback_data: `receipt:${orderId}` },
            { text: "✅ Quick Approve", callback_data: `quick_approve:${orderId}` }
          ],
          [
            { text: "❌ Decline", callback_data: `decline:${orderId}` },
            { text: "🚫 Ban User", callback_data: `ban_user:${userId}` }
          ]
        ]
      };

      const sentAdminMsg = await tg("sendPhoto", {
        chat_id: ADMIN_CHAT_ID,
        photo: fileId,
        caption: adminCaption,
        parse_mode: "HTML",
        reply_markup: adminKeyboard
      });

      if (sentAdminMsg && sentAdminMsg.message_id) {
        newOrder.adminMessageId = sentAdminMsg.message_id;
        await newOrder.save();
      }
    } catch (err) {
      console.error("Sell Order save error:", err);
      await tg("sendMessage", {
        chat_id: userId,
        text: "⚠️ በትዕዛዝ ምዝገባ ወቅት ችግር አጋጥሟል። እባክዎ በ /start እንደገና ይሞክሩ።"
      });
    }
    return true;
  }

  return false;
}

// SELL: user callbacks (net:, pay:)
async function handleUserCallback(callback) {
  const data = callback.data || "";
  const cbUserId = callback.from.id;

  // Network chosen
  if (data.startsWith("net:")) {
    const netKey = data.replace("net:", "");
    const selectedNet = cryptoNetworks[netKey];
    const user = await User.findOne({ telegramId: cbUserId });

    await answerCb(callback.id);

    if (user && selectedNet && user.step === "awaiting_network") {
      user.tempOrder = { ...(user.tempOrder || {}), networkKey: netKey, networkName: selectedNet.name };
      user.step = "awaiting_method";
      await user.save();

      const methodKeyboard = {
        inline_keyboard: [
          [
            { text: "ቴሌብር (Telebirr)", icon_custom_emoji_id: "5805526032945519867", callback_data: "pay:Telebirr" }
          ],
          [
            { text: "ንግድ ባንክ (CBE)", icon_custom_emoji_id: "5805572156599312646", callback_data: "pay:CBE" }
          ]
        ]
      };

      await tg("sendMessage", {
        chat_id: cbUserId,
        text: selectedNet.text,
        entities: selectedNet.entities,
        reply_markup: methodKeyboard
      });
    }
    return;
  }

  // Payout method chosen
  if (data.startsWith("pay:")) {
    const method = data.replace("pay:", "");
    const user = await User.findOne({ telegramId: cbUserId });

    await answerCb(callback.id);

    if (user && user.step === "awaiting_method") {
      user.tempOrder = { ...(user.tempOrder || {}), method: method };
      user.step = "awaiting_account";
      await user.save();

      const t = createText();

      if (method === "Telebirr") {
        t.add("🏦", "5931638668031695373");
        t.add(" የቴሌብር ስልክ ቁጥርዎን ያስገቡ፦\n\n");
        t.add("✔️", "6217721388736712699");
        t.add("ለምሳሌ፦ ");
        t.add("0912345678", null, false, "phone_number");
      } else {
        t.add("🏦", "5931351583827696128");
        t.add(" የኢትዮጵያ ንግድ ባንክ (CBE) 13 ድጅት አካውንት ቁጥር ያስገቡ፦\n\n");
        t.add("😬", "6217508525862555336");
        t.add("ለምሳሌ:- 1000123456789");
      }

      await tg("sendMessage", { chat_id: cbUserId, text: t.text, entities: t.entities });
    }
    return;
  }
}

// SELL: admin callbacks (receipt, quick_approve, decline)
async function handleAdminCallback(ctx) {
  const { callback, action, orderId, order } = ctx;

  if (!["receipt", "quick_approve", "decline"].includes(action)) return false;

  if (order.orderType !== "sell") {
    await answerCb(callback.id, "⚠️ ይህ የሽያጭ ትዕዛዝ አይደለም!", true);
    return true;
  }

  if (action === "receipt") {
    state.pendingReceiptOrder = orderId;
    if (callback.message?.message_id && !order.adminMessageId) {
      order.adminMessageId = callback.message.message_id;
      await order.save();
    }
    await answerCb(callback.id);
    await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: "📸 የከፈሉበትን ደረሰኝ Screenshot አሁን ይላኩ (ለመሰረዝ /cancel)፦" });
    return true;
  }

  if (action === "quick_approve") {
    order.status = "approved";
    await order.save();

    await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);

    const sellDoneMsg =
      `🎉 <b>ትዕዛዝዎ ጸድቋል!</b> ✅\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 <b>መጠን:</b> ${order.amount} USDT\n` +
      `💰 <b>የተከፈለ ብር:</b> ${Number(order.total || 0).toLocaleString()} ETB\n` +
      `🏦 <b>ወደ አካውንትዎ (${escapeHTML(order.method)}):</b> <code>${escapeHTML(order.account)}</code>\n\n` +
      `ክፍያዎ በተሳካ ሁኔታ ተፈጽሟል! ከUnique P2P ጋር ስለሰሩ እናመሰግናለን❤️‍🔥!`;

    try {
      await tg("sendMessage", {
        chat_id: order.userId,
        text: sellDoneMsg,
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard
      });
    } catch (e) {}

    await answerCb(callback.id, "✅ Sell Order Approved!");
    return true;
  }

  if (action === "decline") {
    await declineOrder(order, callback);
    return true;
  }

  return false;
}

module.exports = { handleMessage, handleUserCallback, handleAdminCallback };
