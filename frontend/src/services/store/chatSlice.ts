import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getChatHistory } from "../api"; // Ensure correct import

interface ChatMessage {
    id: number;
    question: string;
    answer: string;
}

interface ChatState {
    history: ChatMessage[];
    loading: boolean;
    error: string | null;
}

// Initial State
const initialState: ChatState = {
    history: [],
    loading: false,
    error: null,
};

// Async Thunk to Fetch Chat History
export const fetchChatHistory = createAsyncThunk("chat/fetchHistory", async () => {
    const response = await getChatHistory();
    return response; // Assuming API returns an array of { id, question, answer }
});

const chatSlice = createSlice({
    name: "chat",
    initialState,
    reducers: {
        addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
            state.history.push(action.payload); // ✅ Adds new messages at the bottom
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchChatHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchChatHistory.fulfilled, (state, action: PayloadAction<ChatMessage[]>) => {
                state.loading = false;
                state.history = action.payload;
            })
            .addCase(fetchChatHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || "Failed to fetch chat history";
            });
    },
});

// Export actions and reducer
export const { addChatMessage } = chatSlice.actions;
export default chatSlice.reducer;
