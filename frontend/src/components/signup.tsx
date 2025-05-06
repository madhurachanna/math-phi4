
import React, { useState } from "react";
import VerbositySlider from "./verbositySlider";
import { signup } from "../services/api";
import { Link, useNavigate } from 'react-router-dom';

interface SignupResponse {
    message: string;
}

const SignUp: React.FC = () => {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [bio, setBio] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [explanationLevel, setExplanationLevel] = useState<number>(2);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name || !email || !password || !bio) {
            setError("All fields are required.");
            setSuccessMessage("");
            return;
        }

        setError("");
        setSuccessMessage("");
        setLoading(true);

        try {
            const userData = {
                name,
                email,
                password,
                bio,
                explanation_level: explanationLevel
            };
            const response = await signup(userData) as SignupResponse;

            if (response && response.message === "User created successfully") {
                setSuccessMessage("Signup successful! Redirecting to login...");
                setTimeout(() => {
                    navigate('/signin');
                }, 2000);
            } else {
                console.error("Unexpected signup response:", response);
                setError("Signup might have succeeded, but confirmation failed. Please try logging in.");
            }

        } catch (err: any) {
            console.error("Signup API error:", err);
            const errorMessage = err?.detail || err?.message || "Sign up failed. Please try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signin w-40 h-auto br4 bg-blur shadow-6 pa4 flex flex-column items-center">
            <h1 className="f2 mb3">Sign Up</h1>
            <p className="f4 mb4 text-center">Create your account.</p>

            {error && <p className="f5 red tc mv2 pa2 bg-dark-red br2">{error}</p>}
            {successMessage && <p className="f5 green tc mv2 pa2 bg-dark-green br2">{successMessage}</p>}

            <div className="w-100 mb3">
                <label className="f5 db mb1" htmlFor="name">Your Name</label>
                <input
                    className="pa3 ba b--white-20 w-100 bg-near-black near-white br2"
                    type="text" id="name" placeholder="Enter your name"
                    value={name} onChange={(e) => setName(e.target.value)}
                    disabled={loading || !!successMessage}
                />
            </div>
            <div className="w-100 mb3">
                <label className="f5 db mb1" htmlFor="email">Email</label>
                <input
                    className="pa3 ba b--white-20 w-100 bg-near-black near-white br2"
                    type="email" id="email" placeholder="Enter your email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!successMessage}
                />
            </div>
            <div className="w-100 mb3">
                <label className="f5 db mb1" htmlFor="password">Password</label>
                <input
                    className="pa3 ba b--white-20 w-100 bg-near-black near-white br2"
                    type="password" id="password" placeholder="Enter your password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || !!successMessage}
                />
            </div>
            <div className="w-100 mb3">
                <label className="f5 db mb1" htmlFor="bio">Your Bio</label>
                <textarea
                    className="pa3 ba b--white-20 w-100 bg-near-black near-white br2"
                    id="bio" placeholder="Tell us a little about yourself"
                    value={bio} onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    disabled={loading || !!successMessage}
                />
            </div>

            <VerbositySlider onExplanationLevelChange={setExplanationLevel} />

            <div className="mt4 w-100">
                <button
                    className="f4 dim br3 ph3 pv3 dib white bg-og pointer w-100 bn"
                    onClick={handleSubmit}
                    disabled={loading || !!successMessage}
                >
                    {loading ? "Signing Up..." : "Sign Up"}
                </button>
            </div>

            <p className="mt4 f5 tc">
                Already have an account? <Link className="link og" to="/signin">Sign In</Link>
            </p>
        </div>
    );
};

export default SignUp;
