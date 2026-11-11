const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "").trim();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "my_p2p_secret_key";
const MONGO_URI = process.env.MONGO_URI;
const BOT_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CHANNEL_ID = "@Unique_techs";

const BANNER_IMAGE_URL = "https://i.postimg.cc/L88G59b1/IMG-20261103-102834-245.jpg"; 
const STATS_BANNER_URL = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80";

// Schemas
const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String, default: "" },
  firstName: { type: String, default: "" },
  isBanned: { type: Boolean, default: false },
  step: { type: String, default: "idle" },
  tempOrder: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: Number, required: true },
  userName: { type: String, default: "" },
  telegramUsername: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  account: { type: String, default: "N/A" },
  method: { type: String, default: "N/A" },
  network: { type: String, default: "N/A" },
  status: { type: String, enum: ["pending", "approved", "declined"], default: "pending" },
  customerProofFileId: String,
  receiptFileId: String,
  adminMessageId: Number,
  createdAt: { type: Date, default: Date.now }
});

const SettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  isPaused: { type: Boolean, default: false },
  pauseReason: { type: String, default: "ቦቱ ለአጭር ጊዜ ጥገና ቆሟል። እባክዎ ጥቂት ቆይተው ይሞክሩ።" }
});

const RateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  tier1: { type: Number, default: 178 },
  tier2: { type: Number, default: 180 },
  tier3: { type: Number, default: 182 },
  tier4: { type: Number, default: 185 }
});

const User = mongoose.model("V2_User", UserSchema);
const Order = mongoose.model("V2_Order", OrderSchema);
const Settings = mongoose.model("Settings", SettingsSchema);
const Rate = mongoose.model("Rate", RateSchema);

let pendingReceiptOrder = null;

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
  }
};

let exchangeRates = { tier1: 178, tier2: 180, tier3: 182, tier4: 185 };

async function initRates() {
  try {
    let savedRate = await Rate.findOne({ key: "v2_rates" });
    if (!savedRate) {
      savedRate = await Rate.create({ key: "v2_rates", tier1: 178, tier2: 180, tier3: 182, tier4: 185 });
    }
    exchangeRates = { tier1: savedRate.tier1, tier2: savedRate.tier2, tier3: savedRate.tier3, tier4: savedRate.tier4 };
  } catch (err) {
    console.error("Rates loading error:", err.message);
  }
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    initRates();
  })
  .catch(err => console.error("MongoDB error:", err));

function getRate(amount) {
  if (amount >= 0.5 && amount < 1) return exchangeRates.tier1;
  if (amount >= 1 && amount <= 10) return exchangeRates.tier2;
  if (amount > 10 && amount <= 30) return exchangeRates.tier3;
  if (amount > 30) return exchangeRates.tier4;
  return exchangeRates.tier2;
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function telegram(method, body) {
  const response = await fetch(`${BOT_API}/${method}`, body);
  const result = await response.json();
  if (!result.ok) {
    console.error(`Telegram API Error [${method}]:`, result);
    throw new Error(result.description || "Telegram API error");
  }
  return result.result;
}

async function clearAdminOrderButtons(messageId) {
  if (!messageId) return;
  try {
    await telegram("editMessageReplyMarkup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] }
      })
    });
  } catch (e) {
    console.error("Clear admin buttons error:", e.message);
  }
}

const CUSTOM_EMOJI_IDS = [
  "5039644681583985437",
  "5911078333168227043",
  "5271837459783638319",
  "5197288647275071607",
  "5040025580758631490",
  "5456140674028019486",
  "5406745015365943482"
];

async function buildCustomEmojiEntities(text) {
  try {
    const stickers = await telegram("getCustomEmojiStickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        custom_emoji_ids: CUSTOM_EMOJI_IDS
      })
    });

    const entities = [];

    for (const sticker of stickers) {
      const emoji = sticker.emoji;
      if (!emoji || !sticker.custom_emoji_id) continue;

      const offset = text.indexOf(emoji);
      if (offset === -1) continue;

      entities.push({
        type: "custom_emoji",
        offset: offset,
        length: emoji.length,
        custom_emoji_id: sticker.custom_emoji_id
      });
    }

    return entities.sort((a, b) => a.offset - b.offset);
  } catch (error) {
    console.error("Custom Emoji Error:", error.message);
    return [];
  }
}

async function checkMembership(userId) {
  try {
    const res = await telegram("getChatMember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL_ID, user_id: userId })
    });
    return ["creator", "administrator", "member"].includes(res.status);
  } catch (err) {
    return false;
  }
}

const mainMenuKeyboard = {
  keyboard: [
    [{ text: "💵 USDT መሸጥ" }, { text: "🛒 USDT መግዛት" }],
    [{ text: "📊 የዛሬ ተመን" }, { text: "📜 የትዕዛዝ ታሪክ" }],
    [{ text: "📞 ድጋፍ / አድሚን" }]
  ],
  resize_keyboard: true
};

const backToMainKeyboard = {
  keyboard: [[{ text: "🔙 ወደ ዋናው ሜኑ ተመለስ" }]],
  resize_keyboard: true
};

async function sendMainMenu(chatId, text) {
  await telegram("sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text || "👇 ከታች ካሉት አማራጮች አንዱን ይምረጡ፦",
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard
    })
  });
}

