import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} aria-label="Footer">
      <div className={styles.inner}>
        <div className={styles.top}>
          {/* Brand */}
          <div className={styles.brandBlock}>
            <div className={styles.brandLine}>
              <span className={styles.dot} />
              <div>
                <div className={styles.brand}>CryptoWeb</div>
                <div className={styles.tagline}>
                  Crypto market analytics and trading simulation with risk, backtesting, and ML insights.
                </div>
              </div>
            </div>
          </div>

          {/* Link columns */}
          <div className={styles.cols}>
            <div className={styles.col}>
              <div className={styles.colTitle}>Platform</div>
              <Link className={styles.link} to="/">Home</Link>
              <Link className={styles.link} to="/market">Market</Link>
              <Link className={styles.link} to="/dashboard">Dashboard</Link>
            </div>

            <div className={styles.col}>
              <div className={styles.colTitle}>Simulation</div>
              <Link className={styles.link} to="/portfolio">Portfolio</Link>
              <Link className={styles.link} to="/trades">Trades</Link>
              <Link className={styles.link} to="/watchlist">Watchlist</Link>
            </div>

            <div className={styles.col}>
              <div className={styles.colTitle}>Resources</div>
              <a className={styles.link} href="#" onClick={(e) => e.preventDefault()}>
                Documentation
              </a>
              <a className={styles.link} href="#" onClick={(e) => e.preventDefault()}>
                API Status
              </a>
              <a className={styles.link} href="#" onClick={(e) => e.preventDefault()}>
                Release Notes
              </a>
            </div>

            <div className={styles.col}>
              <div className={styles.colTitle}>LEGAL</div>
              <a className={styles.link} href="#" onClick={(e) => e.preventDefault()}>
                Privacy Policy
              </a>
              <a className={styles.link} href="#" onClick={(e) => e.preventDefault()}>
                Terms
              </a>
              <a className={styles.link} href="#" onClick={(e) => e.preventDefault()}>
                Contact
              </a>
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.bottom}>
          <div className={styles.bottomLeft}>
            © {year} CryptoWeb • All rights reserved
          </div>

          <div className={styles.bottomRight}>
            <span className={styles.pill}>Secure sessions</span>
            <span className={styles.pill}>Simulation mode</span>
            <span className={styles.pill}>Risk analytics</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
