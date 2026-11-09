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
const PROOF_CHANNEL_ID = "@Ut_proof";

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
    caption:
      `🌐 <b>የመረጡት ኔትወርክ:</b> Binance Pay UID\n\n` +
      `📬 <b>የመላኪያ አድራሻ:</b>👇\n\n` +
      `🆔 <b>Binance UID :</b> <code>1182277662</code>\n` +
      `👤 <b>Nickname :</b> <code>UniqueTech</code>\n\n` +
      `👇 <b>USDT ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦</b>`
  },
  bep20: {
    name: "BEP-20 (BSC)",
    caption:
      `🌐 <b>የመረጡት ኔትወርክ:</b> BEP-20 (BSC)\n\n` +
      `📬 <b>የመላኪያ አድራሻ:</b>👇\n\n` +
      `🪎 <b>Address :</b> <code>0xdc6bffaecee233cb3a1b41513349fd4cf842a486</code>\n\n` +
      `👆 <i>Address በመንካት Copy አርጉ</i>\n\n` +
      `👇 <b>USDT ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦</b>`
  },
  ton: {
    name: "TON Network",
    caption:
      `🌐 <b>የመረጡት ኔትወርክ:</b> TON Network\n\n` +
      `📬 <b>የመላኪያ አድራሻ:</b>👇\n\n` +
      `🪎 <b>Address :</b> <code>UQBnagfOnShZYOgwPOfCy5Jx5dr80D9p4laxNvORleI4YT9j</code>\n\n` +
      `👆 <i>Address በመንካት Copy አርጉ</i>\n\n` +
      `👇 <b>ክሪፕቶውን ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦</b>`
  },
  ltc: {
    name: "Litecoin (LTC)",
    caption:
      `🌐 <b>የመረጡት ኔትወርክ:</b> Litecoin (LTC)\n\n` +
      `📬 <b>የመላኪያ አድራሻ:</b>👇\n\n` +
      `🪎 <b>Address :</b> <code>LMSESUBB5Ee9JschXusNrqKTQjMSr4d6sc</code>\n\n` +
      `👆 <i>Address በመንካት Copy አርጉ</i>\n\n` +
      `👇 <b>ክሪፕቶውን ከላኩ በኋላ ብር የሚቀበሉበትን ዘዴ ይምረጡ፦</b>`
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

async function postProofToChannel(order, receiptPhotoId = null) {
  try {
    const rawName = order.userName || "ደንበኛ";
    const maskedName = rawName.length > 3 ? rawName.substring(0, 3) + "***" : rawName + "***";
    const proofCaption = 
      `🎉 <b>የተጠናቀቀ የ P2P ግብይት ማረጋገጫ!</b> ✅\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>ደንበኛ:</b> ${maskedName}\n` +
      `💵 <b>የተሸጠው USDT:</b> ${order.amount} USDT\n` +
      `💰 <b>የተከፈለው ብር:</b> ${Number(order.total || 0).toLocaleString()} ETB\n` +
      `🏦 <b>የክፍያ መንገድ:</b> ${order.method}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <i>ደህንነቱ የተጠበቀ ፈጣን P2P ንግድ በ @Unique_techs</i>`;

    const actualReceipt = receiptPhotoId || order.receiptFileId;

    if (order.customerProofFileId && actualReceipt) {
      await telegram("sendMediaGroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: PROOF_CHANNEL_ID,
          media: [
            { type: "photo", media: String(order.customerProofFileId) },
            { type: "photo", media: String(actualReceipt), caption: proofCaption, parse_mode: "HTML" }
          ]
        })
      });
    } else if (actualReceipt || order.customerProofFileId) {
      await telegram("sendPhoto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: PROOF_CHANNEL_ID,
          photo: String(actualReceipt || order.customerProofFileId),
          caption: proofCaption,
          parse_mode: "HTML"
        })
      });
    } else {
      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: PROOF_CHANNEL_ID,
          text: proofCaption,
          parse_mode: "HTML"
        })
      });
    }
  } catch (proofErr) {
    console.error("Auto post to proof channel error:", proofErr.message);
  }
}

