import { useTheme } from "../context/ThemeContext";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button className="theme-toggle" onClick={toggleTheme} type="button">
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}

export default ThemeToggle;
