import { Link } from "react-router-dom"; // Link is for internal navigation (Back to home without page reload)
import styles from "./AuthShell.module.css";
/*
<AuthShell title="Welcome back" subtitle="Sign in...">
  login form here
// </AuthShell>
*/
// Login chooses what to show. AuthShell chooses how it looks.
// {children} is the “content slot” where Login’s UI gets injected.

export default function AuthShell({
  title,
  subtitle,
  children,
  brand = "CryptoWeb",
  tagline = "Market analytics • Trading simulation • Risk insights",
}) {
  return (
    <div className={styles.page}>
      <div className={styles.bgGrid} />

      <div className={styles.shell}>
        <aside className={styles.left}>
          <div className={styles.brandRow}>
            <div className={styles.logoMark} aria-hidden />
            <div className={styles.brandText}>
              <div className={styles.brandName}>{brand}</div>
              <div className={styles.brandTagline}>{tagline}</div>
            </div>
          </div>

          <div className={styles.hero}>
            <h2 className={styles.heroTitle}>A premium crypto dashboard UI.</h2>
            <p className={styles.heroSub}>
              Clean auth, pro layout, and a modern exchange feel — perfect for your demos.
            </p>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statTop}>Mode</div>
              <div className={styles.statVal}>Demo</div>
              <div className={styles.statHint}>backend plug-in ready</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTop}>Charts</div>
              <div className={styles.statVal}>Recharts</div>
              <div className={styles.statHint}>pro visuals</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTop}>Security</div>
              <div className={styles.statVal}>JWT</div>
              <div className={styles.statHint}>guard routes</div>
            </div>
          </div>

          <div className={styles.trustRow}>
            <span className={styles.pill}>2FA-ready</span>
            <span className={styles.pill}>Audit logs</span>
            <span className={styles.pill}>Risk engine</span>
            <span className={styles.pill}>Backtesting</span>
          </div>
        </aside>

        <main className={styles.right}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>{title}</div>
              {subtitle ? <div className={styles.cardSub}>{subtitle}</div> : null}
            </div>

            {children}
            

            <div className={styles.bottomLinks}>
              <Link className={styles.mutedLink} to="/">
                ← Back to Home
              </Link>
              <span className={styles.dot} />
              <Link className={styles.mutedLink} to="/terms">
                Terms
              </Link>
              <span className={styles.dot} />
              <Link className={styles.mutedLink} to="/privacy">
                Privacy
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
/*
Rendering / component tree: AuthShell is the parent wrapper because the <form /> appears 
inside {children}.

Logic / control: Login is the controller/owner of the form logic because state, validation,
submit handler live in Login.jsx.
*/