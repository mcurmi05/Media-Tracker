import {useState} from "react";
import {supabase} from "../services/supabase-client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../components/Loader.jsx";
import "../styles/SignIn.css";

export const SignIn = () => {

    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    if (isAuthenticated) {
        navigate('/');
        return;
    }


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        if (isSignUp) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                setMessage("Error: " + error.message);
            } else if (data.user && !data.session) {
                setMessage("Check your email for confirmation link!");
            } else {
                setMessage("Account created successfully!");
                navigate('/');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                setMessage("Error: " + error.message);
            } else {
                setMessage("Signed in successfully!");
                navigate('/');
            }
        }
        setLoading(false);
    };

    const isError = message.includes("Error");

    return (
        <div className="signin-page">
            <div className="signin-card">

                <div className="signin-header">
                    <h2 className="signin-title">
                        {isSignUp ? "Create an account" : "Welcome back"}
                    </h2>
                    <p className="signin-subtitle">
                        {isSignUp
                            ? "Sign up to start building your library"
                            : "Sign in to continue to your library"}
                    </p>
                </div>

                {message && (
                    <p className={`signin-message ${isError ? "error" : "success"}`}>
                        {message}
                    </p>
                )}

                <form className="signin-form" onSubmit={handleSubmit}>
                    <div className="signin-field">
                        <label className="signin-label" htmlFor="signin-email">Email</label>
                        <input
                            id="signin-email"
                            className="signin-input"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="signin-field">
                        <label className="signin-label" htmlFor="signin-password">Password</label>
                        <div className="signin-password-wrapper">
                            <input
                                id="signin-password"
                                className="signin-input"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="signin-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </div>

                    <button className="signin-submit" type="submit" disabled={loading}>
                        {loading ? <Spinner /> : (isSignUp ? "Sign Up" : "Sign In")}
                    </button>
                </form>

                <div className="signin-divider">
                    {isSignUp ? "Already a member?" : "New here?"}
                </div>

                <button
                    className="signin-toggle"
                    onClick={() => { setIsSignUp(!isSignUp); setMessage(""); }}
                >
                    {isSignUp
                        ? <>Already have an account? <strong>Sign in</strong></>
                        : <>Not registered? <strong>Sign up</strong></>}
                </button>

            </div>
        </div>
    );
}
