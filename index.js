import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // cobre IPN antigo (form)

const PORT = process.env.PORT || 3000;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;              // *** LIVE ***
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; // opcional p/ log

async function log(msg, extra = null) {
  console.log(msg, extra ?? "");
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      content: `🧾 **MP Webhook**: ${msg}\n${extra ? "```json\n" + JSON.stringify(extra, null, 2) + "\n```" : ""}`
    });
  } catch (e) {
    console.log("Falha ao logar no Discord:", e?.response?.status, e?.message);
  }
}

app.get("/", (_, res) => res.status(200).send("OK"));

// MP pode chamar GET (IPN) ou POST (Webhook novo)
app.get("/webhook", async (req, res) => { await handle(req.query).catch(()=>{}); res.sendStatus(200); });
app.post("/webhook", async (req, res) => { await handle(req.body).catch(()=>{}); res.sendStatus(200); });

async function handle(payload) {
  let type = payload?.type || payload?.topic || payload?.action;
  let id =
    payload?.data?.id ||
    payload?.id ||
    payload?.["data.id"] ||
    (payload?.resource ? String(payload.resource).split("/").pop() : null);

  await log("Notificação recebida", { type, id });

  if (type !== "payment" || !id) return;

  const payment = await getPayment(id);
  await log("Pagamento consultado", { id: payment.id, status: payment.status });

  if (payment?.status === "approved") {
    await onPaymentApproved(payment);
  }
}

async function getPayment(paymentId) {
  const { data } = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` }
  });
  return data;
}

// >>> Troque este bloco pela chamada que libera o seu produto no bot <<<
async function onPaymentApproved(payment) {
  await log("💸 APROVADO! Liberar produto.", {
    payer: payment.payer?.email,
    valor: payment.transaction_details?.total_paid_amount
  });

  // Exemplo (se seu bot tiver uma API HTTP):
  // await axios.post("https://SEU-ROBO/api/liberar", {
  //   payment_id: payment.id,
  //   buyer_email: payment.payer?.email
  // });
}

app.listen(PORT, () => console.log(`Webhook online na porta ${PORT}`));