// Webhook
app.post("/telegram-webhook", async (req, res) => {
  if (req.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }
  res.sendStatus(200);

  try {
    const msg = req.body.message;
    const callback = req.body.callback_query;
    const senderId = String(msg?.from?.id || callback?.from?.id || "").trim();
    const isAdmin = senderId === ADMIN_CHAT_ID;

    // 1. አድሚን ደረሰኝ ፎቶ ሲልክ
    if (msg && isAdmin && pendingReceiptOrder) {
      if (msg.photo && msg.photo.length > 0) {
        const order = await Order.findOne({ orderId: pendingReceiptOrder });
        if (order && order.status === "pending") {
          order.status = "approved";
          const adminReceiptPhotoId = msg.photo[msg.photo.length - 1].file_id;
          order.receiptFileId = adminReceiptPhotoId;
          await order.save();

          await clearAdminOrderButtons(order.adminMessageId);

          const bankEmojiId = order.method === "CBE" ? "5805572156599312646" : "5931638668031695373";
          const amountStr = `${order.amount} USDT`;
          const totalStr = `${Number(order.total || 0).toLocaleString()} ETB`;
          const headerStr = "የትዕዛዝ ማረጋገጫ እና ደረሰኝ፦";

          const userMsg =
            `✔️ ${headerStr}\n\n` +
            `የ${amountStr}💵 ሽያጭ ትዕዛዝዎ ጸድቋል!✅\n\n` +
            ` 🍾${totalStr} ወደ ${order.method}🏦 አካውንትዎ ገቢ ተደርጓል።\n\n` +
            ` ከUnique P2P ጋር ስለሰሩ እናመሰግናለን❤️‍🔥!`;

          const userEntities = [
            { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5039844895779455925" },
            { offset: userMsg.indexOf(headerStr), length: headerStr.length, type: "bold" },
            { offset: userMsg.indexOf(amountStr), length: amountStr.length, type: "bold" },
            { offset: userMsg.indexOf("💵"), length: 2, type: "custom_emoji", custom_emoji_id: "5040025580758631490" },
            { offset: userMsg.indexOf("✅"), length: 1, type: "custom_emoji", custom_emoji_id: "6217663806110175239" },
            { offset: userMsg.indexOf("🍾"), length: 2, type: "custom_emoji", custom_emoji_id: "5042274086332400375" },
            { offset: userMsg.indexOf(totalStr), length: totalStr.length, type: "bold" },
            { offset: userMsg.indexOf("🏦"), length: 2, type: "custom_emoji", custom_emoji_id: bankEmojiId },
            { offset: userMsg.indexOf("❤️‍🔥"), length: 5, type: "custom_emoji", custom_emoji_id: "4956222745814762495" }
          ];

          try {
            await telegram("sendPhoto", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: order.userId,
                photo: adminReceiptPhotoId,
                caption: userMsg,
                caption_entities: userEntities
              })
            });
          } catch (e) {
            console.error("User receipt send error:", e.message);
          }

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: msg.chat.id, text: `✅ ደረሰኙ ለተጠቃሚው በተሳካ ሁኔታ ተልኳል!` })
          });

          pendingReceiptOrder = null;
          return;
        }
      } else if (msg.text === "/cancel") {
        pendingReceiptOrder = null;
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: `❌ የደረሰኝ መላክ ሂደት ተሰርዟል።` })
        });
        return;
      }
    }

    // 2. የአድሚን ትዕዛዞች
    if (msg && msg.text && isAdmin) {
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

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: statsMsg, parse_mode: "HTML" })
        });
        return;
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
        await telegram("sendPhoto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: msg.chat.id,
            photo: STATS_BANNER_URL,
            caption: staticsCaption,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔐 Admin Panel", callback_data: "open_admin_panel" }]] }
          })
        });
        return;
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

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: dailyMsg, parse_mode: "HTML" })
        });
        return;
      }

      if (text.startsWith("/broadcast ")) {
        const broadcastMsg = text.replace("/broadcast ", "").trim();
        if (!broadcastMsg) return;

        const allUsers = await User.find({}, "telegramId");
        let successCount = 0;

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: `📢 መልእክት ለ ${allUsers.length} ተጠቃሚዎች እየተላከ ነው...` })
        });

        for (const u of allUsers) {
          try {
            await telegram("sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: u.telegramId, text: broadcastMsg, parse_mode: "HTML" })
            });
            successCount++;
          } catch (e) {}
        }

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: `✅ ብሮድካስት ተጠናቋል! ለ ${successCount} ተጠቃሚዎች ደርሷል።` })
        });
        return;
      }

      if (text.startsWith("/send ")) {
        const parts = text.split(" ");
        const targetId = parts[1];
        const directMsg = parts.slice(2).join(" ").trim();

        if (!targetId || !directMsg) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: msg.chat.id, text: "⚠️ አጠቃቀም፦ <code>/send &lt;user_id&gt; &lt;መልእክት&gt;</code>", parse_mode: "HTML" })
          });
          return;
        }

        try {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetId, text: `📩 <b>ከአድሚን የተላከ መልእክት፦</b>\n\n${directMsg}`, parse_mode: "HTML" })
          });
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: msg.chat.id, text: `✅ መልእክቱ ለ <code>${targetId}</code> ተልኳል!`, parse_mode: "HTML" })
          });
        } catch (err) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: msg.chat.id, text: `❌ መልእክቱን መላክ አልተቻለም። ተጠቃሚው ቦቱን ዘግቶት ሊሆን ይችላል።` })
          });
        }
        return;
      }

      if (text.startsWith("/ban ")) {
        const targetId = Number(text.split(" ")[1]);
        if (targetId) {
          await User.findOneAndUpdate({ telegramId: targetId }, { isBanned: true });
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: msg.chat.id, text: `🚫 ተጠቃሚ <code>${targetId}</code> ታግዷል!`, parse_mode: "HTML" })
          });
          return;
        }
      }

      if (text.startsWith("/unban ")) {
        const targetId = Number(text.split(" ")[1]);
        if (targetId) {
          await User.findOneAndUpdate({ telegramId: targetId }, { isBanned: false });
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: msg.chat.id, text: `✅ ተጠቃሚ <code>${targetId}</code> ተነስቷል!`, parse_mode: "HTML" })
          });
          return;
        }
      }

      if (text.startsWith("/pause")) {
        const reason = text.replace("/pause", "").trim() || "ቦቱ ለአጭር ጊዜ ጥገና ቆሟል።";
        await Settings.findOneAndUpdate({ key: "v2_settings" }, { isPaused: true, pauseReason: reason }, { upsert: true });
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: `⏸️ ቦቱ ቆሟል!` })
        });
        return;
      }

      if (text === "/resume") {
        await Settings.findOneAndUpdate({ key: "v2_settings" }, { isPaused: false }, { upsert: true });
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: `▶️ ቦቱ ስራ ጀምሯል!` })
        });
        return;
      }

      if (text.startsWith("/setrates")) {
        const p = text.split(/\s+/).filter(x => x.trim() !== "");
        if (p.length >= 5) {
          const t1 = Number(p[1]);
          const t2 = Number(p[2]);
          const t3 = Number(p[3]);
          const t4 = Number(p[4]);

          if (!isNaN(t1) && !isNaN(t2) && !isNaN(t3) && !isNaN(t4)) {
            exchangeRates = { tier1: t1, tier2: t2, tier3: t3, tier4: t4 };
            
            await Rate.findOneAndUpdate(
              { key: "v2_rates" },
              { $set: { tier1: t1, tier2: t2, tier3: t3, tier4: t4 } },
              { upsert: true, new: true }
            );

            await telegram("sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: msg.chat.id,
                text: `✅ <b>ተመኖች በተሳካ ሁኔታ ተቀይረዋል!</b>\n━━━━━━━━━━━━━━━━━━\n🔹 0.5 - 0.9 USDT ➡️ <b>${t1} ETB</b>\n🔹 1.0 - 10 USDT ➡️ <b>${t2} ETB</b>\n🔹 11 - 30 USDT ➡️ <b>${t3} ETB</b>\n🔥 31+ USDT ➡️ <b>${t4} ETB</b>`,
                parse_mode: "HTML"
              })
            });
            return;
          }
        }

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: msg.chat.id,
            text: "⚠️ <b>ስህተት፦</b> እባክዎ 4ቱን ተመኖች በክፍተት አስገብተው ይላኩ!\n\n<i>ለምሳሌ፦</i> <code>/setrates 178 180 182 185</code>",
            parse_mode: "HTML"
          })
        });
        return;
      }
    }

    // 3. የተጠቃሚ የንግድ ሂደት
    if (msg && msg.from) {
      const userId = msg.from.id;
      let user = await User.findOne({ telegramId: userId });

      if (user && user.isBanned) {
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: userId, text: "🚫 አካውንትዎ ታግዷል!" })
        });
        return;
      }

      if (!user) {
        user = await User.create({
          telegramId: userId,
          username: msg.from.username || "",
          firstName: msg.from.first_name || "",
          step: "idle"
        });
      }

      const isMember = await checkMembership(userId);
      if (!isMember) {
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: `👋 <b>እንኳን ወደ Unique P2P በደህና መጡ!</b>\n\nቦቱን ለመጠቀም እባክዎ መጀመሪያ ቻናላችንን ይቀላቀሉ፦`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📢 ቻናል ተቀላቀል (@Unique_techs)", url: "https://t.me/Unique_techs" }],
                [{ text: "✅ ተቀላቅያለሁ (Verify)", callback_data: "check_join" }]
              ]
            }
          })
        });
        return;
      }

      const text = msg.text ? msg.text.trim() : "";

      if (text === "/start" || text === "❌ ሰርዝ (Cancel)") {
        user.step = "idle";
        user.tempOrder = {};
        await user.save();

        const welcomeCaption = "🔥 እንኳን ወደ Unique P2P Store🇪🇹 በደህና መጡ!↔️\n\n ደህንነቱ የተጠበቀ🛡 እና እጅግ ፈጣን የ USDT💵 መገበያያ ቤት!⚡️\n\n ⬇️ የሚፈልጉትን አገልግሎት ከታች ካሉት አማራጮች ይምረጡ፡-";

        const welcomeEntities = await buildCustomEmojiEntities(welcomeCaption);

        await telegram("sendPhoto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            photo: BANNER_IMAGE_URL,
            caption: welcomeCaption,
            caption_entities: welcomeEntities,
            reply_markup: mainMenuKeyboard
          })
        });
        return;
      }

      if (text === "🔙 ወደ ዋናው ሜኑ ተመለስ") {
        user.step = "idle";
        user.tempOrder = {};
        await user.save();

        // 1. መጀመሪያ "ወደ ዋናው ሜኑ ተመልሰዋል!" የሚለውን መልዕክት ይልካል
        const backConfirmText = "✅ ወደ ዋናው ሜኑ ተመልሰዋል!";
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: backConfirmText,
            entities: [
              { offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" },
              { offset: 2, length: backConfirmText.length - 2, type: "bold" }
            ]
          })
        });

        // 2. ወዲያውኑ Welcome Banner እና ዋናውን ሜኑ ኪቦርድ ይልካል
        const welcomeCaption = "🔥 እንኳን ወደ Unique P2P Store🇪🇹 በደህና መጡ!↔️\n\n ደህንነቱ የተጠበቀ🛡 እና እጅግ ፈጣን የ USDT💵 መገበያያ ቤት!⚡️\n\n ⬇️ የሚፈልጉትን አገልግሎት ከታች ካሉት አማራጮች ይምረጡ፡-";
        const welcomeEntities = await buildCustomEmojiEntities(welcomeCaption);

        await telegram("sendPhoto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            photo: BANNER_IMAGE_URL,
            caption: welcomeCaption,
            caption_entities: welcomeEntities,
            reply_markup: mainMenuKeyboard
          })
        });
        return;
      }

      if (text === "📊 የዛሬ ተመን") {
        const rateText = 
          `🥳የዛሬ የ USDT መሸጫ ዋጋዎች፦\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `✅ 0.5 - 0.9💵 ${exchangeRates.tier1} ETB\n` +
          `✅1.0 - 10 💵 ${exchangeRates.tier2} ETB\n` +
          `✅ 11 - 30 💵 ${exchangeRates.tier3} ETB\n` +
          `✅ 31+      💵  ${exchangeRates.tier4} ETB (ምርጥ ተመን)\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `ለመሸጥ "✔️ USDT መሸጥ" የሚለውን ይጫኑ!`;

        const rateEmojis = [
          { char: "🥳", id: "6217716209006153211" },
          { char: "✅", id: "6217663806110175239" },
          { char: "💵", id: "5040025580758631490" },
          { char: "✅", id: "6217663806110175239" },
          { char: "💵", id: "5040025580758631490" },
          { char: "✅", id: "6217663806110175239" },
          { char: "💵", id: "5040025580758631490" },
          { char: "✅", id: "6217663806110175239" },
          { char: "💵", id: "4956601935592424315" },
          { char: "✔️", id: "5039844895779455925" }
        ];

        const rateEntities = [];
        let searchFrom = 0;

        for (const item of rateEmojis) {
          const idx = rateText.indexOf(item.char, searchFrom);
          if (idx !== -1) {
            rateEntities.push({
              type: "custom_emoji",
              offset: idx,
              length: item.char.length,
              custom_emoji_id: item.id
            });
            searchFrom = idx + item.char.length;
          }
        }

        const boldPhrases = [
          "የዛሬ የ USDT መሸጫ ዋጋዎች፦",
          `${exchangeRates.tier1} ETB`,
          `${exchangeRates.tier2} ETB`,
          `${exchangeRates.tier3} ETB`,
          `${exchangeRates.tier4} ETB (ምርጥ ተመን)`
        ];

        for (const phrase of boldPhrases) {
          const idx = rateText.indexOf(phrase);
          if (idx !== -1) {
            rateEntities.push({
              type: "bold",
              offset: idx,
              length: phrase.length
            });
          }
        }

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: rateText,
            entities: rateEntities.sort((a, b) => a.offset - b.offset),
            reply_markup: backToMainKeyboard
          })
        });
        return;
      }

      if (text === "🛒 USDT መግዛት") {
        const buyText =
          `🔼 USDT መግዛት\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `🔥 ይህ አገልግሎት በቅርቡ ይጀምራል፤ ዝግጅቱን እያጠናቀቅን ነው🍾።\n\n` +
          `📣አገልግሎቱ ክፍት ሲሆን ወዲያውኑ ማሳወቂያ ይደርሳችኋል። እባክዎ በትዕግስት ይጠብቁን!❤️‍🔥\n` +
          `━━━━━━━━━━━━━━━━━━━━`;

        const buyEntities = [
          { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5041845079229072486" },
          { offset: 3, length: 9, type: "bold" },
          { offset: 33, length: 2, type: "custom_emoji", custom_emoji_id: "5039644681583985437" },
          { offset: 36, length: 38, type: "italic" },
          { offset: 74, length: 2, type: "custom_emoji", custom_emoji_id: "5042274086332400375" },
          { offset: 76, length: 1, type: "italic" },
          { offset: 79, length: 2, type: "custom_emoji", custom_emoji_id: "5041888071851705019" },
          { offset: 81, length: 54, type: "italic" },
          { offset: 135, length: 5, type: "custom_emoji", custom_emoji_id: "5042225965518816316" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: buyText,
            entities: buyEntities
          })
        });
        return;
      }

      if (text === "📜 የትዕዛዝ ታሪክ") {
        const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
        if (!orders || orders.length === 0) {
          const emptyText = "📣 እስካሁን ምንም ዓይነት ትዕዛዝ አልፈጸሙም!";
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: emptyText,
              entities: [
                { type: "custom_emoji", offset: 0, length: 2, custom_emoji_id: "6267129592998270736" }
              ]
            })
          });
          return;
        }

        let historyText = "";
        const historyEntities = [];

        const addTextWithEmoji = (str, customEmojiId = null, isBold = false) => {
          const offset = historyText.length;
          historyText += str;
          if (customEmojiId) {
            historyEntities.push({
              type: "custom_emoji",
              offset,
              length: str.length,
              custom_emoji_id: customEmojiId
            });
          }
          if (isBold) {
            historyEntities.push({
              type: "bold",
              offset,
              length: str.length
            });
          }
        };

        // ርዕስ
        addTextWithEmoji("🕯", "4956492465465984073");
        addTextWithEmoji(" ");
        addTextWithEmoji("የቅርብ ጊዜ የትዕዛዝ ታሪክዎ፦", null, true);
        addTextWithEmoji("\n━━━━━━━━━━━━━━━━━━\n");

        orders.forEach(o => {
          // መጠን
          addTextWithEmoji("💵", "5040025580758631490");
          addTextWithEmoji(" ");
          addTextWithEmoji(`${o.amount} USDT`, null, true);
          addTextWithEmoji(` (${Number(o.total || 0).toLocaleString()} ETB)\n`);

          // ዘዴ (Telebirr vs CBE ሎጎ)
          addTextWithEmoji("📌", "5039600026809009149");
          addTextWithEmoji(` ዘዴ: ${o.method}`);
          if (o.method === "Telebirr") {
            addTextWithEmoji("🏦", "5805526032945519867");
          } else if (o.method === "CBE") {
            addTextWithEmoji("🏦", "5805572156599312646");
          } else {
            addTextWithEmoji("🏦");
          }

          // ሁኔታ (Approved / Declined / Pending)
          addTextWithEmoji(" | ሁኔታ: ");
          if (o.status === "approved") {
            addTextWithEmoji("✔️", "5039844895779455925");
            addTextWithEmoji(" ");
            addTextWithEmoji("ጸድቋል", null, true);
          } else if (o.status === "declined") {
            addTextWithEmoji("❌ ውድቅ", null, true);
          } else {
            addTextWithEmoji("⌛", "6267229004311303657");
            addTextWithEmoji(" ");
            addTextWithEmoji("በሂደት", null, true);
          }

          addTextWithEmoji("\n━━━━━━━━━━━━━━━━━━\n");
        });

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: historyText,
            entities: historyEntities
          })
        });
        return;
      }

      if (text === "📞 ድጋፍ / አድሚን") {
        const supportText = 
          `👨‍💻የደንበኞች ድጋፍ እና ማህበረሰብ\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `➡️ ማንኛውም ጥያቄ፣ አስተያየት ወይም እርዳታ ከፈለጉ በቀጥታ ያናግሩን፡-\n\n` +
          `🤝 Admin Support፦ @Aropc\n` +
          `✅ Channel፦ @Unique_techs\n\n` +
          `⏰የስራ ሰዓት፦ 24/7 ሁልጊዜ አለን!✅`;

        const supportEntities = [
          { offset: 0, length: 5, type: "custom_emoji", custom_emoji_id: "5190498849440931467" },
          { offset: 5, length: 24, type: "bold" },
          { offset: 52, length: 2, type: "custom_emoji", custom_emoji_id: "5042341817966658405" },
          { offset: 55, length: 44, type: "bold" },
          { offset: 101, length: 2, type: "custom_emoji", custom_emoji_id: "6264720734820505831" },
          { offset: 104, length: 14, type: "bold" },
          { offset: 126, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" },
          { offset: 128, length: 8, type: "bold" },
          { offset: 152, length: 1, type: "custom_emoji", custom_emoji_id: "6285240160120477644" },
          { offset: 153, length: 7, type: "bold" },
          { offset: 161, length: 15, type: "italic" },
          { offset: 176, length: 1, type: "custom_emoji", custom_emoji_id: "4958610528588008305" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: supportText,
            entities: supportEntities,
            reply_markup: backToMainKeyboard
          })
        });
        return;
      }

      if (text === "💵 USDT መሸጥ") {
        const botSettings = await Settings.findOne({ key: "v2_settings" });
        if (botSettings && botSettings.isPaused) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: botSettings.pauseReason || "⏸️ ቦቱ ለጊዜው ቆሟል።" })
          });
          return;
        }

        user.step = "awaiting_amount";
        user.tempOrder = {};
        await user.save();

        const sellPromptText = `💰 የሚሸጡትን የ USDT መጠን ያስገቡ፦\n\n🚫ዝቅተኛው መጠን 0.5 USDT ነው`;
        const sellPromptEntities = [
          { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5039789890133296083" },
          { offset: 3, length: 23, type: "bold" },
          { offset: 28, length: 2, type: "custom_emoji", custom_emoji_id: "5039671744172917707" },
          { offset: 30, length: 21, type: "italic" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: sellPromptText,
            entities: sellPromptEntities,
            reply_markup: { keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]], resize_keyboard: true }
          })
        });
        return;
      }

      // ደረጃ 1፦ መጠን
      if (user.step === "awaiting_amount") {
        const amt = parseFloat(text);
        if (isNaN(amt) || amt < 0.5) {
          const errText = `‼️እባክዎ ትክክለኛ መጠን ያስገቡ (ዝቅተኛው 0.5 USDT)፦`;
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: errText,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "4958534696645428119" },
                { offset: 2, length: 22, type: "bold" }
              ]
            })
          });
          return;
        }

        const rate = getRate(amt);
        const total = amt * rate;

        user.tempOrder = { amount: amt, rate, total };
        user.step = "awaiting_network";
        await user.save();

        const netKeyboard = {
          inline_keyboard: [
            [{ text: "Binance Pay UID", callback_data: "net:binance" }, { text: "BEP-20 (BSC)", callback_data: "net:bep20" }],
            [{ text: "TON Network", callback_data: "net:ton" }, { text: "Litecoin (LTC)", callback_data: "net:ltc" }]
          ]
        };

        const totalStr = `${total.toLocaleString()} ETB`;
        const bottomPrompt = "USDT የሚልኩበትን ኔትወርክ ይምረጡ፦";

        const summaryText =
          `🔥 መጠን: ${amt} USDT\n` +
          `🕯 ተመን: 1 USDT = ${rate} ETB\n` +
          `💰 የሚቀበሉት ድምር: ${totalStr}\n\n` +
          `⬇️ ${bottomPrompt}`;

        const summaryEntities = [
          { offset: summaryText.indexOf("🔥"), length: 2, type: "custom_emoji", custom_emoji_id: "4956499161319998529" },
          { offset: summaryText.indexOf("መጠን:"), length: 5, type: "bold" },
          { offset: summaryText.indexOf("🕯"), length: 2, type: "custom_emoji", custom_emoji_id: "4956492465465984073" },
          { offset: summaryText.indexOf("ተመን:"), length: 5, type: "bold" },
          { offset: summaryText.indexOf("💰"), length: 2, type: "custom_emoji", custom_emoji_id: "4958926882994127612" },
          { offset: summaryText.indexOf("የሚቀበሉት ድምር:"), length: 13, type: "bold" },
          { offset: summaryText.lastIndexOf(totalStr), length: totalStr.length, type: "bold" },
          { offset: summaryText.indexOf("⬇️"), length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" },
          { offset: summaryText.indexOf(bottomPrompt), length: bottomPrompt.length, type: "bold" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: summaryText,
            entities: summaryEntities,
            reply_markup: netKeyboard
          })
        });
        return;
      }
      
      // ደረጃ 2፦ አካውንት ቁጥር
      if (user.step === "awaiting_account") {
        const cleanAcc = text.replace(/\s+/g, '');
        const method = (user.tempOrder && user.tempOrder.method) || "Telebirr";

        if (method === "Telebirr" && !/^09\d{8}$/.test(cleanAcc)) {
          const errText = `🏦የቴሌብር ቁጥር 09 የሚጀምር 10 ድጅት መሆን አለበት! ደግመው በትክክል ያስገቡ፦`;
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: errText,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5931638668031695373" },
                { offset: 2, length: 37, type: "bold" }
              ]
            })
          });
          return;
        }
        if (method === "CBE" && !/^\d{13}$/.test(cleanAcc)) {
          const errText = `🏦 የንግድ ባንክ (CBE) አካውንት 13 ድጅት መሆን አለበት! ደግመው በትክክል ያስገቡ፦`;
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: errText,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5931351583827696128" },
                { offset: 3, length: 41, type: "bold" }
              ]
            })
          });
          return;
        }

        user.tempOrder = { ...(user.tempOrder || {}), account: cleanAcc };
        user.step = "awaiting_name";
        await user.save();

        const label = "የአካውንቱን ሙሉ ስም ያስገቡ፦";
        const namePromptText = `✅ ${label}`;
        const namePromptEntities = [
          { offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "6217663806110175239" },
          { offset: namePromptText.indexOf(label), length: label.length, type: "bold" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: namePromptText,
            entities: namePromptEntities
          })
        });
        return;
      }

      // ደረጃ 3፦ ሙሉ ስም
      if (user.step === "awaiting_name") {
        if (text.length < 3) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: "⚠️ እባክዎ ሙሉ ስም በትክክል ያስገቡ፦" })
          });
          return;
        }

        user.tempOrder = { ...(user.tempOrder || {}), name: text };
        user.step = "awaiting_screenshot";
        await user.save();

        const stepTitle = "የመጨረሻ ደረጃ፦";
        const stepSub = "(Screenshot ፎቶ)";
        const ssPromptText = `✅${stepTitle}\n\nየላኩበትን ደረሰኝ🗓 ${stepSub} አሁን ይላኩ፦`;
        const ssPromptEntities = [
          { offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" },
          { offset: ssPromptText.indexOf(stepTitle), length: stepTitle.length, type: "bold" },
          { offset: ssPromptText.indexOf("🗓"), length: 2, type: "custom_emoji", custom_emoji_id: "4956214413578207998" },
          { offset: ssPromptText.indexOf(stepSub), length: stepSub.length, type: "bold" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: ssPromptText,
            entities: ssPromptEntities
          })
        });
        return;
      }

      // ደረጃ 4፦ ደረሰኝ ፎቶ
      if (user.step === "awaiting_screenshot") {
        if (!msg.photo || msg.photo.length === 0) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: "⚠️ እባክዎ የከፈሉበትን ደረሰኝ በፎቶ (Screenshot) መልክ ይላኩ፦" })
          });
          return;
        }

        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const orderId = crypto.randomUUID();
        const orderData = user.tempOrder || {};

        try {
          const newOrder = await Order.create({
            orderId,
            userId,
            userName: orderData.name || msg.from.first_name || "ደንበኛ",
            telegramUsername: msg.from.username || "",
            amount: Number(orderData.amount) || 0,
            total: Number(orderData.total) || 0,
            rate: Number(orderData.rate) || 0,
            account: orderData.account || "N/A",
            method: orderData.method || "N/A",
            network: orderData.networkName || "N/A",
            customerProofFileId: fileId,
            status: "pending"
          });

          user.step = "idle";
          user.tempOrder = {};
          await user.save();

          const isCBE = orderData.method === "CBE";
          const topCheckId = isCBE ? "6266967801580231067" : "4958610528588008305";
          const dollarEmojiId = isCBE ? "5965043124068687455" : "4956601935592424315";
          const moneyBagEmojiId = isCBE ? "6267068789146260253" : "4958926882994127612";
          const bankEmojiId = isCBE ? "5931351583827696128" : "5931638668031695373";

          const headerTitle = "ትዕዛዝዎ በተሳካ ሁኔታ ደርሷል";
          const amountStr = `${orderData.amount || 0} USDT`;
          const totalStr = `${(Number(orderData.total) || 0).toLocaleString()} ETB`;
          const accStr = `${orderData.account || ""}`;
          const footerNote = "አድሚኑ ደረሰኙን አረጋግጦ ክፍያውን ወዲያውኑ ገቢ ያደርጋል";

          const orderSuccessText =
            `🎉 ${headerTitle}✅\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `💵 መጠን: ${amountStr}\n` +
            `💰 የሚከፈለው: ${totalStr}\n` +
            `🖥 ወደ: ${orderData.method || ""}🏦 (${accStr})\n\n` +
            `${footerNote}✅!`;

          const orderSuccessEntities = [
            { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5039529134078821602" },
            { offset: orderSuccessText.indexOf(headerTitle), length: headerTitle.length, type: "bold" },
            { offset: orderSuccessText.indexOf("✅"), length: 1, type: "custom_emoji", custom_emoji_id: topCheckId },
            { offset: orderSuccessText.indexOf("💵"), length: 2, type: "custom_emoji", custom_emoji_id: dollarEmojiId },
            { offset: orderSuccessText.indexOf("መጠን:"), length: 5, type: "bold" },
            { offset: orderSuccessText.indexOf("💰"), length: 2, type: "custom_emoji", custom_emoji_id: moneyBagEmojiId },
            { offset: orderSuccessText.indexOf("የሚከፈለው:"), length: 10, type: "bold" },
            { offset: orderSuccessText.indexOf(totalStr), length: totalStr.length, type: "bold" },
            { offset: orderSuccessText.indexOf("🖥"), length: 2, type: "custom_emoji", custom_emoji_id: "5282843764451195532" },
            { offset: orderSuccessText.indexOf("ወደ:"), length: 3, type: "bold" },
            { offset: orderSuccessText.indexOf("🏦"), length: 2, type: "custom_emoji", custom_emoji_id: bankEmojiId },
            { offset: orderSuccessText.lastIndexOf(accStr), length: accStr.length, type: "code" },
            { offset: orderSuccessText.indexOf(footerNote), length: footerNote.length, type: "italic" },
            { offset: orderSuccessText.lastIndexOf("✅"), length: 1, type: "custom_emoji", custom_emoji_id: "6266967801580231067" }
          ];

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: orderSuccessText,
              entities: orderSuccessEntities,
              reply_markup: mainMenuKeyboard
            })
          });

          const adminCaption =
            `🚨 <b>አዲስ P2P ትዕዛዝ (Normal Bot)</b>\n━━━━━━━━━━━━━━━━━━\n` +
            `👤 <b>ስም:</b> ${escapeHTML(orderData.name || msg.from.first_name || "ደንበኛ")} (@${msg.from.username || "የለውም"})\n` +
            `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
            `💵 <b>USDT:</b> ${orderData.amount || 0}\n` +
            `📈 <b>Rate:</b> ${orderData.rate || 0} ETB\n` +
            `💰 <b>Total:</b> ${(Number(orderData.total) || 0).toLocaleString()} ETB\n` +
            `🌐 <b>Network:</b> ${orderData.networkName || "N/A"}\n` +
            `🏦 <b>Method:</b> ${orderData.method || "N/A"}\n` +
            `📱 <b>Account:</b> <code>${escapeHTML(orderData.account || "")}</code>\n━━━━━━━━━━━━━━━━━━\n` +
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

          const sentAdminMsg = await telegram("sendPhoto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ADMIN_CHAT_ID,
              photo: fileId,
              caption: adminCaption,
              parse_mode: "HTML",
              reply_markup: adminKeyboard
            })
          });

          if (sentAdminMsg && sentAdminMsg.message_id) {
            newOrder.adminMessageId = sentAdminMsg.message_id;
            await newOrder.save();
          }
        } catch (err) {
          console.error("Order save error:", err);
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: "⚠️ በትዕዛዝ ምዝገባ ወቅት ችግር አጋጥሟል። እባክዎ በ /start እንደገና ይሞክሩ።" })
          });
        }
        return;
      }
    }

    // 4. Callback Query Handlers
    if (callback) {
      const callbackData = callback.data || "";
      const cbUserId = callback.from.id;

      if (callbackData === "check_join") {
        const isMember = await checkMembership(cbUserId);
        if (isMember) {
          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "🎉 እንኳን ደህና መጡ!" }) });
          await sendMainMenu(cbUserId, "✅ ቻናሉ ተረጋግጧል! ንግድ ለመጀመር ከስር ካሉት አንዱን ይምረጡ፦");
        } else {
          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "⚠️ ቻናሉን አልተቀላቀሉም!", show_alert: true }) });
        }
        return;
      }

      if (callbackData.startsWith("net:")) {
        const netKey = callbackData.replace("net:", "");
        const selectedNet = cryptoNetworks[netKey];

        const user = await User.findOne({ telegramId: cbUserId });
        if (user && user.step === "awaiting_network") {
          user.tempOrder = { ...(user.tempOrder || {}), networkKey: netKey, networkName: selectedNet.name };
          user.step = "awaiting_method";
          await user.save();

          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id }) });

          const methodKeyboard = {
            inline_keyboard: [
              [{ text: "📱 ቴሌብር (Telebirr)", callback_data: "pay:Telebirr" }],
              [{ text: "🏦 ንግድ ባንክ (CBE)", callback_data: "pay:CBE" }]
            ]
          };

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cbUserId,
              text: selectedNet.text,
              entities: selectedNet.entities,
              reply_markup: methodKeyboard
            })
          });
        }
        return;
      }

      if (callbackData.startsWith("pay:")) {
        const method = callbackData.replace("pay:", "");
        const user = await User.findOne({ telegramId: cbUserId });

        if (user && user.step === "awaiting_method") {
          user.tempOrder = { ...(user.tempOrder || {}), method: method };
          user.step = "awaiting_account";
          await user.save();

          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id }) });

          const promptText = method === "Telebirr" 
            ? `🏦 የቴሌብር ስልክ ቁጥርዎን ያስገቡ፦\n\n✔️ለምሳሌ፦ 0912345678`
            : `🏦 የኢትዮጵያ ንግድ ባንክ (CBE) 13 ድጅት አካውንት ቁጥር ያስገቡ፦\n\n😬ለምሳሌ:- 1000123456789`;

          const promptEntities = method === "Telebirr"
            ? [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5931638668031695373" },
                { offset: 3, length: 21, type: "bold" },
                { offset: 26, length: 2, type: "custom_emoji", custom_emoji_id: "6217721388736712699" },
                { offset: 28, length: 5, type: "italic" }
              ]
            : [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5931351583827696128" },
                { offset: 3, length: 43, type: "bold" },
                { offset: 48, length: 2, type: "custom_emoji", custom_emoji_id: "6217508525862555336" },
                { offset: 50, length: 5, type: "italic" }
              ];

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cbUserId,
              text: promptText,
              entities: promptEntities
            })
          });
        }
        return;
      }

      if (String(cbUserId) === ADMIN_CHAT_ID) {
        if (callbackData === "open_admin_panel") {
          await telegram("answerCallbackQuery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callback.id })
          });

          const panelHelpText = 
            `🔐 <b>የአድሚን መቆጣጠሪያ ፓነል (Admin Panel Commands)</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `1️⃣ <b>/setrates</b>\n` +
            `• <b>ጥቅም፦</b> የ 4ቱንም ደረጃዎች የ USDT መሸጫ ዋጋ በአንድ ላይ ለመቀየር።\n` +
            `• <b>አጠቃቀም፦</b> <code>/setrates 178 180 182 185</code>\n\n` +
            `2️⃣ <b>/pause</b>\n` +
            `• <b>ጥቅም፦</b> ቦቱን ለጥገና ወይም እረፍት ለጊዜው ሽያጭ እንዳይቀበል ለማቆም።\n` +
            `• <b>አጠቃቀም፦</b> <code>/pause</code>\n\n` +
            `3️⃣ <b>/resume</b>\n` +
            `• <b>ጥቅም፦</b> የቆመውን ቦት ወደ መደበኛ ስራ ለመመለስ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/resume</code>\n\n` +
            `4️⃣ <b>/broadcast</b>\n` +
            `• <b>ጥቅም፦</b> ለቦቱ ተጠቃሚዎች በሙሉ በአንድ ጊዜ ማስታወቂያ ለመላክ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/broadcast ዛሬ ተመን ጨምሯል!</code>\n\n` +
            `5️⃣ <b>/send</b>\n` +
            `• <b>ጥቅም፦</b> ለአንድ የተወሰነ ተጠቃሚ በቴሌግራም ID ብቻ መልዕክት ለመላክ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/send &lt;USER_ID&gt; መልዕክትዎ</code>\n\n` +
            `6️⃣ <b>/stats</b>\n` +
            `• <b>ጥቅም፦</b> አጠቃላይ የትዕዛዞች እና የተጠቃሚዎች ቁጥር ለማየት።\n` +
            `• <b>አጠቃቀም፦</b> <code>/stats</code>\n\n` +
            `7️⃣ <b>/daily</b>\n` +
            `• <b>ጥቅም፦</b> የዛሬውን ቀን ብቻ የተሸጠ USDT እና የወጣ ብር ድምር ለማየት።\n` +
            `• <b>አጠቃቀም፦</b> <code>/daily</code>\n\n` +
            `8️⃣ <b>/statics</b>\n` +
            `• <b>ጥቅም፦</b> የቀጥታ ሰዓት፣ ቀንና የቦቱን አጠቃላይ ተጠቃሚ ከነ ምስል ለማየት።\n` +
            `• <b>አጠቃቀም፦</b> <code>/statics</code>\n\n` +
            `9️⃣ <b>/ban</b>\n` +
            `• <b>ጥቅም፦</b> ህግ የሚያጠፋ ተጠቃሚን ከቦቱ አገልግሎት ለማገድ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/ban &lt;USER_ID&gt;</code>\n\n` +
            `🔟 <b>/unban</b>\n` +
            `• <b>ጥቅም፦</b> የታገደ ተጠቃሚን እገዳ አንስቶ ወደ ቦቱ ለመመለስ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/unban &lt;USER_ID&gt;</code>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 <i>የትኛውንም ትዕዛዝ ኮፒ አድርገው ጽፈው መላክ ይችላሉ!</i>`;

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ADMIN_CHAT_ID,
              text: panelHelpText,
              parse_mode: "HTML"
            })
          });
          return;
        }

        if (callbackData.startsWith("ban_user:")) {
          const targetId = Number(callbackData.split(":")[1]);
          await User.findOneAndUpdate({ telegramId: targetId }, { isBanned: true });
          await clearAdminOrderButtons(callback.message?.message_id);
          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: `User ${targetId} Banned!` }) });
          await telegram("sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: `🚫 ተጠቃሚ ${targetId} ታግዷል!` }) });
          return;
        }

        const [action, orderId] = callbackData.split(":");
        const order = await Order.findOne({ orderId });
        if (!order || order.status !== "pending") {
          await clearAdminOrderButtons(callback.message?.message_id);
          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "ይህ ትዕዛዝ ቀድሞ ተጠናቋል!" }) });
          return;
        }

        if (action === "receipt") {
          pendingReceiptOrder = orderId;
          if (callback.message?.message_id && !order.adminMessageId) {
            order.adminMessageId = callback.message.message_id;
            await order.save();
          }
          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id }) });
          await telegram("sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: "📸 የከፈሉበትን ደረሰኝ Screenshot አሁን ይላኩ (ለመሰረዝ /cancel)፦" }) });
          return;
        }

        if (action === "quick_approve") {
          order.status = "approved";
          await order.save();

          await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);

          const bankEmojiId = order.method === "CBE" ? "5805572156599312646" : "5931638668031695373";
          const amountStr = `${order.amount} USDT`;
          const totalStr = `${Number(order.total || 0).toLocaleString()} ETB`;

          const quickMsg =
            `የ${amountStr}💵 ሽያጭ ትዕዛዝዎ ጸድቋል!✅\n\n` +
            ` 🍾${totalStr} ወደ ${order.method}🏦 አካውንትዎ ገቢ ተደርጓል።\n\n` +
            ` ከUnique P2P ጋር ስለሰሩ እናመሰግናለን❤️‍🔥!`;

          const quickEntities = [
            { offset: quickMsg.indexOf(amountStr), length: amountStr.length, type: "bold" },
            { offset: quickMsg.indexOf("💵"), length: 2, type: "custom_emoji", custom_emoji_id: "5965043124068687455" },
            { offset: quickMsg.indexOf("✅"), length: 1, type: "custom_emoji", custom_emoji_id: "6266967801580231067" },
            { offset: quickMsg.indexOf("🍾"), length: 2, type: "custom_emoji", custom_emoji_id: "5042274086332400375" },
            { offset: quickMsg.indexOf(totalStr), length: totalStr.length, type: "bold" },
            { offset: quickMsg.indexOf("🏦"), length: 2, type: "custom_emoji", custom_emoji_id: bankEmojiId },
            { offset: quickMsg.indexOf("❤️‍🔥"), length: 5, type: "custom_emoji", custom_emoji_id: "5042225965518816316" }
          ];

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: order.userId,
              text: quickMsg,
              entities: quickEntities
            })
          });

          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "✅ Approved!" }) });
          return;
        }

        if (action === "decline") {
          order.status = "declined";
          await order.save();

          await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);

          const declineMsg = `❌ ትዕዛዝዎ ውድቅ ተደርጓል። ለጥያቄ @Aropc ያነጋግሩ🙂።`;
          const declineEntities = [
            { offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "5040042498634810056" },
            { offset: 2, length: 21, type: "bold" },
            { offset: 36, length: 2, type: "custom_emoji", custom_emoji_id: "5039613856603702817" }
          ];

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: order.userId,
              text: declineMsg,
              entities: declineEntities
            })
          });

          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "❌ Declined!" }) });
          return;
        }
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err.message);
  }
});

process.on("unhandledRejection", err => console.error("Unhandled Rejection:", err.message));
process.on("uncaughtException", err => console.error("Uncaught Exception:", err.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Normal Bot running on port ${PORT}`);
});
