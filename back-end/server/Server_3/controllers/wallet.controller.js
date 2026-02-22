const personAGateway = require("../services/personA.gateway");

function tokenFromReq(req) {
  return req.headers.authorization || "";
}

exports.getBalance = async (req, res) => {
    const utoken = req.auth?.token;
  try {
    const data = await personAGateway.walletBalance({ token: utoken });
    if (!data?.ok) {
      return res.status(502).json({ message: data?.error || "Wallet balance proxy failed" });
    }
    res.json({ balance: data.balance });
  } catch (_err) {
    res.status(500).json({ message: "Failed to fetch wallet balance" });
  }
};

exports.getTransactions = async (req, res) => {
    const utoken = req.auth?.token;
  try {
    const data = await personAGateway.walletTransactions({ token: utoken, limit: 200 });
    if (!data?.ok) {
      return res.status(502).json({ message: data?.error || "Wallet transactions proxy failed" });
    }
    // Keep Person C legacy response shape: array
    res.json(data.items || []);
  } catch (_err) {
    res.status(500).json({ message: "Failed to fetch wallet transactions" });
  }
};

exports.deposit = async (req, res) => {
    const utoken = req.auth?.token;
  try {
    const { amount, source, referenceId } = req.body;

    if (!amount || Number(amount) < 1) {
      return res.status(400).json({ message: "Invalid deposit amount" });
    }

    const data = await personAGateway.walletDeposit({
      token: utoken,
      amount: Number(amount),
      source: source || "Unknown",
      referenceId: referenceId || undefined,
    });

    if (!data?.ok) {
      return res.status(400).json({ message: data?.error || "Deposit failed" });
    }

    res.json({ message: "Deposit successful", balance: data.balance });
  } catch (_err) {
    res.status(500).json({ message: "Deposit failed" });
  }
};

exports.withdraw = async (req, res) => {
    const utoken = req.auth?.token;
  try {
    const { amount, referenceId } = req.body;

    if (!amount || Number(amount) < 1) {
      return res.status(400).json({ message: "Invalid withdrawal amount" });
    }

    const data = await personAGateway.walletWithdraw({
      token: utoken,
      amount: Number(amount),
      referenceId: referenceId || undefined,
    });

    if (!data?.ok) {
      // Keep legacy-ish messages
      const msg = String(data?.error || "Withdraw failed");
      if (msg.toLowerCase().includes("insufficient")) {
        return res.status(400).json({ message: "Insufficient wallet balance" });
      }
      if (msg.toLowerCase().includes("bank")) {
        return res.status(400).json({ message: "No withdrawal bank account configured" });
      }
      return res.status(400).json({ message: msg });
    }

    res.json({ message: "Withdraw successful", balance: data.balance });
  } catch (_err) {
    res.status(500).json({ message: "Withdraw failed" });
  }
};
