import styles from "./Button.module.css";

export default function Button({ variant = "primary", ...props }) {
  const cls = variant === "ghost" ? styles.ghost : styles.primary;
  return <button className={cls} {...props} />;
}
// The component returns a React element; React reconciles and updates the DOM