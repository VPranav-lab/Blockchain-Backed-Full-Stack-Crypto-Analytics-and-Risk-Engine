import styles from "./Alert.module.css";

export default function Alert({ children }) {
  return <div className={styles.alert}>{children}</div>;
}
