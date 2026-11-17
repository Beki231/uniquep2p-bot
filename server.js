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
const CHANNEL_ID = "@Unique_Techs";

const BANNER_IMAGE_URL = "https://i.postimg.cc/L88G59b1/IMG-20261103-102834-245.jpg"; 
const STATS_BANNER_URL = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80";

// Keep-Alive Health Check for cron-job.org
app.get("/", (req, res) => {
  res.status(200).send("Bot is awake!");
});

// Schemas
const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String, default: "" },
  firstName: { type: String, default: "" },
  isBanned: { type: Boolean, default: false },
  isJoined: { type: Boolean, default: false },
  step: { type: String, default: "idle" },
  tempOrder: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  orderType: { type: String, enum: ["sell", "buy"], default: "sell" },
  userId: { type: Number, required: true },
  userName: { type: String, default: "" },
  telegramUsername: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  account: { type: String, default: "N/A" },
  method: { type: String, default: "N/A" },
  network: { type: String, default: "N/A" },
  networkKey: { type: String, default: "" },
  status: { type: String, enum: ["awaiting_permission", "pending", "approved", "declined"], default: "pending" },
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
  tier4: { type: Number, default: 185 },
  buyRate: { type: Number, default: 193 }
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

let exchangeRates = { tier1: 178, tier2: 180, tier3: 182, tier4: 185, buyRate: 193 };

async function initRates() {
  try {
    let savedRate = await Rate.findOne({ key: "v2_rates" });
    if (!savedRate) {
      savedRate = await Rate.create({ key: "v2_rates", tier1: 178, tier2: 180, tier3: 182, tier4: 185, buyRate: 193 });
    }
    exchangeRates = {
      tier1: savedRate.tier1,
      tier2: savedRate.tier2,
      tier3: savedRate.tier3,
      tier4: savedRate.tier4,
      buyRate: savedRate.buyRate || 193
    };
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

async function buildCustomEmojiEntities(text, makeBold = true) {
  try {
    const entities = [];

    if (makeBold && text.length > 0) {
      entities.push({
        type: "bold",
        offset: 0,
        length: text.length
      });
    }

    const stickers = await telegram("getCustomEmojiStickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        custom_emoji_ids: CUSTOM_EMOJI_IDS
      })
    });

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
    return makeBold && text.length > 0 ? [{ type: "bold", offset: 0, length: text.length }] : [];
  }
}

async function checkMembership(userId) {
  try {
    const res = await telegram("getChatMember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL_ID, user_id: userId })
    });
    return ["creator", "administrator", "member", "restricted"].includes(res.status);
  } catch (err) {
    console.error("Membership Check Error:", err.message);
    return false;
  }
}

