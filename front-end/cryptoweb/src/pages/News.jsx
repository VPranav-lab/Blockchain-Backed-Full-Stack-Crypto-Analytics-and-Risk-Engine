import { useEffect, useState, useMemo } from "react";
import styles from "./News.module.css";
import { newsApi } from "../api/newsApi";

// Minimal SVG Icons (Themed)
const SearchIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
const ClockIcon = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
const ArrowRight = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;

export default function News() {
  const [news, setNews] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [allData, latestData] = await Promise.all([
          newsApi.getAll(),
          newsApi.getLatest()
        ]);
        setNews(allData || []);
        setLatest(latestData || null);
      } catch (e) {
        console.error("News fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const timeAgo = (dateStr) => {
    if (!dateStr) return "Just now";
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const filteredNews = useMemo(() => {
    if (!search) return news;
    const lower = search.toLowerCase();
    return news.filter(n => 
      n.title.toLowerCase().includes(lower) || 
      n.source.toLowerCase().includes(lower)
    );
  }, [news, search]);

  return (
    <div className={styles.page}>
      
      {/* HEADER */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Market Intelligence</h1>
          <p className={styles.subtitle}>Real-time global insights & analysis</p>
        </div>
        <div className={styles.searchWrapper}>
          <div className={styles.searchIcon}><SearchIcon /></div>
          <input 
            type="text" 
            placeholder="Filter headlines..." 
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* TICKER */}
      {!loading && news.length > 0 && (
        <div className={styles.tickerContainer}>
          <div className={styles.tickerLabel}>LIVE WIRE</div>
          <div className={styles.tickerTrack}>
            {news.slice(0, 8).map((n, i) => (
              <span key={i} className={styles.tickerItem}>
                <span className={styles.tickerSource}>{n.source}</span> {n.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* HERO (Latest) */}
      {!loading && latest && !search && (
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>BREAKING NEWS</div>
            <h2 className={styles.heroTitle}>{latest.title}</h2>
            <p className={styles.heroSummary}>{latest.content}</p>
            
            <div className={styles.metaRow}>
              <span style={{color:'var(--accent-b)', textTransform:'uppercase'}}>{latest.source}</span>
              <span style={{opacity:0.3}}>|</span>
              <span style={{display:'flex', alignItems:'center', gap:6}}>
                <ClockIcon /> {timeAgo(latest.published_at)}
              </span>
              
              <a href={latest.url} target="_blank" rel="noreferrer" className={styles.heroLink}>
                Read Coverage <ArrowRight />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* GRID */}
      <div className={styles.feedLabel}>Latest Reports</div>
      
      <div className={styles.grid}>
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skLine} style={{width: '30%', height: 20}} />
              <div className={styles.skLine} style={{width: '90%', height: 24, marginTop: 16}} />
              <div className={styles.skLine} style={{width: '70%', height: 24, marginTop: 8}} />
              <div className={styles.skLine} style={{width: '100%', height: 60, marginTop: 20}} />
            </div>
          ))
        ) : filteredNews.length > 0 ? (
          filteredNews.map((item, idx) => (
            <article key={idx} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.sourceTag}>{item.source}</div>
                <div className={styles.timeTag}>{timeAgo(item.published_at)}</div>
              </div>
              
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardBody}>{item.content}</p>
              
              <div className={styles.cardFooter}>
                <a href={item.url} target="_blank" rel="noreferrer" className={styles.link}>
                  Read Source <ArrowRight />
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className={styles.emptyState}>No results for "{search}"</div>
        )}
      </div>

    </div>
  );
}