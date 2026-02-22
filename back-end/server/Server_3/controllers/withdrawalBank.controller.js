const personAGateway = require("../services/personA.gateway");

function tokenFromReq(req) {
  return req.headers.authorization || "";
}

exports.getBankDetails = async (req, res) => {
  const utoken = req.auth?.token;
  try {
    const data = await personAGateway.walletGetBank({ token: utoken });

    if (!data?.ok) {
      return res.status(502).json({ message: data?.error || "Failed to fetch bank details" });
    }

    if (!data.bank) {
      return res.status(404).json({ message: "No withdrawal bank account configured" });
    }

    // Keep legacy field names
    res.json({
      bank_name: data.bank.bank_name,
      account_number: data.bank.account_number,
      ifsc_code: data.bank.ifsc_code || {},
      iban: data.bank.iban || {},
      bic: data.bank.bic || {},
      updated_at: data.bank.updated_at,
    });
  } catch (_err) {
    res.status(500).json({ message: "Failed to fetch bank details" });
  }
};

exports.saveBankDetails = async (req, res) => {
  const utoken = req.auth?.token;
  try {
    const { bankName, accountNumber, ifsc, iban, bic, ifscCode } = req.body;

    const ifscNorm = ifscCode || ifsc || null;

    if (!bankName || !accountNumber) {
      return res.status(400).json({ message: "Bank name and account number are required" });
    }

    const payload = { token: utoken, bankName, accountNumber };

    if (iban) payload.iban = iban;
    if (bic) payload.bic = bic;
    if (ifscNorm) payload.ifscCode = ifscNorm;

    const data = await personAGateway.walletSaveBank(payload);

    if (!data?.ok) {
      return res.status(400).json({ message: data?.error || "Failed to save bank details" });
    }

    res.json({ message: "Bank details saved", bank: data.bank });
  } catch (_err) {
    console.log(_err);
    res.status(500).json({ message: "Failed to save bank details" });
  }
};