const mainMenuKeyboard = {
  keyboard: [
    [{ text: "💵 USDT መሸጥ" }, { text: "🛒 USDT መግዛት" }],
    [{ text: "📊 የዛሬ ተመን" }, { text: "📜 የትዕዛዝ ታሪክ" }],
    [{ text: "〽️ እንዴት ይሰራል?" }, { text: "📞 ድጋፍ / አድሚን" }]
  ],
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

        const userMsg = 
          `✅ <b>የትዕዛዝ ማረጋገጫ እና ደረሰኝ፦</b>\n\n` +
          `የ <b>${order.amount} USDT</b> ሽያጭ ትዕዛዝዎ ጸድቋል!\n` +
          `💰 <b>${Number(order.total || 0).toLocaleString()} ETB</b> ወደ ${order.method} አካውንትዎ ገቢ ተደርጓል።\n\n` +
          `👆 <i>የተከፈለበት ደረሰኝ ከላይ ተያይዟል። ከ Unique P2P ጋር ስለሰሩ እናመሰግናለን! 🙏</i>`;

        try {
          await telegram("sendPhoto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: order.userId, photo: adminReceiptPhotoId, caption: userMsg, parse_mode: "HTML" })
          });
        } catch (e) {
          console.error("User receipt send error:", e.message);
        }

        await postProofToChannel(order, adminReceiptPhotoId);

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: `✅ ደረሰኙ ለተጠቃሚው ተልኳል፤ ወደ ${PROOF_CHANNEL_ID} ተለጥፏል!` })
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

      const welcomeText = 
        `👋 <b>እንኳን ወደ Unique P2P Store🇪🇹 በደህና መጡ!</b>\n\n` +
        `🔐 <b>ደህንነቱ የተጠበቀ እና እጅግ ፈጣን የ USDT መገበያያ ቤት!</b>\n\n` +
        `👇 <b>ለመገበያየት ከስር ያሉትን አዝራሮች ይጠቀሙ፦</b>`;

      await telegram("sendPhoto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: userId,
          photo: BANNER_IMAGE_URL,
          caption: welcomeText,
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard
        })
      });
      return;
    }

    if (text === "〽️ እንዴት ይሰራል?") {
      const howItWorksText = 
        `📖 <b>ቦቱ እንዴት ይሰራል? (HOW IT WORKS)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `USDT ለመሸጥ የሚከተሉትን ቅደም ተከተሎች ይከተሉ፦\n\n` +
        `1️⃣ <b>መጠን ያስገቡ፦</b>\n` +
        `🔰 መሸጥ የሚፈልጉትን የ USDT መጠን በቁጥር ይላኩ (ዝቅተኛው መጠን 0.5 USDT ነው።)\n\n` +
        `2️⃣ <b>ባንክ ይምረጡ፦</b>\n` +
        `📍 ብር መቀበል የሚፈልጉበትን ባንክ (Telebirr፣ CBE፣ ወዘተ) ከተዘረዘሩት አማራጮች ይምረጡ።\n\n` +
        `3️⃣ 📌 <b>የሂሳብ መረጃዎን ይላኩ፦</b>\n` +
        `• የመረጡትን የባንክ ሂሳብ ቁጥር እና ሙሉ ስምዎን በትክክል ጽፈው ይላኩ።\n\n` +
        `4️⃣ 📎 <b>ክፍያ ፈጽመው ስክሪንሾት ይላኩ፦</b>\n` +
        `• በሚሰጠው አድራሻ ወይም UID ላይ USDT ገቢ በማድረግ የስክሪንሾት (Screenshot) ፎቶ ይላኩ።\n\n` +
        `5️⃣ 📌 <b>ብርዎን ይቀበሉ፦</b>\n` +
        `• ክፍያዎ በአድሚን ተረጋግጦ በደቂቃዎች ውስጥ ወደ ሂሳብዎ ገቢ ይደረጋል!\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 <b>Unique Store— ፈጣን፣ ታማኝ እና አስተማማኝ!</b>`;

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: userId,
          text: howItWorksText,
          parse_mode: "HTML"
        })
      });
      return;
    }

    if (text === "📊 የዛሬ ተመን") {
      const rateText = 
        `📈 <b>የዛሬ የ USDT መሸጫ ዋጋዎች፦</b>\n━━━━━━━━━━━━━━━━━━\n` +
        `🔹 0.5 - 0.9 USDT ➡️ <b>${exchangeRates.tier1} ETB</b>\n` +
        `🔹 1.0 - 10 USDT ➡️ <b>${exchangeRates.tier2} ETB</b>\n` +
        `🔹 11 - 30 USDT ➡️ <b>${exchangeRates.tier3} ETB</b>\n` +
        `🔥 31+ USDT ➡️ <b>${exchangeRates.tier4} ETB (ምርጥ ተመን)</b>\n━━━━━━━━━━━━━━━━━━\n` +
        `<i>ለመሸጥ "💵 USDT መሸጥ" የሚለውን ይጫኑ!</i>`;
      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId, text: rateText, parse_mode: "HTML" })
      });
      return;
    }

    if (text === "🛒 USDT መግዛት") {
      const buyText =
        `🛒 <b>USDT መግዛት</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📖 <i>ይህ አገልግሎት በቅርቡ ይጀምራል፤ ዝግጅቱን እያጠናቀቅን ነው።\n\n` +
        `አገልግሎቱ ክፍት ሲሆን ወዲያውኑ ማሳወቂያ ይደርሳችኋል። እባክዎ በትዕግስት ይጠብቁን!</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━`;

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: userId,
          text: buyText,
          parse_mode: "HTML"
        })
      });
      return;
    }

    if (text === "📜 የትዕዛዝ ታሪክ") {
      const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
      if (!orders || orders.length === 0) {
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: userId, text: "📜 እስካሁን ምንም የተመዘገበ ትዕዛዝ የለዎትም።" })
        });
        return;
      }

      let historyText = `📜 <b>የቅርብ ጊዜ የትዕዛዝ ታሪክዎ፦</b>\n━━━━━━━━━━━━━━━━━━\n`;
      orders.forEach(o => {
        const statusEmoji = o.status === "approved" ? "✅ ጸድቋል" : o.status === "declined" ? "❌ ውድቅ" : "⏳ በሂደት";
        historyText += `💵 <b>${o.amount} USDT</b> (${Number(o.total || 0).toLocaleString()} ETB)\n🏦 ዘዴ: ${o.method} | ሁኔታ: <b>${statusEmoji}</b>\n━━━━━━━━━━━━━━━━━━\n`;
      });

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId, text: historyText, parse_mode: "HTML" })
      });
      return;
    }

    if (text === "📞 ድጋፍ / አድሚን") {
      const supportText = 
        `📞 <b>የደንበኞች ድጋፍ እና ማህበረሰብ</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👉 <b>ማንኛውም ጥያቄ፣ አስተያየት ወይም እርዳታ ከፈለጉ በቀጥታ ያናግሩን፡-</b>\n\n` +
        `👤 <b>Admin Support፦</b> @Aropc\n` +
        `📢 <b>Channel፦</b> @Unique_techs\n` +
        `📸 <b>Proof Channel፦</b> @Ut_proof\n\n` +
        `⏰ <b>የስራ ሰዓት</b>፦ <i>24/7 ሁልጊዜ አለን!</i>`;

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: userId,
          text: supportText,
          parse_mode: "HTML"
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

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: userId,
          text: `<b>💵 የሚሸጡትን የ USDT መጠን ያስገቡ፦</b>\n\n<i>ዝቅተኛው መጠን 0.5 USDT ነው</i>`,
          parse_mode: "HTML",
          reply_markup: { keyboard: [[{ text: "❌ ሰርዝ (Cancel)" }]], resize_keyboard: true }
        })
      });
      return;
    }

    // ደረጃ 1፦ መጠን
    if (user.step === "awaiting_amount") {
      const amt = parseFloat(text);
      if (isNaN(amt) || amt < 0.5) {
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: userId, text: "⚠️ እባክዎ ትክክለኛ መጠን ያስገቡ (ዝቅተኛው 0.5 USDT)፦" })
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

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: userId,
          text: `📊 <b>መጠን:</b> ${amt} USDT\n📈 <b>ተመን:</b> 1 USDT = ${rate} ETB\n💰 <b>የሚቀበሉት ድምር:</b> <b>${total.toLocaleString()} ETB</b>\n\n👇 <b>USDT የሚልኩበትን ኔትወርክ ይምረጡ፦</b>`,
          parse_mode: "HTML",
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
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: userId, text: "⚠️ የቴሌብር ቁጥር 09 የሚጀምር 10 ድጅት መሆን አለበት! ደግመው ያስገቡ፦" })
        });
        return;
      }
      if (method === "CBE" && !/^\d{13}$/.test(cleanAcc)) {
        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: userId, text: "⚠️ የንግድ ባንክ (CBE) አካውንት 13 ድጅት መሆን አለበት! ደግመው ያስገቡ፦" })
        });
        return;
      }

      user.tempOrder = { ...(user.tempOrder || {}), account: cleanAcc };
      user.step = "awaiting_name";
      await user.save();

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId, text: "👤 <b>የአካውንቱን ባለቤት ሙሉ ስም ያስገቡ፦</b>", parse_mode: "HTML" })
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

      await telegram("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: userId,
          text: `📸 <b>የመጨረሻ ደረጃ፦</b>\n\nየላኩበትን <b>ደረሰኝ (Screenshot ፎቶ)</b> አሁን ይላኩ፦`,
          parse_mode: "HTML"
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
        await Order.create({
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

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: `🎉 <b>ትዕዛዝዎ በተሳካ ሁኔታ ደርሷል!</b>\n━━━━━━━━━━━━━━━━━━\n🆔 <b>Order:</b> <code>${orderId}</code>\n💵 <b>መጠን:</b> ${orderData.amount || 0} USDT\n💰 <b>የሚከፈለው:</b> ${(Number(orderData.total) || 0).toLocaleString()} ETB\n🏦 <b>ወደ:</b> ${orderData.method || ""} (<code>${orderData.account || ""}</code>)\n\n<i>አድሚኑ ደረሰኙን አረጋግጦ ክፍያውን ወዲያውኑ ገቢ ያደርጋል!</i>`,
            parse_mode: "HTML",
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

        await telegram("sendPhoto", {
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
            text: selectedNet.caption,
            parse_mode: "HTML",
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
          ? "📱 <b>የቴሌብር ስልክ ቁጥርዎን ያስገቡ፦</b>\n<i>ለምሳሌ፦ 0912345678</i>"
          : "🏦 <b>የኢትዮጵያ ንግድ ባንክ (CBE) 13 ድጅት አካውንት ቁጥር ያስገቡ፦</b>";

        await telegram("sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: cbUserId, text: promptText, parse_mode: "HTML" })
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
        await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: `User ${targetId} Banned!` }) });
        await telegram("sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: `🚫 ተጠቃሚ ${targetId} ታግዷል!` }) });
        return;
      }

      const [action, orderId] = callbackData.split(":");
      const order = await Order.findOne({ orderId });
      if (!order || order.status !== "pending") return;

      if (action === "receipt") {
        pendingReceiptOrder = orderId;
        await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id }) });
        await telegram("sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: "📸 የከፈሉበትን ደረሰኝ Screenshot አሁን ይላኩ፦" }) });
        return;
      }

      if (action === "quick_approve") {
        order.status = "approved";
        await order.save();
        await telegram("sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: order.userId, text: `✅ ትዕዛዝዎ ጸድቋል! ${Number(order.total || 0).toLocaleString()} ETB ተከፍሏል።` }) });
        await postProofToChannel(order);
        await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "Approved!" }) });
        return;
      }

      if (action === "decline") {
        order.status = "declined";
        await order.save();
        await telegram("sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: order.userId, text: `❌ ትዕዛዝዎ ውድቅ ተደርጓል። ለጥያቄ @Aropc ያነጋግሩ።` }) });
        await telegram("answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "Declined!" }) });
        return;
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Normal Bot running on port ${PORT}`);
});
