import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "../services/store/userSlice"; // Adjust the path accordingly
import VerbositySlider from "./verbositySlider";
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
    const [level, setLevel] = useState(1);

    const handleSubmit = async () => {
        if (!name || !email || !password || !bio) {
            setError("All fields are required.");
            return;
        }

        setError("");

        // Send data to backend via signup API
        try {
            const userData = { name, email, password, bio, level };
            const response = await signup(userData); // API request to sign up

            // On success, store the user data in Redux
            dispatch(setUser({
                name: response.name,
                email: response.email,
                bio: response.bio,
                token: response.token,
                level: response.level,
            }));

            // Save the token in localStorage
            localStorage.setItem("token", response.token);

            // Redirect user to the home page
            navigate('/'); // Redirect to home/dashboard after successful signup
        } catch (err) {
            setError("Sign up failed. Please try again.");
        }
    };

    return (
        <div className="signin w-40 h-auto br4 bg-blur shadow-6 pa4 flex flex-column items-center">
            <h1 className="f2 mb3">Sign Up to Your Math Tutorial! 👋</h1>
            <p className="f4 mb4 text-center">Let's get started by creating your account!</p>

            {error && <p className="f5 red">{error}</p>}

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
                />
            </div>

            <VerbositySlider onLevelChange={setLevel} />

            <div className="mt4">
                <button
                    className="f4 dim br3 ph3 pv2 dib white bg-og pointer w-100"
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
