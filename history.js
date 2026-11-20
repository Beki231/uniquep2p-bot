const { Order, tg, createText, backToMainKeyboard } = require("./lib");

// Network icons (same custom emoji as the BUY inline keyboard; LTC from the SELL keyboard)
const NET_INFO = {
  binance: { label: "Binance ID", icon: "🟠", emoji: "5202068941580550229" },
  bep20: { label: "BEP-20", icon: "🔶", emoji: "5291786530606562380" },
  ton: { label: "TON", icon: "💎", emoji: "5350716797622442220" },
  aptos: { label: "Aptos", icon: "⚪", emoji: "5327975761833913214" },
  ltc: { label: "Litecoin (LTC)", icon: "🪙", emoji: "5829979991886011025" }
};

const METHOD_EMOJI = {
  Telebirr: "5805526032945519867",
  CBE: "5805572156599312646"
};

// Works for new orders (networkKey) and old ones (only the network name was saved)
function detectNetKey(order) {
  if (order.networkKey && NET_INFO[order.networkKey]) return order.networkKey;
  const n = String(order.network || "").toLowerCase();
  if (n.includes("binance")) return "binance";
  if (n.includes("bep")) return "bep20";
  if (n.includes("ltc") || n.includes("litecoin")) return "ltc";
  if (n.includes("aptos")) return "aptos";
  if (n.includes("ton")) return "ton";
  return null;
}

function statusInfo(order) {
  if (order.status === "declined") {
    return { icon: "❌", emoji: "5040042498634810056", text: "ውድቅ" };
  }
  if (order.status === "pending") {
    return { icon: "⌛", emoji: "6267229004311303657", text: "በሂደት" };
  }
  if (order.status === "awaiting_permission") {
    return { icon: "⌛", emoji: "6267229004311303657", text: "ፈቃድ በመጠበቅ ላይ" };
  }
  // approved
  if (order.orderType === "buy" && !order.customerProofFileId) {
    // Admin allowed the purchase, customer has not sent the payment screenshot yet
    return { icon: "⌛", emoji: "6267229004311303657", text: "ክፍያ በመጠበቅ ላይ" };
  }
  return { icon: "✔️", emoji: "5039844895779455925", text: "ጸድቋል" };
}

// "📜 የትዕዛዝ ታሪክ". Returns true if handled.
async function handleMessage(ctx) {
  const { text, userId } = ctx;
  if (text !== "📜 የትዕዛዝ ታሪክ") return false;

 const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
 
  if (!orders.length) {
    const empty = createText();
    empty.add("📣", "6267129592998270736");
    empty.add(" እስካሁን ምንም ዓይነት ትዕዛዝ አልፈጸሙም!");

    await tg("sendMessage", {
      chat_id: userId,
      text: empty.text,
      entities: empty.entities,
      reply_markup: backToMainKeyboard
    });
    return true;
  }

  const t = createText();
  t.add("🕯", "4956492465465984073");
  t.add(" የቅርብ ጊዜ የትዕዛዝ ታሪክዎ፦\n━━━━━━━━━━━━━━━━━━\n");

  for (const o of orders) {
    const isSell = o.orderType === "sell";

    // Type: sell or buy
    t.add(isSell ? "🔴 USDT መሸጥ" : "🟢 USDT መግዛት", null, true);
    t.add("\n");

    // Amount
    t.add("💵", "4956601935592424315");
    t.add(` ${o.amount} USDT (${Number(o.total || 0).toLocaleString()} ETB)\n`);

    // Network
    const netKey = detectNetKey(o);
    if (netKey) {
      const n = NET_INFO[netKey];
      t.add("🌐 ኔትወርክ: ");
      t.add(n.icon, n.emoji);
      t.add(` ${n.label}\n`);
    }

    // Method (sell only) + status
    t.add("📌", "5462912132351797094");
    if (isSell && METHOD_EMOJI[o.method]) {
      t.add(` ዘዴ: ${o.method}`);
      t.add("🏦", METHOD_EMOJI[o.method]);
      t.add(" | ");
    } else {
      t.add(" ");
    }

    const st = statusInfo(o);
    t.add("ሁኔታ: ");
    t.add(st.icon, st.emoji);
    t.add(` ${st.text}\n━━━━━━━━━━━━━━━━━━\n`);
  }

  await tg("sendMessage", {
    chat_id: userId,
    text: t.text,
    entities: t.entities,
    reply_markup: backToMainKeyboard
  });
  return true;
}

module.exports = { handleMessage };
