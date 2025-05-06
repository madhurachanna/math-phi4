import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "../services/store/userSlice";
import { listChatSessions } from "../services/api";
import { setActiveSession } from "../services/store/sessionSlice";
import { AppDispatch } from "../services/store";
import { login, getUserProfile } from "../services/api";
import { Link, useNavigate } from 'react-router-dom';

const SignIn: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!email || !password) {
            setError("Email and password are required.");
            return;
        }
        setError("");
        setLoading(true);

        try {
            const credentials = { email, password };
            const loginResponse = await login(credentials);

            if (loginResponse && loginResponse.access_token) {
                const userProfile = await getUserProfile();

                dispatch(setUser({
                    id: userProfile.id,
                    name: userProfile.name,
                    email: userProfile.email,
                    bio: userProfile.bio,
                    explanation_level: userProfile.explanation_level,
                    token: loginResponse.access_token,
                }));

                try {
                    const sessions = await listChatSessions();
                    if (sessions && sessions.length > 0) {
                        console.log(`Setting active session to ID: ${sessions[0].id}`);
                        dispatch(setActiveSession(sessions[0].id));
                    } else {
                        console.log("User has no chat sessions.");
                        dispatch(setActiveSession(null));
                    }
                } catch (sessionError) {
                    console.error("Failed to fetch or set sessions after login:", sessionError);
                    dispatch(setActiveSession(null));
                }

                navigate('/');

            } else {
                setError("Login failed: Could not retrieve token.");
            }

        } catch (err: any) {
            console.error("Sign in error:", err);
            const errorMsg = err?.detail || err?.message || "Login failed. Check credentials.";
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signin w-40 h-auto br4 bg-blur shadow-6 pa4 flex flex-column items-center">
            <h1 className="f2 mb3">Sign In</h1>
            <p className="f4 mb4 text-center">Welcome back!</p>
            {error && <p className="f5 red tc mv2">{error}</p>}
            <div className="w-100 mb3">
                <label className="f5 db mb1" htmlFor="email">Email</label>
                <input className="pa3 ba b--white-20 w-100 bg-near-black near-white br2"
                    type="email" id="email" placeholder="Enter your email" value={email}
                    onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div className="w-100 mb3">
                <label className="f5 db mb1" htmlFor="password">Password</label>
                <input className="pa3 ba b--white-20 w-100 bg-near-black near-white br2"
                    type="password" id="password" placeholder="Enter your password" value={password}
                    onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>
            <div className="mt3 w-100">
                <button className="f4 dim br3 ph3 pv3 dib white bg-og pointer w-100 bn"
                    onClick={handleSubmit} disabled={loading}>
                    {loading ? "Signing In..." : "Sign In"}
                </button>
            </div>
            <p className="mt4 f5 tc">
                Don't have an account? <Link className="link og" to="/signup">Sign Up</Link>
            </p>
        </div>
    );
};

export default SignIn;
