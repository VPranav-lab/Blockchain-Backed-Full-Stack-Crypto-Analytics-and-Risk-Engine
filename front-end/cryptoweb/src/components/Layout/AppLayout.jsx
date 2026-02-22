// src/components/Layout/AppLayout.jsx
import Navbar from "./Navbar";
import Footer from "./Footer";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", width: "100%" }}>
      <Navbar />
      <main style={{ 
        flex: 1, 
        width: "100%", 
        padding: "24px", 
        maxWidth: "1440px", 
        margin: "0 auto",
        boxSizing: "border-box" /* Ensures padding doesn't break width */
      }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}