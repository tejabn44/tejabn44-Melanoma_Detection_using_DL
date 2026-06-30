import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";

const links = [
  { to: "/", label: "Home" },
  { to: "/upload", label: "Upload" },
  { to: "/tracker", label: "Tracker" },
  { to: "/history", label: "History" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

function Layout({ children }) {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/">
          <span className="brand-mark">D</span>
          <div>
            <strong>DermaTech</strong>
            <p>AI Melanoma Detection</p>
          </div>
        </NavLink>

        <nav className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          {isAuthenticated ? (
            <>
              <span className="user-chip">{user?.name}</span>
              <button className="button button-secondary compact-button" type="button" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink className="nav-link" to="/login">
                Login
              </NavLink>
              <NavLink className="button button-primary compact-button" to="/signup">
                Sign Up
              </NavLink>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="page-container">{children}</main>
    </div>
  );
}

export default Layout;
