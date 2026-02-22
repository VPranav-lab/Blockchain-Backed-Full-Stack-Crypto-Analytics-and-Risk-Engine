import { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FEATURES } from "../../config/features";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    `${styles.link} ${isActive ? styles.active : ""}`;

  const goOrLogin = (path) => {
    if (isAuthenticated) navigate(path);
    else navigate(`/login?next=${encodeURIComponent(path)}`);
  };

  // Navigation configuration (wallet is disabled until Week 2 merge is complete)
  const items = useMemo(() => {
    const base = [
      { label: "Home", path: "/", public: true },
      { label: "Market", path: "/market", public: true },
      { label: "News", path: "/news", public: true },
      { label: "Dashboard", path: "/dashboard", public: true },
      { label: "Trades", path: "/trades", public: false },
      { label: "Portfolio", path: "/portfolio", public: false },
      { label: "Insights", path: "/insights", public: false },
      { label: "Risk", path: "/risk", public: false },
      { label: "Watchlist", path: "/watchlist", public: false },
      { label: "Strategy", path: "/strategies", public: false },
    ];

    if (FEATURES.WALLET) {
      // Insert Wallet right after Portfolio for consistency
      base.splice(6, 0, { label: "Wallet", path: "/wallet", public: false });
    }

    return base;
  }, []);

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        
        {/* LEFT: BRAND */}
        <div className={styles.left}>
          <NavLink to="/" className={styles.brand} aria-label="Home">
            <span className={styles.logoDot} />
            <span className={styles.brandText}>CryptoWeb</span>
          </NavLink>
        </div>

        {/* CENTER: FLOATING PILL MENU */}
        <div className={styles.center}>
          {items.map((it) => {
            if (it.public || isAuthenticated) {
              return (
                <NavLink key={it.path} to={it.path} className={linkClass}>
                  {it.label}
                </NavLink>
              );
            }
            // Protected items for non-logged users
            return (
              <button
                key={it.path}
                className={styles.linkBtn}
                onClick={() => goOrLogin(it.path)}
                type="button"
              >
                {it.label}
              </button>
            );
          })}
        </div>

        {/* RIGHT: AUTH ACTIONS */}
        <div className={styles.right}>
          {isAuthenticated ? (
            <button className={styles.logoutBtn} onClick={onLogout}>
              Logout
            </button>
          ) : (
            <>
              <NavLink to="/login" className={styles.loginBtn}>
                Log In
              </NavLink>
              <NavLink to="/register" className={styles.registerBtn}>
                Get Started
              </NavLink>
            </>
          )}
        </div>

      </nav>
    </header>
  );
}