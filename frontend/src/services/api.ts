import axios from "axios";

// Base API URL (Change this to match your backend URL)
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

// Create an Axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Handle expired/invalid token errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token"); // Clear token on unauthorized
            window.location.href = "/signin"; // Redirect to signin
        }
        return Promise.reject(error);
    }
);

// Function to set authentication token in headers
export const setAuthToken = (token: string | null) => {
    if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        localStorage.setItem("token", token); // Save token for persistence
    } else {
        delete api.defaults.headers.common["Authorization"];
        localStorage.removeItem("token");
    }
};

// Function to get the stored token
export const getAuthToken = (): string | null => {
    return localStorage.getItem("token");
};

// Automatically set the token on app load (this ensures the token is available when the app starts)
const token = getAuthToken();
if (token) {
    setAuthToken(token);
}

// Generic API request function
export const apiRequest = async (method: "GET" | "POST" | "PUT" | "DELETE", url: string, data?: any) => {
    try {
        const response = await api({
            method,
            url,
            data,
        });
        return response.data;
    } catch (error: any) {
        console.error("API Error:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Authentication APIs
export const signup = (userData: {
    name: string;
    email: string;
    password: string;
    bio?: string;
    explanation_level?: number;
}) => apiRequest("POST", "/users/signup", userData);

export const login = async (credentials: { email: string; password: string }) => {
    const data = await apiRequest("POST", "/users/login", credentials);
    setAuthToken(data.access_token); // Save token after login
    return data;
};

export const logout = () => {
    setAuthToken(null); // Remove token from headers and storage
};

export const getUserProfile = () => apiRequest("GET", "/users/me");

// Fetch last 15 chat history entries
export const getChatHistory = () => apiRequest("GET", "/chats/history");

// Send a chat message and store it
export const sendChatMessage = (message: string) => apiRequest("POST", "/chats/send", { message });

export default api;