const mainMenuKeyboard = {
  keyboard: [
    [{ text: "🔴 USDT መሸጥ" }, { text: "🟢 USDT መግዛት" }],
    [{ text: "📊 የዛሬ ተመን" }, { text: "📜 የትዕዛዝ ታሪክ" }],
    [{ text: "🧑‍💻 ድጋፍ / አድሚን" }]
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

          const netKey = order.networkKey || "binance";
          let netEmojiId = "5296437653770608702"; 
          let netDisplayName = "Binance";

          if (netKey === "bep20") {
            netEmojiId = "5291786530606562380";
            netDisplayName = "Bep-20";
          } else if (netKey === "ton") {
            netEmojiId = "5350716797622442220";
            netDisplayName = "TON";
          } else if (netKey === "aptos") {
            netEmojiId = "5327975761833913214";
            netDisplayName = "Aptos";
          }

          const amountStr = `${order.amount} USDT`;
          const finalMsg =
            `✔️ የትዕዛዝ ማረጋገጫ እና ደረሰኝ፦\n\n` +
            `የ${amountStr} ግዥ ትዕዛዝዎ ጸድቋል!✅\n\n` +
            ` 🍾 ${order.amount}$  ወደ ${netDisplayName} አካውንትዎ ገቢ ተደርጓል።\n\n` +
            ` ከUnique P2P ጋር ስለሰሩ እናመሰግናለን❤️‍🔥!`;

          const finalEntities = [
            { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "6267225207560214192" },
            { offset: finalMsg.indexOf("💵") !== -1 ? finalMsg.indexOf("💵") : 15, length: 2, type: "custom_emoji", custom_emoji_id: "5965043124068687455" },
            { offset: finalMsg.indexOf("✅"), length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" },
            { offset: finalMsg.indexOf("🍾"), length: 2, type: "custom_emoji", custom_emoji_id: "5042274086332400375" },
            { offset: finalMsg.indexOf("💵") !== -1 ? finalMsg.indexOf("💵") : 30, length: 2, type: "custom_emoji", custom_emoji_id: "4956601935592424315" },
            { offset: finalMsg.indexOf(netDisplayName) - 3, length: 2, type: "custom_emoji", custom_emoji_id: netEmojiId },
            { offset: finalMsg.indexOf("❤️‍🔥"), length: 5, type: "custom_emoji", custom_emoji_id: "5042225965518816316" }
          ];

          try {
            await telegram("sendPhoto", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: order.userId,
                photo: adminReceiptPhotoId,
                caption: finalMsg,
                caption_entities: finalEntities
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
            await telegram("sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: msg.chat.id,
                text: `✅ <b>የ USDT መግዣ ተመን (Buy Rate) በተሳካ ሁኔታ ተቀይሯል!</b>\n━━━━━━━━━━━━━━━━━━\n💵 1 USDT = <b>${newBuyRate} ETB</b>`,
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
            text: "⚠️ <b>ስህተት፦</b> እባክዎ አዲሱን የመግዣ ዋጋ አስገብተው ይላኩ!\n\n<i>ለምሳሌ፦</i> <code>/setbuyrate 193</code>",
            parse_mode: "HTML"
          })
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
            exchangeRates.tier1 = t1;
            exchangeRates.tier2 = t2;
            exchangeRates.tier3 = t3;
            exchangeRates.tier4 = t4;
            
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

      if (!user.isJoined) {
        const isMember = await checkMembership(userId);
        if (isMember) {
          user.isJoined = true;
          await user.save();
        } else {
          const joinText = `⚠️ ይቅርታ፣ ቦቱን ለመጠቀም መጀመሪያ ቻናላችንን መቀላቀል አለብዎት!\n\n👉 እባክዎ ከታች ያለውን ሊንክ ተጭነው ቻናሉን ከተቀላቀሉ በኋላ «🌟 ተቀላቅያለሁ (Check)» የሚለውን ይጫኑ፡-`;
          const joinEntities = [
            { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5447644880824181073" },
            { offset: 46, length: 2, type: "custom_emoji", custom_emoji_id: "5471978009449731768" },
            { offset: 89, length: 2, type: "custom_emoji", custom_emoji_id: "6267118537752450044" }
          ];

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
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
            })
          });
          return;
        }
      }

      const text = msg.text ? msg.text.trim() : "";

      if (text.startsWith("/start")) {
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

      if (text === "❌ ሰርዝ (Cancel)") {
        user.step = "idle";
        user.tempOrder = {};
        await user.save();

        const backConfirmText = "✅ ወደ ዋናው ሜኑ ተመልሰዋል!";
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: backConfirmText,
            entities: [
              { offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" }
            ]
          })
        });

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

        const backConfirmText = "✅ ወደ ዋናው ሜኑ ተመልሰዋል!";
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: backConfirmText,
            entities: [
              { offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" }
            ]
          })
        });

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
        let rateText = "";
        const rateEntities = [];

        const addRatePart = (str, customEmojiId = null, isBold = false) => {
          const offset = rateText.length;
          rateText += str;
          if (customEmojiId) {
            rateEntities.push({
              type: "custom_emoji",
              offset,
              length: str.length,
              custom_emoji_id: customEmojiId
            });
          }
          if (isBold) {
            rateEntities.push({
              type: "bold",
              offset,
              length: str.length
            });
          }
        };

        addRatePart("📊", "4958506272551863292");
        addRatePart("የዛሬ የ USDT መሸጫ ዋጋዎች፦", null, true);
        addRatePart("\n━━━━━━━━━━━━━━━━━━\n");

        addRatePart("✅", "6267008582294705964");
        addRatePart(" 0.5 - 0.9 ");
        addRatePart("💵", "5965043124068687455");
        addRatePart(` ${exchangeRates.tier1} ETB`, null, true);
        addRatePart("\n");

        addRatePart("✅", "6267008582294705964");
        addRatePart(" 1.0 - 10 ");
        addRatePart("💵", "5965043124068687455");
        addRatePart(` ${exchangeRates.tier2} ETB`, null, true);
        addRatePart("\n");

        addRatePart("✅", "6267008582294705964");
        addRatePart(" 11 - 30 ");
        addRatePart("💵", "5965043124068687455");
        addRatePart(` ${exchangeRates.tier3} ETB`, null, true);
        addRatePart("\n");

        addRatePart("✅", "6267008582294705964");
        addRatePart(" 31+      ");
        addRatePart("💵", "5965043124068687455");
        addRatePart(` ${exchangeRates.tier4} ETB (ምርጥ ተመን)`, null, true);
        addRatePart("\n━━━━━━━━━━━━━━━━━━\n");

        addRatePart("📊", "4958506272551863292");
        addRatePart("የዛሬ የ USDT መግዣ ዋጋ፦", null, true);
        addRatePart("\n\n");

        addRatePart("✅", "6267008582294705964");
        addRatePart(`የምንሸጥበት ዋጋ፦ ${exchangeRates.buyRate} ብር `, null, true);
        addRatePart("💰", "6267068789146260253");
        addRatePart("\n━━━━━━━━━━━━━━━━━━\n");

        addRatePart("ለመሸጥ \"");
        addRatePart("✔️", "6267225207560214192");
        addRatePart(" USDT መሸጥ\" የሚለውን ይጫኑ!");

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: rateText,
            entities: rateEntities,
            reply_markup: backToMainKeyboard
          })
        });
        return;
      }

      // ================= BUY USDT FLOW =================
      if (text === "🟢 USDT መግዛት") {
        const botSettings = await Settings.findOne({ key: "v2_settings" });
        if (botSettings && botSettings.isPaused) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: botSettings.pauseReason || "⏸️ ቦቱ ለጊዜው ቆሟል።" })
          });
          return;
        }

        user.step = "awaiting_buy_agree";
        user.tempOrder = {};
        await user.save();

        const buyRateStr = `1 USDT = ${exchangeRates.buyRate} ETB`;
        const buyIntroText =
          `↗️ የዛሬ የ USDT መግዣ ተመን (Rate)\n\n` +
          `💵 ${buyRateStr}\n\n` +
          `🌟ለመግዛት ከተስማሙ «✅ ተስማምቻለሁ» የሚለውን ይንኩ👇`;

        const buyIntroEntities = [
          { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5429651785352501917" },
          { offset: 3, length: 25, type: "bold" },
          { offset: buyIntroText.indexOf("💵"), length: 2, type: "custom_emoji", custom_emoji_id: "5040025580758631490" },
          { offset: buyIntroText.indexOf(buyRateStr), length: buyRateStr.length, type: "bold" },
          { offset: buyIntroText.indexOf("🌟"), length: 2, type: "custom_emoji", custom_emoji_id: "6267118537752450044" },
          { offset: buyIntroText.indexOf("✅"), length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" },
          { offset: buyIntroText.indexOf("ተስማምቻለሁ"), length: 10, type: "bold" },
          { offset: buyIntroText.indexOf("👇"), length: 2, type: "custom_emoji", custom_emoji_id: "5231102735817918643" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: buyIntroText,
            entities: buyIntroEntities,
            reply_markup: {
              keyboard: [
                [{ text: "✅ ተስማምቻለሁ" }],
                [{ text: "❌ ሰርዝ (Cancel)" }]
              ],
              resize_keyboard: true
            }
          })
        });
        return;
      }

      if ((text === "✅ ተስማምቻለሁ" || text === "ተስማምቻለሁ" || text === "ተስማምቻለሁ✔️") && user.step === "awaiting_buy_agree") {
        user.step = "awaiting_buy_amount";
        user.tempOrder = {};
        await user.save();

        const buyPromptText = `↗️ መግዛት የሚፈልጉትን የ USDT መጠን ያስገቡ፡-\n\n⚠️ ዝቅተኛው መጠን 1 💵 USDT ነው!`;
        const buyPromptEntities = [
          { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5429651785352501917" },
          { offset: 3, length: 30, type: "bold" },
          { offset: 35, length: 2, type: "custom_emoji", custom_emoji_id: "6267039884016358504" },
          { offset: 50, length: 2, type: "custom_emoji", custom_emoji_id: "4956601935592424315" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: buyPromptText,
            entities: buyPromptEntities,
            reply_markup: { keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]], resize_keyboard: true }
          })
        });
        return;
      }

      if (user.step === "awaiting_buy_amount") {
        const amt = parseFloat(text);
        if (isNaN(amt) || amt < 1) {
          const errText = `⚠️ እባክዎ ትክክለኛ መጠን ያስገቡ (ዝቅተኛው 1 USDT ነው)፦`;
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: errText,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "6267039884016358504" },
                { offset: 3, length: 22, type: "bold" }
              ]
            })
          });
          return;
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
        const buySummaryText =
          `💵 የሚገዙት መጠን፦ ${amtDisplay}\n\n` +
          `✔️USDT በምን መቀበል ይፈልጋሉ❓\n\n` +
          `⬇️ እባክዎ ከታች ካሉት አማራጮች አንዱን ይምረጡ፡-`;

        const buySummaryEntities = [
          { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5040025580758631490" },
          { offset: buySummaryText.indexOf(amtDisplay), length: amtDisplay.length, type: "bold" },
          { offset: buySummaryText.indexOf("✔️"), length: 2, type: "custom_emoji", custom_emoji_id: "5039844895779455925" },
          { offset: buySummaryText.indexOf("USDT በምን"), length: 22, type: "bold" },
          { offset: buySummaryText.indexOf("❓"), length: 1, type: "custom_emoji", custom_emoji_id: "5436113877181941026" },
          { offset: buySummaryText.indexOf("⬇️"), length: 2, type: "custom_emoji", custom_emoji_id: "5406745015365943482" }
        ];

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: buySummaryText,
            entities: buySummaryEntities,
            reply_markup: buyNetKeyboard
          })
        });
        return;
      }

      if (user.step === "awaiting_buy_address") {
        const walletAddress = text.trim(); 

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
          user.tempOrder = { orderId, amount: orderData.amount, total: totalFixed, account: walletAddress };
          await user.save();

          let sentText = "";
          let sentEntities = [];

          if (netKey === "binance") {
            sentText = `✔️ የትዕዛዝ ጥያቄዎ ወደ Admin ተልኳል!\n\n💵 መጠን፦ ${orderData.amount} USDT (${totalFixed} ETB)\n🖥 መቀበያዎ፦ ${walletAddress} ( 💸Binance ID)\n\n👨‍💻 እባክዎ Admin እስኪያረጋግጥ ጥቂት ሰከንዶችን ይጠብቁ፤ እንደተፈቀደ የክፍያ አካውንቶች ይላኩሎታል።`;
            sentEntities = [
              { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5039844895779455925" },
              { offset: 30, length: 2, type: "custom_emoji", custom_emoji_id: "5040025580758631490" },
              { offset: 60, length: 2, type: "custom_emoji", custom_emoji_id: "5039579582764680065" },
              { offset: 70, length: walletAddress.length, type: "code" },
              { offset: 72 + walletAddress.length, length: 2, type: "custom_emoji", custom_emoji_id: "5965273136747257327" },
              { offset: 87 + walletAddress.length, length: 5, type: "custom_emoji", custom_emoji_id: "5190498849440931467" }
            ];
          } else if (netKey === "ton") {
            sentText = `✔️ የትዕዛዝ ጥያቄዎ ወደ Admin ተልኳል!\n\n💵 መጠን፦ ${orderData.amount} USDT (${totalFixed} ETB)\n🖥 መቀበያዎ፦ ${walletAddress} (🤑TON)\n\n👨‍💻 እባክዎ Admin እስኪያረጋግጥ ጥቂት ሰከንዶችን ይጠብቁ፤ እንደተፈቀደ የክፍያ አካውንቶች ይላኩሎታል።`;
            sentEntities = [
              { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "4956721670690702265" },
              { offset: 30, length: 2, type: "custom_emoji", custom_emoji_id: "4956601935592424315" },
              { offset: 60, length: 2, type: "custom_emoji", custom_emoji_id: "5039579582764680065" },
              { offset: 72 + walletAddress.length, length: 2, type: "custom_emoji", custom_emoji_id: "5350716797622442220" },
              { offset: 80 + walletAddress.length, length: 5, type: "custom_emoji", custom_emoji_id: "5190498849440931467" }
            ];
          } else if (netKey === "bep20") {
            sentText = `✔️ የትዕዛዝ ጥያቄዎ ወደ Admin ተልኳል!\n\n💵 መጠን፦ ${orderData.amount} USDT (${totalFixed} ETB)\n🖥 መቀበያዎ፦ ${walletAddress} (🔶Bep-20)\n\n👨‍💻 እባክዎ Admin እስኪያረጋግጥ ጥቂት ሰከንዶችን ይጠብቁ፤ እንደተፈቀደ የክፍያ አካውንቶች ይላኩሎታል።`;
            sentEntities = [
              { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "4956721670690702265" },
              { offset: 30, length: 2, type: "custom_emoji", custom_emoji_id: "4956601935592424315" },
              { offset: 60, length: 2, type: "custom_emoji", custom_emoji_id: "5039579582764680065" },
              { offset: 72 + walletAddress.length, length: 2, type: "custom_emoji", custom_emoji_id: "5291786530606562380" },
              { offset: 83 + walletAddress.length, length: 5, type: "custom_emoji", custom_emoji_id: "5190498849440931467" }
            ];
          } else {
            sentText = `✔️ የትዕዛዝ ጥያቄዎ ወደ Admin ተልኳል!\n\n💵 መጠን፦ ${orderData.amount} USDT (${totalFixed} ETB)\n🖥 መቀበያዎ፦ ${walletAddress} (😟Aptos)\n\n👨‍💻 እባክዎ Admin እስኪያረጋግጥ ጥቂት ሰከንዶችን ይጠብቁ፤ እንደተፈቀደ የክፍያ አካውንቶች ይላኩሎታል።`;
            sentEntities = [
              { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5039844895779455925" },
              { offset: 30, length: 2, type: "custom_emoji", custom_emoji_id: "5040025580758631490" },
              { offset: 60, length: 2, type: "custom_emoji", custom_emoji_id: "5039579582764680065" },
              { offset: 72 + walletAddress.length, length: 2, type: "custom_emoji", custom_emoji_id: "5327975761833913214" }
            ];
          }

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: sentText,
              entities: sentEntities,
              reply_markup: {
                keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]],
                resize_keyboard: true
              }
            })
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
            `👤 <b>ደንበኛ፦</b> ${userTag} (${escapeHTML(msg.from.first_name || "ደንበኛ")})\n` +
            `🆔 <b>ID፦</b> <code>${userId}</code>\n` +
            `💵 <b>የሚገዛው መጠን፦</b> ${orderData.amount} USDT\n` +
            `💰 <b>የሚከፍለው ብር፦</b> ${totalFixed} ETB\n` +
            `🔗 <b>ኔትወርክ፦</b> ${netDisplay}\n` +
            `🎯 <b>መቀበያ Wallet/ID፦</b> <code>${escapeHTML(walletAddress)}</code>\n\n` +
            `👉 <i>ይህ ሰው ክፍያ እንዲፈጽም ይፈቀድ?</i>`;

          const sentAdminBuyMsg = await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
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
            })
          });

          if (sentAdminBuyMsg && sentAdminBuyMsg.message_id) {
            newBuyOrder.adminMessageId = sentAdminBuyMsg.message_id;
            await newBuyOrder.save();
          }
        } catch (err) {
          console.error("Buy order save error:", err.message);
          // ምንም አይነት የውሸት ኤረር ለተጠቃሚው አልተላከም!
        }
        return;
      }

      // 5ኛ ቁጥር፦ ተጠቃሚው የክፍያ ደረሰኝ (Screenshot) ሲልክ ወደ አድሚን የሚልክበት ክፍል
      if (user.step === "awaiting_buy_screenshot") {
        if (!msg.photo || msg.photo.length === 0) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: "⚠️ እባክዎ የከፈሉበትን ደረሰኝ በፎቶ (Screenshot) መልክ ይላኩ፦" })
          });
          return;
        }

        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const orderData = user.tempOrder || {};

        try {
          user.step = "pending_admin_check";
          await user.save();

          const successText = `🛫 የከፈሉበት ደረሰኝ በተሳካ ሁኔታ ለአድሚን ተልኳል!\n\n👨‍💻 እባክዎ Admin እስኪያረጋግጥ ጥቂት ደቂቃዎች ይጠብቁ።`;
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: successText,
              reply_markup: {
                keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]],
                resize_keyboard: true
              }
            })
          });

          const adminProofCaption =
            `🚨 <b>አዲስ የ USDT ግዢ የክፍያ ደረሰኝ (Screenshot)</b>\n━━━━━━━━━━━━━━━━━━\n` +
            `👤 <b>ስም:</b> ${escapeHTML(msg.from.first_name || "ደንበኛ")} (@${msg.from.username || "የለውም"})\n` +
            `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
            `💵 <b>USDT:</b> ${orderData.amount || 0}\n` +
            `💰 <b>Total:</b> ${orderData.total || 0} ETB\n` +
            `🎯 <b>መቀበያ Wallet/ID:</b> <code>${escapeHTML(orderData.account || "")}</code>\n━━━━━━━━━━━━━━━━━━`;

          await telegram("sendPhoto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ADMIN_CHAT_ID,
              photo: fileId,
              caption: adminProofCaption,
              parse_mode: "HTML"
            })
          });
        } catch (err) {
          console.error("Buy screenshot send error:", err);
        }
        return;
      }
      // =================================================

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

        addTextWithEmoji("🕯", "4956492465465984073");
        addTextWithEmoji(" ");
        addTextWithEmoji("የቅርብ ጊዜ የትዕዛዝ ታሪክዎ፦", null, true);
        addTextWithEmoji("\n━━━━━━━━━━━━━━━━━━\n");

        orders.forEach(o => {
          addTextWithEmoji("💵", "5040025580758631490");
          addTextWithEmoji(" ");
          addTextWithEmoji(`${o.amount} USDT`, null, true);
          addTextWithEmoji(` (${Number(o.total || 0).toLocaleString()} ETB)\n`);

          addTextWithEmoji("📌", "5039600026809009149");
          addTextWithEmoji(` ዘዴ: ${o.method}`);
          if (o.method === "Telebirr") {
            addTextWithEmoji("🏦", "5805526032945519867");
          } else if (o.method === "CBE") {
            addTextWithEmoji("🏦", "5805572156599312646");
          } else {
            addTextWithEmoji("🏦");
          }

          addTextWithEmoji(" | ሁኔታ: ");
          if (o.status === "approved") {
            addTextWithEmoji("✔️", "5039844895779455925");
            addTextWithEmoji(" ");
            addTextWithEmoji("ጸድቋል", null, true);
          } else if (o.status === "declined") {
            addTextWithEmoji("❌", "4958526153955476488");
            addTextWithEmoji(" ");
            addTextWithEmoji("ውድቅ", null, true);
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

      if (text === "🧑‍💻 ድጋፍ / አድሚን") {
        const supportText = 
          `👨‍💻የደንበኞች ድጋፍ እና ማህበረሰብ\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `➡️ ማንኛውም ጥያቄ፣ አስተያየት ወይም እርዳታ ከፈለጉ በቀጥታ ያናግሩን፡-\n\n` +
          `🤝 Admin Support፦ @Aropc\n` +
          `✅ Channel፦ @Unique_Techs\n\n` +
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
          { offset: 176, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" }
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

      if (text === "🔴 USDT መሸጥ") {
        const botSettings = await Settings.findOne({ key: "v2_settings" });
        if (botSettings && botSettings.isPaused) {
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: botSettings.pauseReason || "⏸️ ቦቱ ለጊዜው ቆሟል።" })
          });
          return;
        }

        user.step = "awaiting_sell_agree";
        user.tempOrder = {};
        await user.save();

        let sellIntroText = "";
        const sellIntroEntities = [];

        const addSellPart = (str, customEmojiId = null, isBold = false) => {
          const offset = sellIntroText.length;
          sellIntroText += str;
          if (customEmojiId) {
            sellIntroEntities.push({
              type: "custom_emoji",
              offset,
              length: str.length,
              custom_emoji_id: customEmojiId
            });
          }
          if (isBold) {
            sellIntroEntities.push({
              type: "bold",
              offset,
              length: str.length
            });
          }
        };

        addSellPart("🔥", "5039644681583985437");
        addSellPart("የ USDT መሸጫ ገጽ (SELL USDT)", null, true);
        addSellPart("\n━━━━━━━━━━━━━━━━━━━━━\n");

        addSellPart("📊", "5042290883949495533");
        addSellPart(" የዛሬ የመሸጫ ተመኖች (Rates)፦", null, true);
        addSellPart("\n\n");

        addSellPart("✅", "6267008582294705964");
        addSellPart("0.5 - 0.9");
        addSellPart("💵", "5409048419211682843");
        addSellPart(`${exchangeRates.tier1} ETB`, null, true);
        addSellPart("\n");

        addSellPart("✅", "6267008582294705964");
        addSellPart("1.0 - 10 ");
        addSellPart("💵", "5409048419211682843");
        addSellPart(`${exchangeRates.tier2} ETB`, null, true);
        addSellPart("\n");

        addSellPart("✅", "6267008582294705964");
        addSellPart(" 11 - 30 ");
        addSellPart("💵", "5409048419211682843");
        addSellPart(` ${exchangeRates.tier3} ETB`, null, true);
        addSellPart("\n");

        addSellPart("✅", "6267008582294705964");
        addSellPart(" 31+      ");
        addSellPart("💵", "5409048419211682843");
        addSellPart(`  ${exchangeRates.tier4} ETB`, null, true);
        addSellPart("\n\n");

        addSellPart("🔽", "5447183459602669338");
        addSellPart("ዝቅተኛ የመሸጫ መጠን፦ 0.5 USDT", null, true);
        addSellPart("\n\n");

        addSellPart("👇", "5231102735817918643");
        addSellPart(" ለመቀጠል «");
        addSellPart("✅", "6267008582294705964");
        addSellPart("ተስማምቻለሁ", null, true);
        addSellPart("» የሚለውን ይጫኑ፡-");

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: sellIntroText,
            entities: sellIntroEntities,
            reply_markup: {
              keyboard: [
                [{ text: "✅ ተስማምቻለሁ" }],
                [{ text: "❌ ሰርዝ (Cancel)" }]
              ],
              resize_keyboard: true
            }
          })
        });
        return;
      }

      if (text === "✅ ተስማምቻለሁ" && user.step === "awaiting_sell_agree") {
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
          { offset: 0, length: 1, type: "custom_emoji", custom_emoji_id: "6267008582294705964" },
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

          user.step = "pending";
          user.tempOrder = {};
          await user.save();

          const orderSuccessText = `🛫 ትዕዛዝዎ እና የከፈሉበት ደረሰኝ በተሳካ ሁኔታ ደርሶናል!\n\n👨‍💻 መረጃዎ ወደ Admin ተልኳል፤ በጥቂት ደቂቃዎች ውስጥ ተጣርቶ ይላክሎታል።\n\n💯 UNIQUE P2P STOREን ስለመረጡ እናመሰግናለን!`;
          const orderSuccessEntities = [
            { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5201691993775818138" },
            { offset: 41, length: 5, type: "custom_emoji", custom_emoji_id: "5190498849440931467" },
            { offset: 96, length: 2, type: "custom_emoji", custom_emoji_id: "5042297717242463211" }
          ];

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userId,
              text: orderSuccessText,
              entities: orderSuccessEntities,
              reply_markup: {
                keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]],
                resize_keyboard: true
              }
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
          await User.findOneAndUpdate({ telegramId: cbUserId }, { isJoined: true });

          await telegram("answerCallbackQuery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callback.id, text: "🎉 እንኳን ደህና መጡ!" })
          });

          if (callback.message?.message_id) {
            try {
              await telegram("deleteMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: cbUserId,
                  message_id: callback.message.message_id
                })
              });
            } catch (e) {
              console.error("Delete force join msg error:", e.message);
            }
          }

          const joinedSuccessText = "🎉 እንኳን ደህና መጡ! ቻናሉን በተሳካ ሁኔታ ተቀላቅለዋል።";
          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cbUserId,
              text: joinedSuccessText,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5039529134078821602" },
                { offset: 3, length: joinedSuccessText.length - 3, type: "bold" }
              ]
            })
          });

          const welcomeCaption = "🔥 እንኳን ወደ Unique P2P Store🇪🇹 በደህና መጡ!↔️\n\n ደህንነቱ የተጠበቀ🛡 እና እጅግ ፈጣን የ USDT💵 መገበያያ ቤት!⚡️\n\n ⬇️ የሚፈልጉትን አገልግሎት ከታች ካሉት አማራጮች ይምረጡ፡-";
          const welcomeEntities = await buildCustomEmojiEntities(welcomeCaption);

          await telegram("sendPhoto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cbUserId,
              photo: BANNER_IMAGE_URL,
              caption: welcomeCaption,
              caption_entities: welcomeEntities,
              reply_markup: mainMenuKeyboard
            })
          });
        } else {
          await telegram("answerCallbackQuery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callback.id, text: "⚠️ ቻናሉን ገና አልተቀላቀሉም! መጀመሪያ ተቀላቀሉ።", show_alert: true })
          });
        }
        return;
      }

      // BUY NETWORK SELECTION
      if (callbackData.startsWith("buynet:")) {
        const netKey = callbackData.replace("buynet:", "");
        const user = await User.findOne({ telegramId: cbUserId });

        if (user && user.step === "awaiting_buy_network") {
          const netMap = {
            binance: {
              name: "Binance ID",
              text: `📌 እባክዎ የ Binance💰 ID ቁጥርዎን ያስገቡ፡-\n\n💬 ምሳሌ፦ <code>1197432698</code>`,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5397782960512444700" },
                { offset: 17, length: 2, type: "custom_emoji", custom_emoji_id: "5202068941580550229" },
                { offset: 37, length: 2, type: "custom_emoji", custom_emoji_id: "5443038326535759644" }
              ]
            },
            bep20: {
              name: "BEP-20",
              text: `📌 እባክዎ የ USDT BEP-20🔶 አድራሻዎን ያስገቡ፡-\n\n💬 ምሳሌ፦ <code>0x71C83920F...</code>`,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5397782960512444700" },
                { offset: 21, length: 2, type: "custom_emoji", custom_emoji_id: "5291786530606562380" },
                { offset: 39, length: 2, type: "custom_emoji", custom_emoji_id: "5443038326535759644" }
              ]
            },
            ton: {
              name: "TON",
              text: `📌 እባክዎ የ TON🤑 Wallet አድራሻዎን ያስገቡ፡-\n\n💬 ምሳሌ፦ <code>UQCYZuyq...</code>`,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5397782960512444700" },
                { offset: 13, length: 2, type: "custom_emoji", custom_emoji_id: "5350716797622442220" },
                { offset: 38, length: 2, type: "custom_emoji", custom_emoji_id: "5443038326535759644" }
              ]
            },
            aptos: {
              name: "Aptos",
              text: `📌እባክዎ የ Aptos😟 Wallet አድራሻዎን ያስገቡ፡-\n\n💬 ምሳሌ፦ <code>ox71hcj....</code>`,
              entities: [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5397782960512444700" },
                { offset: 14, length: 2, type: "custom_emoji", custom_emoji_id: "5327975761833913214" },
                { offset: 39, length: 2, type: "custom_emoji", custom_emoji_id: "5443038326535759644" }
              ]
            }
          };

          const chosen = netMap[netKey];
          if (chosen) {
            user.tempOrder = { ...(user.tempOrder || {}), networkKey: netKey, networkName: chosen.name };
            user.step = "awaiting_buy_address";
            await user.save();

            await telegram("answerCallbackQuery", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: callback.id })
            });

            await telegram("sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cbUserId,
                text: chosen.text,
                parse_mode: "HTML",
                entities: chosen.entities
              })
            });
          }
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
              [
                { text: "ቴሌብር (Telebirr)", icon_custom_emoji_id: "5805526032945519867", callback_data: "pay:Telebirr" }
              ],
              [
                { text: "ንግድ ባንክ (CBE)", icon_custom_emoji_id: "5805572156599312646", callback_data: "pay:CBE" }
              ]
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
            ? `🏦 የቴሌብር ስልክ ቁጥርዎን ያስገቡ፦\n\n✔️ለምሳሌ፦ <code>0912345678</code>`
            : `🏦 የኢትዮጵያ ንግድ ባንክ (CBE) 13 ድጅት አካውንት ቁጥር ያስገቡ፦\n\n😬ለምሳሌ:- <code>1000123456789</code>`;

          const promptEntities = method === "Telebirr"
            ? [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5931638668031695373" },
                { offset: 3, length: 21, type: "bold" },
                { offset: 26, length: 2, type: "custom_emoji", custom_emoji_id: "6217721388736712699" }
              ]
            : [
                { offset: 0, length: 2, type: "custom_emoji", custom_emoji_id: "5931351583827696128" },
                { offset: 3, length: 43, type: "bold" },
                { offset: 48, length: 2, type: "custom_emoji", custom_emoji_id: "6217508525862555336" }
              ];

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cbUserId,
              text: promptText,
              parse_mode: "HTML",
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
            `2️⃣ <b>/setbuyrate</b>\n` +
            `• <b>ጥቅም፦</b> የ USDT መግዣ ዋጋን ለመቀየር።\n` +
            `• <b>አጠቃቀም፦</b> <code>/setbuyrate 193</code>\n\n` +
            `3️⃣ <b>/pause</b>\n` +
            `• <b>ጥቅም፦</b> ቦቱን ለጥገና ወይም እረፍት ለጊዜው ሽያጭ እንዳይቀበል ለማቆም።\n` +
            `• <b>አጠቃቀም፦</b> <code>/pause</code>\n\n` +
            `4️⃣ <b>/resume</b>\n` +
            `• <b>ጥቅም፦</b> የቆመውን ቦት ወደ መደበኛ ስራ ለመመለስ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/resume</code>\n\n` +
            `5️⃣ <b>/broadcast</b>\n` +
            `• <b>ጥቅም፦</b> ለቦቱ ተጠቃሚዎች በሙሉ በአንድ ጊዜ ማስታወቂያ ለመላክ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/broadcast ዛሬ ተመን ጨምሯል!</code>\n\n` +
            `6️⃣ <b>/send</b>\n` +
            `• <b>ጥቅም፦</b> ለአንድ የተወሰነ ተጠቃሚ በቴሌግራም ID ብቻ መልዕክት ለመላክ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/send &lt;USER_ID&gt; መልዕክትዎ</code>\n\n` +
            `7️⃣ <b>/stats</b>\n` +
            `• <b>ጥቅም፦</b> አጠቃላይ የትዕዛዞች እና የተጠቃሚዎች ቁጥር ለማየት።\n` +
            `• <b>አጠቃቀም፦</b> <code>/stats</code>\n\n` +
            `8️⃣ <b>/daily</b>\n` +
            `• <b>ጥቅም፦</b> የዛሬውን ቀን ብቻ የተሸጠ USDT እና የወጣ ብር ድምር ለማየት።\n` +
            `• <b>አጠቃቀም፦</b> <code>/daily</code>\n\n` +
            `9️⃣ <b>/statics</b>\n` +
            `• <b>ጥቅም፦</b> የቀጥታ ሰዓት፣ ቀንና የቦቱን አጠቃላይ ተጠቃሚ ከነ ምስል ለማየት።\n` +
            `• <b>አጠቃቀም፦</b> <code>/statics</code>\n\n` +
            `🔟 <b>/ban</b>\n` +
            `• <b>ጥቅም፦</b> ህግ የሚያጠፋ ተጠቃሚን ከቦቱ አገልግሎት ለማገድ።\n` +
            `• <b>አጠቃቀም፦</b> <code>/ban &lt;USER_ID&gt;</code>\n\n` +
            `1️⃣1️⃣ <b>/unban</b>\n` +
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
        if (!order || (order.status !== "pending" && order.status !== "awaiting_permission")) {
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

        if (action === "quick_approve" || action === "buy_allow") {
          order.status = "approved";
          const buyingUser = await User.findOne({ telegramId: order.userId });
          if (buyingUser) {
            buyingUser.step = "awaiting_buy_screenshot";
            buyingUser.tempOrder = { amount: order.amount, total: order.total, account: order.account };
            await buyingUser.save();
          }
          await order.save();

          await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);

          const netKey = order.networkKey || "binance";
          let netEmoji = "💰"; 
          let netDisplayName = "Binance ID";

          if (netKey === "bep20") {
            netEmoji = "🔶";
            netDisplayName = "Bep-20";
          } else if (netKey === "ton") {
            netEmoji = "🤑";
            netDisplayName = "TON";
          } else if (netKey === "aptos") {
            netEmoji = "😟";
            netDisplayName = "Aptos";
          }

          // HTML parse_mode በመጠቀም መጠን፣ ጠቅላላ ብር እና አካውንት ቁጥሮች በሙሉ Bold እና Mono (code) እንዲወጡ ተደርጓል
          const approvedText =
            `✔️ ትዕዛዝዎ ተፈቅዷል፤ ክፍያ መፈጸም ይችላሉ!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💵 የሚገዙት መጠን፦ <b>${order.amount} USDT</b>\n` +
            `💰 የሚከፍሉት ጠቅላላ ብር፦ <b>${Number(order.total || 0).toLocaleString()} ETB</b>\n` +
            `🖥 መቀበያዎ፦ <code>${escapeHTML(order.account)}</code> (${netEmoji}${netDisplayName})\n\n` +
            `⬇️ እባክዎ ትክክለኛውን ብር ከታች ባሉት አማራጮች ገቢ ያድርጉ፡-\n\n` +
            `🏦 Telebirr፦ <code>0949241461</code>\n` +
            `👤 ስም፦ <b>Bereket</b>\n\n` +
            `🏦 CBE ንግድ ባንክ፦ <code>1000725377421</code>\n` +
            `👤 ስም፦ <b>Bereket Wondimhun</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🗓 ክፍያውን እንደፈጸሙ የከፈሉበትን ደረሰኝ (Screenshot) ከስር ይላኩ፡-`;

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: order.userId,
              text: approvedText,
              parse_mode: "HTML"
            })
          });

          await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "✅ Approved!" }) });
          return;
        }

        if (action === "decline" || action === "buy_reject") {
          order.status = "declined";
          await order.save();

          await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);

          const isBuyOrder = action === "buy_reject";
          const declineMsg = isBuyOrder
            ? `🫡 ይቅርታ፣ የ USDT ግዢ ጥያቄዎ በአድሚን ውድቅ ተደርጓል!\n\n💬 ለተጨማሪ መረጃ @Aropc ያነጋግሩ።`
            : `🚫 ትዕዛዝዎ ውድቅ ተደርጓል! ❌\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ የላኩት የክፍያ ደረሰኝ (Screenshot) ትክክል ስላልሆነ በ Admin ውድቅ ተደርጓል።\n\n💬 ለተጨማሪ መረጃ ወይም ቅሬታ ካለዎት Admin ያነጋግሩ፦ @Aropc`;

          await telegram("sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: order.userId,
              text: declineMsg,
              parse_mode: "HTML",
              reply_markup: mainMenuKeyboard
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
