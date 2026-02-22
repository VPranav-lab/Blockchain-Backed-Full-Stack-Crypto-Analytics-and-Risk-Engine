import styles from "./TextField.module.css";

export default function TextField({ label, hint, error, right, ...props }) {
  return (
    <label className={styles.label}>
      <span className={styles.labelText}>{label}</span>
      <div className={styles.row}>
        <input className={`${styles.input} ${error ? styles.inputError : ""}`} {...props} />
        {right ? <div className={styles.right}>{right}</div> : null}
      </div>
      {error ? 
        <div className={styles.error}>{error}</div> 
      : hint ?
        <div className={styles.hint}>{hint}</div> 
        : null}
    </label>
  );
}
/* for line 8
Always apply styles.input
If error exists (not empty) → also apply styles.inputError
Else add nothing
*/

/*
Plain English version
If error exists → show error message
Else if hint exists → show hint message
Else show nothing
*/
