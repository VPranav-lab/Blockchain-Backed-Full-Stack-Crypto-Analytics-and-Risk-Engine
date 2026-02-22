import styles from "../../pages/portfolio/Portfolio.module.css";
//
import { fmtPrice, fmtQty } from "../../utils/format";

export default function PortfolioTable({ rows, onTrade }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th align="left" className={styles.thLeft}>Asset</th>
            <th align="right">Balance</th>
            <th align="right">Avg Buy Price</th>
            <th align="right">Market Price</th>
            <th align="right">Value (USDT)</th>
            <th align="right">PnL</th>
            <th align="right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // Basic values
            const currentVal = Number(row.marketValue);
            const pnlValue = Number(row.unrealizedPnL);
            const isProfit = pnlValue >= 0;
            
            // Handle PEPE "0" Avg Price
            const avgDisplay = row.avgBuyPrice > 0 
              ? fmtPrice(row.avgBuyPrice) 
              : <span className={styles.dim}>—</span>;

            return (
              <tr key={row.symbol} className={styles.row}>
                
                {/* 1. ASSET */}
                <td className={styles.tdLeft}>
                  <div className={styles.assetGroup}>
                    <div className={styles.icon}>{row.symbol.charAt(0)}</div>
                    <div className={styles.assetName}>
                      <span className={styles.sym}>{row.symbol}</span>
                      <span className={styles.badge}>SPOT</span>
                    </div>
                  </div>
                </td>

                {/* 2. BALANCE */}
                <td align="right" className={styles.mono}>{fmtQty(row.quantity)}</td>

                {/* 3. AVG PRICE */}
                <td align="right" className={styles.mono}>
                  <span className={styles.dim}>$</span>{avgDisplay}
                </td>

                {/* 4. MARK PRICE */}
                <td align="right" className={styles.mono}>
                  <span className={styles.dim}>$</span>{fmtPrice(row.currentPrice)}
                </td>

                {/* 5. VALUE */}
                <td align="right" className={styles.valCell}>
                  {currentVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>

                {/* 6. PNL (Percentages Removed) */}
                <td align="right">
                  <div className={styles.pnlColumn}>
                    <span className={`${styles.pnlVal} ${isProfit ? styles.green : styles.red}`}>
                      {isProfit ? "+" : ""}{pnlValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </td>

                {/* 7. ACTION */}
                <td align="right">
                  <button className={styles.tradeBtnTable} onClick={() => onTrade(row.symbol)}>
                    Trade
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}