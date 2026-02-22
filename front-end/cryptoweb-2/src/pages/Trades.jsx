import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./Trades.module.css";

// ✅ API Imports
import { marketApi } from "../api/marketApi";
import { tradeApi } from "../api/tradeApi";
import { walletApi } from "../api/walletApi";
import { FEATURES } from "../config/features";
import { useLivePrices } from "../hooks/useLivePrices";
import { fmtPrice, fmtQty } from "../utils/format";
import { ledgerApi } from "../api/ledgerApi";

// --- HELPERS ---
const Alert = ({ type, text }) => (
  <div className={type === "error" ? styles.alertError : styles.alertSuccess}>{text}</div>
);

const TabButton = ({ active, onClick, label, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`${active ? styles.typeActive : styles.typeBtn} ${disabled ? styles.disabledTab : ""}`}
    title={disabled ? "Available for Sell only" : ""}
    type="button"
  >
    {label}
  </button>
);

// Try multiple known shapes from your ledger receipt API
function extractTradeFromReceipt(receipt) {
  if (!receipt) return null;

  const leaf = receipt.leaf || null;
  const leafPayload =
    leaf?.payloadFromLedger ||
    leaf?.payload ||
    leaf?.data ||
    leaf?.item ||
    leaf?.record ||
    null;

  if (leafPayload?.trade) return leafPayload.trade;

  if (leafPayload && (leafPayload.symbol || leafPayload.side || leafPayload.qty || leafPayload.price)) {
    return leafPayload;
  }

  const p = receipt.payloadFromLedger ?? receipt.payload ?? receipt.trade ?? null;
  if (p?.trade) return p.trade;
  if (p && (p.symbol || p.side || p.qty || p.price)) return p;

  return null;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statusPillClass(status, styles) {
  const s = String(status || "").toUpperCase();
  if (s === "REVERSED") return styles.pillWarn;
  if (s === "CANCELLED" || s === "REJECTED") return styles.pillNeutral;
  if (s === "FILLED" || s === "CONFIRMED") return styles.pillOk;
  if (s === "PENDING") return styles.pillWarn;
  return styles.pillNeutral;
}

function ReceiptModal({ open, onClose, loading, err, receipt, tradeRow, symbolFallback }) {
  if (!open) return null;

  const tradeId = tradeRow?.fillId ?? tradeRow?.id ?? null;
  const engineStatus = String(tradeRow?.status || "—").toUpperCase();

  const trade = extractTradeFromReceipt(receipt);

  const side = String(trade?.side ?? tradeRow?.side ?? receipt?.side ?? "").toUpperCase();
  const symbol = String(trade?.symbol ?? tradeRow?.symbol ?? symbolFallback ?? "").toUpperCase();

  const qty = trade?.qty ?? trade?.quantity ?? trade?.filledQty ?? tradeRow?.qty ?? tradeRow?.quantity ?? "";
  const price =
    trade?.price ??
    receipt?.executionPrice ??
    receipt?.price ??
    trade?.executionPrice ??
    tradeRow?.price ??
    "";

  const grossQuote = trade?.gross_quote ?? trade?.grossQuote ?? trade?.gross ?? receipt?.grossQuote ?? tradeRow?.grossQuote ?? "";
  const feeQuote = trade?.fee_quote ?? trade?.feeQuote ?? receipt?.feeQuote ?? tradeRow?.feeQuote ?? "0";
  const netQuote = trade?.net_quote ?? trade?.netQuote ?? receipt?.netQuote ?? tradeRow?.netQuote ?? "";

  const ledgerStatus = String(trade?.status ?? receipt?.status ?? "—").toUpperCase();

  const walletTxId =
    trade?.wallet_tx_id ??
    trade?.walletTxId ??
    receipt?.walletTxId ??
    receipt?.wallet_tx_id ??
    tradeRow?.walletTxId ??
    null;

  const executedAtRaw =
    trade?.created_at ?? trade?.createdAt ?? receipt?.createdAt ?? receipt?.executedAt ?? tradeRow?.executedAt ?? tradeRow?.timestamp ?? null;
  const executedAt = executedAtRaw ? new Date(executedAtRaw).toLocaleString() : "—";

  const blockHeight =
    receipt?.pointers?.height ??
    receipt?.blockHeader?.height ??
    receipt?.blockHeight ??
    receipt?.block_height ??
    trade?.ledger_block_height ??
    trade?.ledgerBlockHeight ??
    tradeRow?.ledgerBlockHeight ??
    null;

  const blockHash =
    receipt?.pointers?.blockHash ??
    receipt?.blockHeader?.hash ??
    receipt?.blockHash ??
    receipt?.block_hash ??
    null;

  const proofOk =
    receipt?.verification?.proofOk ??
    receipt?.verification?.ok ??
    receipt?.proofOk ??
    (receipt?.verified === true ? true : false);

  const merkle = receipt?.merkleProof ?? receipt?.merkle_proof ?? null;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    } catch {}
  };

  const priceN = safeNum(price);
  const grossN = safeNum(grossQuote);
  const feeN = safeNum(feeQuote);
  const netN = safeNum(netQuote);

  const sideClass = side === "BUY" ? styles.textBuy : styles.textSell;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.receiptModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.receiptHeader}>
          <div>
            <div className={styles.receiptTitle}>Trade Receipt</div>
            <div className={styles.receiptSub}>
              Trade ID: <span className={styles.mono}>{tradeId ?? "—"}</span>
            </div>
          </div>

          <div className={styles.receiptHeaderActions}>
            <button className={styles.miniGhostBtn} onClick={copyJson} type="button">
              Copy JSON
            </button>
            <button className={styles.closeBtn} onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        {engineStatus === "REVERSED" ? (
          <div className={styles.receiptWarn}>
            This trade fill is <b>REVERSED</b> by admin. The receipt below is the original on-chain fill (it remains committed),
            and the reversal is recorded as a compensating wallet adjustment.
          </div>
        ) : null}

        {loading ? <div className={styles.receiptLoading}>Loading receipt…</div> : null}
        {err ? <div className={styles.receiptWarn}>{err}</div> : null}
        {!loading && !err && !receipt ? <div className={styles.receiptEmpty}>No receipt data.</div> : null}

        {!loading && receipt ? (
          <>
            <div className={styles.receiptSummaryCard}>
              <div className={styles.receiptGrid2}>
                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Trade status (engine)</div>
                  <div className={`${styles.receiptValue} ${statusPillClass(engineStatus, styles)}`}>{engineStatus}</div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Ledger status (fill)</div>
                  <div className={`${styles.receiptValue} ${statusPillClass(ledgerStatus, styles)}`}>{ledgerStatus}</div>
                </div>
              </div>

              <div className={styles.receiptGrid2} style={{ marginTop: 10 }}>
                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Pair</div>
                  <div className={styles.receiptValue}>{symbol || "—"}</div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Side</div>
                  <div className={`${styles.receiptValue} ${sideClass}`}>{side || "—"}</div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Quantity</div>
                  <div className={`${styles.receiptValue} ${styles.mono}`}>{qty || "—"}</div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Price</div>
                  <div className={`${styles.receiptValue} ${styles.mono}`}>
                    {priceN != null ? `$${fmtPrice(priceN)}` : "—"}
                  </div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Total</div>
                  <div className={`${styles.receiptValue} ${styles.mono}`}>
                    {grossN != null ? `${grossN.toLocaleString()} USDT` : "—"}
                  </div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Fee</div>
                  <div className={`${styles.receiptValue} ${styles.mono}`}>
                    {feeN != null ? `${feeN.toLocaleString()} USDT` : "0 USDT"}
                  </div>
                </div>
              </div>

              <div className={styles.receiptGrid2} style={{ marginTop: 12 }}>
                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Net</div>
                  <div className={`${styles.receiptValue} ${styles.mono}`}>
                    {netN != null ? `${netN.toLocaleString()} USDT` : "—"}
                  </div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Wallet Tx ID</div>
                  <div className={`${styles.receiptValue} ${styles.mono}`}>{walletTxId ?? "—"}</div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Executed</div>
                  <div className={styles.receiptValue}>{executedAt}</div>
                </div>
              </div>
            </div>

            <details className={styles.receiptDetails} open>
              <summary className={styles.receiptSummaryLine}>
                Ledger Verification
                <span className={proofOk ? styles.proofOk : styles.proofWarn}>
                  {proofOk ? "Verified" : "Unverified / Pending"}
                </span>
              </summary>

              <div className={styles.detailsBody}>
                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Block Height</div>
                  <div className={`${styles.receiptValue} ${styles.mono}`}>{blockHeight ?? "—"}</div>
                </div>

                <div className={styles.receiptRow}>
                  <div className={styles.receiptLabel}>Block Hash</div>
                  <div className={`${styles.receiptValue} ${styles.mono} ${styles.hashWrap}`}>{blockHash ?? "—"}</div>
                </div>

                {receipt?.pending ? (
                  <div className={styles.receiptWarn} style={{ marginTop: 10 }}>
                    Receipt pending: fill not yet included in a committed block.
                  </div>
                ) : null}
              </div>
            </details>

            <details className={styles.receiptDetails}>
              <summary className={styles.receiptSummaryLine}>Cryptographic Proof (Advanced)</summary>
              <div className={styles.detailsBody}>
                {!merkle ? (
                  <div className={styles.receiptEmpty}>No Merkle proof data.</div>
                ) : (
                  <>
                    <div className={styles.receiptRow}>
                      <div className={styles.receiptLabel}>Algorithm</div>
                      <div className={`${styles.receiptValue} ${styles.mono}`}>{merkle.algorithm || "—"}</div>
                    </div>

                    <div className={styles.proofSteps}>
                      <div className={styles.receiptLabel} style={{ marginBottom: 6 }}>
                        Steps
                      </div>
                      <pre className={styles.proofPre}>
                        {JSON.stringify(merkle.steps || merkle, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function Trades() {
  const [searchParams] = useSearchParams();
  const urlSymbol = searchParams.get("symbol");

  const [symbol, setSymbol] = useState(urlSymbol || "BTCUSDT");
  const [symbolsList, setSymbolsList] = useState([]);

  // Order Form
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("LIMIT"); // LIMIT | MARKET | STOP
  const [qty, setQty] = useState("");
  const [priceInput, setPriceInput] = useState(""); // used for LIMIT + STOP (backend expects one price)

  // UI Status
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("OPEN");

  // Receipt modal state
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptErr, setReceiptErr] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [receiptTradeRow, setReceiptTradeRow] = useState(null);

  // Data store
  const [history, setHistory] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [holdings, setHoldings] = useState([]);

  // Live Prices
  const liveMap = useLivePrices({ baseUrl: "http://localhost:4000", refreshMs: 1000 });
  const livePrice = Number(liveMap.get(symbol) || 0);

  const refreshLock = useRef(false);

  // ✅ ALWAYS refresh from backend (source of truth)
  const refreshData = useCallback(async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;

    try {
      const [histRes, openRes, holdingsRes, w] = await Promise.all([
        tradeApi.getTradeHistory().catch(() => []),
        tradeApi.getOpenOrders().catch(() => []),
        tradeApi.getUserHoldings().catch(() => ({ positions: [] })),
        FEATURES.WALLET ? walletApi.getBalance().catch(() => null) : Promise.resolve(null),
      ]);

      setHistory(Array.isArray(histRes) ? histRes : []);
      setOpenOrders(Array.isArray(openRes) ? openRes : []);
      setHoldings(Array.isArray(holdingsRes?.positions) ? holdingsRes.positions : []);

      if (FEATURES.WALLET) setCashBalance(Number(w?.balance || 0));
      else setCashBalance(0);
    } catch (e) {
      console.error("Global Refresh Failed", e);
    } finally {
      refreshLock.current = false;
    }
  }, []);

  useEffect(() => {
    marketApi
      .symbols()
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.data || [];
        setSymbolsList(list.filter((s) => s.symbol.endsWith("USDT")));
      })
      .catch(console.error);

    refreshData();
  }, [refreshData]);

  // ✅ silent refresh
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshData();
    }, 10000);
    return () => clearInterval(id);
  }, [refreshData]);

  const baseAsset = symbol.replace("USDT", "");
  const quoteAsset = "USDT";

  const avail = useMemo(() => {
    if (side === "BUY") return cashBalance;

    const pos = holdings.find(
      (h) =>
        String(h.symbol || "").toUpperCase() === baseAsset.toUpperCase() ||
        String(h.symbol || "").toUpperCase() === symbol.toUpperCase()
    );

    return Number(pos?.quantity || pos?.qty || 0);
  }, [side, cashBalance, holdings, baseAsset, symbol]);

  const availAsset = side === "BUY" ? quoteAsset : baseAsset;

  const estTotal = useMemo(() => {
    const p = orderType === "MARKET" ? livePrice : Number(priceInput);
    if (!p || !qty) return "0.00";
    return (p * Number(qty)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }, [qty, priceInput, livePrice, orderType]);

  useEffect(() => {
    if (urlSymbol) setSymbol(urlSymbol);

    // For LIMIT/STOP default price = live if empty
    if (livePrice > 0 && !priceInput && (orderType === "LIMIT" || orderType === "STOP")) {
      setPriceInput(livePrice.toFixed(2));
    }
  }, [urlSymbol, livePrice, orderType, priceInput]);

  const handleSideChange = (newSide) => {
    setSide(newSide);
    setMsg({ type: "", text: "" });

    // backend rule: STOP only SELL
    if (newSide === "BUY" && orderType === "STOP") setOrderType("LIMIT");
  };

  const handleMax = () => {
    if (!livePrice) return;

    if (side === "SELL") {
      const safeQty = Math.floor(avail * 100000000) / 100000000;
      setQty(String(safeQty));
    } else {
      const p = Number(priceInput) || livePrice;
      const safeUsd = cashBalance * 0.99;
      const maxBuy = (safeUsd / p).toFixed(6);
      setQty(maxBuy);
    }
  };

  const onViewTradeReceipt = async (tradeRow) => {
    const tradeId = tradeRow?.fillId ?? tradeRow?.id;
    if (!tradeId) return alert("Missing trade fill id");

    setReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptErr("");
    setReceipt(null);
    setReceiptTradeRow(tradeRow);

    try {
      const r = await ledgerApi.getTradeReceipt(tradeId);

      if (r?.pending) {
        setReceiptErr("Receipt pending: fill not yet included in a committed block.");
        setReceipt(null);
      } else {
        setReceipt(r);
        setReceiptErr("");
      }
    } catch (e) {
      setReceiptErr(e.response?.data?.error || e.message);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleSubmit = async () => {
    setMsg({ type: "", text: "" });
    setLoading(true);

    try {
      const quantity = Number(qty);
      const price = Number(priceInput);

      if (!quantity || quantity <= 0) throw new Error("Enter valid quantity");

      // STOP is SELL only (backend rule)
      if (orderType === "STOP" && side === "BUY") {
        throw new Error("Stop-Loss is Sell Only");
      }

      // LIMIT + STOP both require price (backend requires priceIn)
      if (orderType !== "MARKET" && (!price || price <= 0)) {
        throw new Error("Enter valid price");
      }

      await tradeApi.execute({
        symbol,
        side,
        quantity,
        type: orderType,
        price: orderType === "MARKET" ? undefined : price,
      });

      setMsg({ type: "success", text: "Order Placed Successfully" });
      setQty("");

      setActiveTab(orderType === "MARKET" ? "TRADES" : "OPEN");
      await refreshData();
      setTimeout(() => refreshData(), 1200);
    } catch (err) {
      console.error(err);
      setMsg({
        type: "error",
        text: err.response?.data?.message || err.message || "Execution Failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    await tradeApi.cancelOrder(id);
    refreshData();
  };

  const getButtonText = () => {
    if (loading) return "Processing...";
    if (orderType === "STOP") return `${side} ${baseAsset} (Stop)`;
    return `${side} ${baseAsset}`;
  };

  return (
    <div className={styles.page}>
      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        loading={receiptLoading}
        err={receiptErr}
        receipt={receipt}
        tradeRow={receiptTradeRow}
        symbolFallback={symbol}
      />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.ticker}>
          <div className={styles.selectWrap}>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={styles.symSelect}>
              {symbolsList.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}
                </option>
              ))}
            </select>
            <span className={styles.arrow}>▼</span>
          </div>

          <div className={styles.priceBox}>
            <span className={styles.livePrice}>${fmtPrice(livePrice)}</span>
            <span className={styles.liveTag}>LIVE</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.balance}>
            <div className={styles.balLabel}>Available {availAsset}</div>
            <div className={styles.balValue}>{fmtQty(avail)}</div>
          </div>

          <button className={styles.refreshBtn} onClick={refreshData} type="button" disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Order Form */}
        <div className={styles.formCard}>
          <div className={styles.sideTabs}>
            <button onClick={() => handleSideChange("BUY")} className={side === "BUY" ? styles.btnBuyActive : styles.btnSide}>
              Buy
            </button>
            <button onClick={() => handleSideChange("SELL")} className={side === "SELL" ? styles.btnSellActive : styles.btnSide}>
              Sell
            </button>
          </div>

          <div className={styles.typeTabs}>
            <TabButton active={orderType === "LIMIT"} onClick={() => setOrderType("LIMIT")} label="Limit" />
            <TabButton active={orderType === "MARKET"} onClick={() => setOrderType("MARKET")} label="Market" />
            <TabButton
              active={orderType === "STOP"}
              onClick={() => setOrderType("STOP")}
              label="Stop-Loss"
              disabled={side === "BUY"}
            />
          </div>

          <div className={styles.inputStack}>
            {/* ✅ LIMIT and STOP share SAME price input (backend supports only price) */}
            {orderType !== "MARKET" && (
              <div className={styles.field}>
                <label>Price</label>
                <div className={styles.inputWrap}>
                  <input
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder={fmtPrice(livePrice)}
                  />
                  <span className={styles.suffix}>USDT</span>
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label>Amount</label>
              <div className={styles.inputWrap}>
                <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00" />
                <button onClick={handleMax} className={styles.maxBtn} type="button">
                  MAX
                </button>
                <span className={styles.suffix} style={{ marginLeft: 8 }}>
                  {baseAsset}
                </span>
              </div>
            </div>

            <div className={styles.estBox}>
              <span>Est. Total</span>
              <span className={styles.estVal}>≈ {estTotal} USDT</span>
            </div>

            {msg.text && <Alert type={msg.type} text={msg.text} />}

            <button
              className={`${styles.submitBtn} ${side === "BUY" ? styles.submitBuy : styles.submitSell}`}
              onClick={handleSubmit}
              disabled={loading}
              type="button"
            >
              {getButtonText()}
            </button>
          </div>
        </div>

        {/* Tables */}
        <div className={styles.dataCard}>
          <div className={styles.dataHeader}>
            <button onClick={() => setActiveTab("OPEN")} className={activeTab === "OPEN" ? styles.tabActive : styles.tab} type="button">
              Open Orders ({openOrders.length})
            </button>
            <button onClick={() => setActiveTab("TRADES")} className={activeTab === "TRADES" ? styles.tabActive : styles.tab} type="button">
              Trade History ({history.length})
            </button>
          </div>

          <div className={styles.tableBox}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Side</th>
                  <th align="right">Price</th>
                  <th align="right">Qty</th>
                  <th>Status</th>
                  <th align="right">Action</th>
                </tr>
              </thead>

              <tbody>
                {activeTab === "OPEN" &&
                  (openOrders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className={styles.empty}>
                        No Open Orders
                      </td>
                    </tr>
                  ) : (
                    openOrders.map((o) => (
                      <tr key={o.id}>
                        <td className={styles.mono}>{new Date(o.timestamp).toLocaleTimeString()}</td>
                        <td>{o.symbol}</td>
                        <td>
                          <span className={styles.badge}>{o.orderType}</span>
                        </td>
                        <td className={o.side === "BUY" ? styles.textBuy : styles.textSell}>{o.side}</td>
                        <td align="right" className={styles.mono}>
                          {fmtPrice(o.price)}
                        </td>
                        <td align="right" className={styles.mono}>{fmtQty(o.qty ?? o.quantity)}</td>
                        <td>
                          <span className={`${styles.statusPill} ${styles.pillWarn}`}>OPEN</span>
                        </td>
                        <td align="right">
                          <button onClick={() => handleCancel(o.id)} className={styles.cancelLink} type="button">
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))
                  ))}

                {activeTab === "TRADES" &&
                  (history.length === 0 ? (
                    <tr>
                      <td colSpan="8" className={styles.empty}>
                        No trades found
                      </td>
                    </tr>
                  ) : (
                    history.map((t) => {
                      const st = String(t.status || "—").toUpperCase();
                      return (
                        <tr key={t.id}>
                          <td className={styles.mono}>{new Date(t.executedAt || t.timestamp).toLocaleTimeString()}</td>
                          <td>{t.symbol}</td>
                          <td>
                            <span className={styles.badge}>{t.source || t.type || "MARKET"}</span>
                          </td>
                          <td className={t.side === "BUY" ? styles.textBuy : styles.textSell}>{t.side}</td>
                          <td align="right" className={styles.mono}>
                            {fmtPrice(t.price)}
                          </td>
                          <td align="right" className={styles.mono}>
                            {fmtQty(t.qty || t.quantity)}
                          </td>
                          <td>
                            <span className={`${styles.statusPill} ${statusPillClass(st, styles)}`}>{st}</span>
                          </td>
                          <td align="right">
                            <button onClick={() => onViewTradeReceipt(t)} className={styles.receiptBtn} type="button">
                              View Receipt
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
