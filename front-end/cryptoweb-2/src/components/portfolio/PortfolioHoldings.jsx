// Go up two folders (../../) to reach 'src', then into 'pages/portfolio'
import styles from "../../pages/portfolio/Portfolio.module.css";
import { useNavigate } from "react-router-dom";

export default function PortfolioHoldings({ positions, loading }) {
  const nav = useNavigate();

  if (loading) return <div className={styles.loadingState}>Syncing Market Data...</div>;
  if (!positions || positions.length === 0) return <div className={styles.emptyState}>No Assets Found</div>;

  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th align="left">Asset</th>
            <th align="right">Balance</th>
            <th align="right">Avg Buy Price</th>
            <th align="right">Live Price</th>
            <th align="right">Value</th>
            <th align="right">PnL</th>
            <th align="right"></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            // --- FRONTEND SAFETY LOGIC ---
            // If backend sends bad data, we default to 0 to stop UI breaks
            const quantity = Number(pos.quantity) || 0;
            const livePrice = Number(pos.currentPrice) || 0;
            const rawAvg = Number(pos.avgBuyPrice);
            const avgPrice = isFinite(rawAvg) && rawAvg > 0 ? rawAvg : 0; 
            
            // Re-calculate PnL percentage on frontend for accuracy
            const pnlVal = Number(pos.unrealizedPnL) || 0;
            const pnlPct = avgPrice > 0 ? ((livePrice - avgPrice) / avgPrice) * 100 : 0;

            return (
              <tr key={pos.symbol} className={styles.row}>
                
                {/* 1. Symbol */}
                <td className={styles.mainCol}>
                  <div className={styles.symbol}>{pos.symbol}</div>
                </td>

                {/* 2. Quantity */}
                <td align="right" className={styles.mono}>
                  {quantity.toFixed(4)}
                </td>

                {/* 3. Avg Price (Safe Render) */}
                <td align="right" className={styles.mono}>
                  ${avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>

                {/* 4. Live Price */}
                <td align="right" className={styles.mono}>
                  ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>

                {/* 5. Total Value */}
                <td align="right" className={styles.valCol}>
                  ${(Number(pos.marketValue) || 0).toLocaleString()}
                </td>

                {/* 6. PnL */}
                <td align="right">
                  <div className={`${styles.pnlBadge} ${pnlVal >= 0 ? styles.bgGreen : styles.bgRed}`}>
                     {pnlVal >= 0 ? "+" : ""}{pnlVal.toFixed(2)}
                     <span className={styles.tinyPct}>{pnlPct.toFixed(2)}%</span>
                  </div>
                </td>

                {/* 7. Action */}
                <td align="right">
                   <button 
                     className={styles.tradeBtn}
                     onClick={() => nav(`/market/${pos.symbol}`)}
                   >
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