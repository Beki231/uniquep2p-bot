const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const { WEBHOOK_SECRET, ADMIN_CHAT_ID, MONGO_URI, Order, initRates, answerCb, clearAdminOrderButtons } = require("./lib");
const general = require("./flows/general");
const admin = require("./flows/admin");
const sell = require("./flows/sell");
const buy = require("./flows/buy");

const app = express();
app.use(cors());
app.use(express.json());

// Keep-Alive Health Check for cron-job.org
app.get("/", (req, res) => {
  res.status(200).send("Bot is awake!");
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    initRates();
  })
  .catch(err => console.error("MongoDB error:", err));

// ==========================================
// Messages
// ==========================================
async function handleMessage(msg, isAdmin) {
  if (isAdmin) {
    if (await admin.handleReceiptPhoto(msg)) return;
    if (await admin.handleCommand(msg)) return;
  }

  if (!msg.from) return;

  const user = await general.ensureUser(msg);
  if (!user) return;

  const text = msg.text ? msg.text.trim() : "";
  const ctx = { msg, user, text, userId: msg.from.id };

  if (await general.handleMessage(ctx)) return;
  if (await buy.handleMessage(ctx)) return;
  if (await sell.handleMessage(ctx)) return;
}

// ==========================================
// Callback queries
// ==========================================
async function handleCallback(callback, isAdmin) {
  const data = callback.data || "";

  if (data === "check_join") return general.handleCheckJoin(callback);

  if (data.startsWith("buynet:")) return buy.handleUserCallback(callback);
  if (data.startsWith("net:") || data.startsWith("pay:")) return sell.handleUserCallback(callback);

  if (!isAdmin) {
    await answerCb(callback.id);
    return;
  }

  if (data === "open_admin_panel") return admin.openPanel(callback);
  if (data.startsWith("ban_user:")) return admin.banUser(callback);

  const parts = data.split(":");
  const action = parts[0] || "";
  const orderId = parts[1] || "";

  let order = await Order.findOne({ orderId });
  if (!order && callback.message?.message_id) {
    order = await Order.findOne({ adminMessageId: callback.message.message_id });
  }

  if (!order || (order.status !== "pending" && order.status !== "awaiting_permission")) {
    if (callback.message) await clearAdminOrderButtons(callback.message.message_id);
    await answerCb(callback.id, "⚠️ ይህ ትዕዛዝ አስቀድሞ ተስተናግዷል!", true);
    return;
  }

  const ctx = { callback, action, orderId, order };

  if (await sell.handleAdminCallback(ctx)) return;
  if (await buy.handleAdminCallback(ctx)) return;

  await answerCb(callback.id);
}

// ==========================================
// Webhook
// ==========================================
app.post("/telegram-webhook", async (req, res) => {
  if (req.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }
  res.sendStatus(200);

  try {
    const msg = req.body.message;
    const callback = req.body.callback_query;
    const senderId = String(msg?.from?.id || callback?.from?.id || "").trim();
    const isAdmin = senderId !== "" && senderId === ADMIN_CHAT_ID;

    if (msg) {
      await handleMessage(msg, isAdmin);
    } else if (callback) {
      await handleCallback(callback, isAdmin);
    }
  } catch (err) {
    console.error("Webhook processing error:", err.message);
  }
});

process.on("unhandledRejection", err => console.error("Unhandled Rejection:", err && err.message));
process.on("uncaughtException", err => console.error("Uncaught Exception:", err && err.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Normal Bot running on port ${PORT}`);
});
