import { Outlet } from "react-router-dom"; // is a placeholder

export default function Layout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <Outlet /> 
    </div> // React Router renders the matched child route element into the <Outlet />.
    // Mention the key condition: Outlet only works when routes are nested
  );
}
