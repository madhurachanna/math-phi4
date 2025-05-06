import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

export interface SessionListItem {
    id: number;
    title: string;
    created_at: string;
}

export interface SessionResponse extends SessionListItem {
    user_id: number;
}

export interface MessageResponse {
    id: number;
    session_id: number;
    question: string;
    answer: string;
    timestamp: string;
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.error("Unauthorized request - logging out.");
            localStorage.removeItem("token");
            window.location.assign("/signin");
        }
        return Promise.reject(error);
    }
);

export const setAuthToken = (token: string | null) => {
    if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        localStorage.setItem("token", token);
    } else {
        delete api.defaults.headers.common["Authorization"];
        localStorage.removeItem("token");
    }
};

export const getAuthToken = (): string | null => {
    return localStorage.getItem("token");
};

const token = getAuthToken();
if (token) {
    setAuthToken(token);
}

export const apiRequest = async <T = any>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    data?: any
): Promise<T> => {
    try {
        const response = await api({
            method,
            url,
            data,
        });
        return response.data as T;
    } catch (error: any) {
        console.error("API Error:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export interface UserProfile {
    id: number;
    name: string;
    email: string;
    bio?: string | null;
    explanation_level?: number | null;
}

export const signup = (userData: { name: string; email: string; password: string; bio?: string; explanation_level?: number; }) =>
    apiRequest("POST", "/users/signup", userData);

export const login = async (credentials: { email: string; password: string }) => {
    const data = await apiRequest<{ access_token: string; token_type: string }>("POST", "/users/login", credentials);
    setAuthToken(data.access_token);
    return data;
};

export const logout = () => {
    setAuthToken(null);
};

export const getUserProfile = () => apiRequest<UserProfile>("GET", "/users/me");

export const listChatSessions = () =>
    apiRequest<SessionListItem[]>("GET", "/sessions/");

export const createChatSession = () =>
    apiRequest<SessionResponse>("POST", "/sessions/");

export const getSessionHistory = (sessionId: number) =>
    apiRequest<MessageResponse[]>("GET", `/sessions/${sessionId}/history`);

export const deleteSession = (sessionId: number) =>
    apiRequest<void>("DELETE", `/sessions/${sessionId}`);

export const updateSessionTitle = (sessionId: number, title: string) =>
    apiRequest<SessionResponse>("PUT", `/sessions/${sessionId}`, { title });

export const sendChatMessage = (sessionId: number, question: string) =>
    apiRequest<MessageResponse>("POST", `/sessions/${sessionId}/messages`, { question });

export default api;
