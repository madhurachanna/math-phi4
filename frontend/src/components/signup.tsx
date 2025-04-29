import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "../services/store/userSlice"; // Adjust the path accordingly
import VerbositySlider from "./verbositySlider"; // Assuming this component exists
import { signup } from "../services/api"; // Assuming you've defined the signup function
import { Link, useNavigate } from 'react-router-dom';

const SignUp: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate(); // For redirecting after successful sign up

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [bio, setBio] = useState("");
    const [error, setError] = useState("");
    // --- Renamed state variable and setter ---
    const [explanationLevel, setExplanationLevel] = useState<number>(1); // Default to level 1 (e.g., Concise)

    const handleSubmit = async () => {
        if (!name || !email || !password || !bio) {
            setError("All fields are required.");
            return;
        }

        setError("");

        // Send data to backend via signup API
        try {
            // --- Changed key name to match backend expectation ---
            const userData = {
                name,
                email,
                password,
                bio,
                explanation_level: explanationLevel // Use snake_case key and correct state variable
            };
            const response = await signup(userData); // API request to sign up

            // Assuming the backend response includes the user details and token,
            // and uses 'explanation_level' as the key for the level.
            if (response && response.token && response.name && response.email) {
                // On success, store the user data in Redux
                dispatch(setUser({
                    name: response.name,
                    email: response.email,
                    bio: response.bio,
                    token: response.token,
                    // --- Read correct field name from backend response ---
                    explanation_level: response.explanation_level, // Assuming backend returns explanation_level
                }));

                // Save the token in localStorage
                localStorage.setItem("token", response.token);

                // Redirect user to the home page
                navigate('/'); // Redirect to home/dashboard after successful signup
            } else {
                // Handle cases where the response might be missing expected data
                console.error("Signup response missing expected data:", response);
                setError("Signup completed but failed to retrieve user details. Please try logging in.");
            }

        } catch (err: any) { // Catch specific error types if possible
            console.error("Signup API error:", err);
            // Provide more specific error feedback if available from the error object
            const errorMessage = err.response?.data?.detail || "Sign up failed. Please try again.";
            setError(errorMessage);
        }
    };

    return (
        <div className="signin w-40 h-auto br4 bg-blur shadow-6 pa4 flex flex-column items-center">
            <h1 className="f2 mb3">Sign Up to Your Math Tutorial! 👋</h1>
            <p className="f4 mb4 text-center">Let's get started by creating your account!</p>

            {error && <p className="f5 red tc mv2">{error}</p>} {/* Centered error */}

            <div className="w-100 mb3">
                <label className="f5 db" htmlFor="name">Your Name</label>
                <input
                    className="pa3 ma2 ba b--black-20 w-100"
                    type="text"
                    id="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            <div className="w-100 mb3">
                <label className="f5 db" htmlFor="email">Email</label>
                <input
                    className="pa3 ma2 ba b--black-20 w-100"
                    type="email"
                    id="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>

            <div className="w-100 mb3">
                <label className="f5 db" htmlFor="password">Password</label>
                <input
                    className="pa3 ma2 ba b--black-20 w-100"
                    type="password"
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>

            <div className="w-100 mb3">
                <label className="f5 db" htmlFor="bio">Your Bio</label>
                <textarea
                    className="pa3 ma2 ba b--black-20 w-100"
                    id="bio"
                    placeholder="Tell us a little about yourself"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3} // Added rows for better textarea appearance
                />
            </div>

            {/* --- Renamed prop passed to VerbositySlider ---
             * NOTE: You will also need to update the VerbositySlider component
             * to accept 'onExplanationLevelChange' as a prop instead of 'onLevelChange'
             * and ensure it calls this function with the numeric level (1-4).
             */}
            <VerbositySlider onExplanationLevelChange={setExplanationLevel} />

            <div className="mt4 w-100"> {/* Ensure button takes full width of its container */}
                <button
                    className="f4 dim br3 ph3 pv2 dib white bg-og pointer w-100" // Use w-100 for full width
                    onClick={handleSubmit}
                >
                    Sign Up
                </button>
            </div>

            <p className="mt4 f5 text-center">
                Already have an account? <Link className="link" to="/signin">Sign In</Link> here!
            </p>
        </div>
    );
};

export default SignUp;
