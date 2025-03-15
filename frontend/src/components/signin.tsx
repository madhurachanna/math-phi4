import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "../services/store/userSlice"; // Adjust the path accordingly
import { login } from "../services/api"; // Assuming you've defined the login function
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate

const SignIn: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate(); // Initialize navigate

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!email || !password) {
            setError("Email and password are required.");
            return;
        }

        setError("");

        // Send data to backend via login API
        try {
            const credentials = { email, password };
            const response = await login(credentials); // API request to log in

            // On success, store the user data and token in Redux
            dispatch(setUser({
                email: response.email,
                token: response.access_token,
            }));

            // Save the token to localStorage
            localStorage.setItem("token", response.access_token);

            console.log('token', response.access_token)

            // Redirect to the home page after successful login
            navigate('/'); // Navigate to home/dashboard page
        } catch (err) {
            setError("Login failed. Please check your credentials and try again.");
        }
    };

    return (
        <div className="signin w-40 h-auto br4 bg-blur shadow-6 pa4 flex flex-column items-center">
            <h1 className="f2 mb3">Sign In to Your Account! 👋</h1>
            <p className="f4 mb4 text-center">Welcome back, please sign in to continue.</p>

            {error && <p className="f5 red">{error}</p>}

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

            <div className="mt4">
                <button
                    className="f4 dim br3 ph3 pv2 dib white bg-og pointer w-100"
                    onClick={handleSubmit}
                >
                    Sign In
                </button>
            </div>

            <p className="mt4 f5 text-center">
                Don't have an account? <Link className="link" to="/signup">Sign Up</Link> here!
            </p>
        </div>
    );
};

export default SignIn;
