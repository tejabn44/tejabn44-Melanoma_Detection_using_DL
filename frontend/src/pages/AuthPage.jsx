import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/upload";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (isSignup) {
        await signup(form);
      } else {
        await login(form);
      }
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      const message =
        requestError.response?.data?.error ||
        `Could not connect to the Flask API at ${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000"}.`;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="auth-card card">
        <span className="eyebrow">{isSignup ? "Create Account" : "Welcome Back"}</span>
        <h1>{isSignup ? "Sign up for DermaTech" : "Log in to DermaTech"}</h1>
        <p>
          {isSignup
            ? "Create a secure account before running image analysis."
            : "Use your account to access upload, results, heatmaps, and saved history."}
        </p>

        <form className="auth-form" onSubmit={submitAuth}>
          {isSignup && (
            <label>
              Name
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : isSignup ? "Sign Up" : "Log In"}
          </button>
        </form>

        {error && <p className="error-banner">{error}</p>}

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "Need an account?"}{" "}
          <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Sign up"}</Link>
        </p>
      </div>
    </section>
  );
}

export default AuthPage;
