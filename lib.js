const mongoose = require("mongoose");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "").trim();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "my_p2p_secret_key";
const MONGO_URI = process.env.MONGO_URI;
const BOT_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CHANNEL_ID = "@Unique_Techs";

const BANNER_IMAGE_URL = "https://i.postimg.cc/L88G59b1/IMG-20261103-102834-245.jpg";
const STATS_BANNER_URL = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80";

// ==========================================
// Schemas
// ==========================================
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

// ==========================================
// Shared state & rates
// ==========================================
const state = { pendingReceiptOrder: null };

const exchangeRates = { tier1: 178, tier2: 180, tier3: 182, tier4: 185, buyRate: 193 };

async function initRates() {
  try {
    let savedRate = await Rate.findOne({ key: "v2_rates" });
    if (!savedRate) {
      savedRate = await Rate.create({ key: "v2_rates", tier1: 178, tier2: 180, tier3: 182, tier4: 185, buyRate: 193 });
    }
    exchangeRates.tier1 = savedRate.tier1;
    exchangeRates.tier2 = savedRate.tier2;
    exchangeRates.tier3 = savedRate.tier3;
    exchangeRates.tier4 = savedRate.tier4;
    exchangeRates.buyRate = savedRate.buyRate || 193;
  } catch (err) {
    console.error("Rates loading error:", err.message);
  }
}

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

// ==========================================
// Telegram helpers
// ==========================================
async function telegram(method, body) {
  const response = await fetch(`${BOT_API}/${method}`, body);
  const result = await response.json();
  if (!result.ok) {
    console.error(`Telegram API Error [${method}]:`, result);
    throw new Error(result.description || "Telegram API error");
  }
  return result.result;
}

function tg(method, payload) {
  return telegram(method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function answerCb(callbackId, text, showAlert = false) {
  try {
    const payload = { callback_query_id: callbackId };
    if (text) payload.text = text;
    if (showAlert) payload.show_alert = true;
    await tg("answerCallbackQuery", payload);
  } catch (e) {}
}

async function clearAdminOrderButtons(messageId) {
  if (!messageId) return;
  try {
    await tg("editMessageReplyMarkup", {
      chat_id: ADMIN_CHAT_ID,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] }
    });
  } catch (e) {
    console.error("Clear admin buttons error:", e.message);
  }
}

// Text + entities builder (offsets are always correct)
function createText() {
  let text = "";
  const entities = [];
  const api = {
    add(str, emojiId = null, bold = false, extra = null) {
      const offset = text.length;
      const length = str.length;
      text += str;
      if (emojiId) entities.push({ type: "custom_emoji", offset, length, custom_emoji_id: emojiId });
      if (bold) entities.push({ type: "bold", offset, length });
      if (extra) entities.push({ type: extra, offset, length });
      return api;
    },
    get text() { return text; },
    get entities() { return entities; }
  };
  return api;
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
      entities.push({ type: "bold", offset: 0, length: text.length });
    }

    const stickers = await tg("getCustomEmojiStickers", { custom_emoji_ids: CUSTOM_EMOJI_IDS });

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
    const res = await tg("getChatMember", { chat_id: CHANNEL_ID, user_id: userId });
    return ["creator", "administrator", "member", "restricted"].includes(res.status);
  } catch (err) {
    console.error("Membership Check Error:", err.message);
    return false;
  }
}

// ==========================================
// Keyboards & common messages
// ==========================================
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
  await tg("sendMessage", {
    chat_id: chatId,
    text: text || "👇 ከታች ካሉት አማራጮች አንዱን ይምረጡ፦",
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard
  });
}

const WELCOME_CAPTION = "🔥 እንኳን ወደ Unique P2P Store🇪🇹 በደህና መጡ!↔️\n\n ደህንነቱ የተጠበቀ🛡 እና እጅግ ፈጣን የ USDT💵 መገበያያ ቤት!⚡️\n\n ⬇️ የሚፈልጉትን አገልግሎት ከታች ካሉት አማራጮች ይምረጡ፡-";

async function sendWelcome(chatId) {
  const welcomeEntities = await buildCustomEmojiEntities(WELCOME_CAPTION);
  await tg("sendPhoto", {
    chat_id: chatId,
    photo: BANNER_IMAGE_URL,
    caption: WELCOME_CAPTION,
    caption_entities: welcomeEntities,
    reply_markup: mainMenuKeyboard
  });
}

async function checkPaused(userId) {
  const botSettings = await Settings.findOne({ key: "v2_settings" });
  if (botSettings && botSettings.isPaused) {
    await tg("sendMessage", { chat_id: userId, text: botSettings.pauseReason || "⏸️ ቦቱ ለጊዜው ቆሟል።" });
    return true;
  }
  return false;
}

// Shared decline (sell "decline" and buy "buy_reject")
async function declineOrder(order, callback) {
  order.status = "declined";
  await order.save();

  try {
    await User.findOneAndUpdate({ telegramId: order.userId }, { step: "idle", tempOrder: {} });
  } catch (e) {}

  await clearAdminOrderButtons(callback.message?.message_id || order.adminMessageId);

  const declineMsg = `🚫 <b>ትዕዛዝዎ ውድቅ ተደርጓል!</b> ❌\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ የላኩት መረጃ ወይም የክፍያ ደረሰኝ ትክክል ስላልሆነ በ Admin ውድቅ ተደርጓል።\n\n💬 ለተጨማሪ መረጃ ወይም ቅሬታ ካለዎት Admin ያነጋግሩ፦ @Aropc`;

  try {
    await tg("sendMessage", {
      chat_id: order.userId,
      text: declineMsg,
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard
    });
  } catch (e) {}

  await answerCb(callback.id, "❌ Declined!");
}

module.exports = {
  BOT_TOKEN, ADMIN_CHAT_ID, WEBHOOK_SECRET, MONGO_URI, CHANNEL_ID,
  BANNER_IMAGE_URL, STATS_BANNER_URL,
  User, Order, Settings, Rate,
  state, exchangeRates, initRates, getRate, escapeHTML,
  telegram, tg, answerCb, clearAdminOrderButtons,
  createText, buildCustomEmojiEntities, checkMembership,
  mainMenuKeyboard, backToMainKeyboard, sendMainMenu,
  WELCOME_CAPTION, sendWelcome, checkPaused, declineOrder
};
