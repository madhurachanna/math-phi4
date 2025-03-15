import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser, clearUser } from './services/store/userSlice';
import { getUserProfile } from './services/api';
import SignUp from './components/signup';
import SignIn from './components/signin';
import Chat from './components/chat'; // Home/dashboard component
import './App.css';

const App: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            console.log('taken at app', token)
            if (token) {
                try {
                    const userData = await getUserProfile();
                    dispatch(setUser(userData)); // Store user info in Redux
                    if (location.pathname === "/signin" || location.pathname === "/signup") {
                        navigate('/'); // Redirect authenticated users to home
                    }
                } catch (error) {
                    console.error("Failed to fetch user data:", error);
                    localStorage.removeItem("token"); // Clear token if invalid
                    dispatch(clearUser());
                }
            } else {
                if (location.pathname !== "/signup") {
                    navigate('/signin'); // Redirect unauthenticated users to signin
                }
            }
        };

        fetchUser();
    }, [dispatch, navigate, location.pathname]);

    return (
        <div className="App">
            <Routes>
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/" element={<Chat />} /> {/* Protected home route */}
            </Routes>
        </div>
    );
};

export default App;
