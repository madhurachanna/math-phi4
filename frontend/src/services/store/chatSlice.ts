
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getChatHistory } from "../api"; // Ensure correct import

// Interface for a single chat message
interface ChatMessage {
    id: number; // Can be temporary (timestamp) or final (from DB)
    question: string;
    answer: string;
    isOptimistic?: boolean; // Flag for temporary messages
    tempId?: number;      // Link backend response to optimistic message
}

// Interface for the chat state
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
export const fetchChatHistory = createAsyncThunk(
    "chat/fetchHistory",
    async (_, { rejectWithValue }) => {
        try {
            // Assume API returns latest messages, ordered newest-first
            const response = await getChatHistory();
            // Ensure response is an array, default to empty array if not
            return Array.isArray(response) ? response : [];
        } catch (error: any) {
            return rejectWithValue(error.message || "Failed to fetch history");
        }
    }
);

const chatSlice = createSlice({
    name: "chat",
    initialState,
    reducers: {
        // Action to add/update a chat message
        addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
            const newMessage = action.payload;

            // Check if this message is the final response linked to an optimistic message
            if (newMessage.tempId) {
                const optimisticIndex = state.history.findIndex(
                    (msg) => msg.id === newMessage.tempId && msg.isOptimistic
                );

                if (optimisticIndex !== -1) {
                    // --- UPDATE existing optimistic message ---
                    // Update only the necessary fields: real ID and the answer
                    state.history[optimisticIndex].id = newMessage.id; // Update to real ID from backend
                    state.history[optimisticIndex].answer = newMessage.answer; // Add the answer
                    // Keep the original question from the optimistic message
                    // Mark as no longer optimistic
                    state.history[optimisticIndex].isOptimistic = false;
                    // Remove the temporary ID link property
                    delete state.history[optimisticIndex].tempId;
                } else {
                    // Fallback: If optimistic message wasn't found (should be rare),
                    // add the new message only if it doesn't already exist by real ID.
                    if (!state.history.some(msg => msg.id === newMessage.id)) {
                        state.history.push({ ...newMessage, isOptimistic: false }); // Ensure optimistic flag is false
                    }
                }
            } else {
                // Add new message (initial optimistic or fetched) if not already present by ID
                // Ensure fetched messages don't have optimistic flag
                const messageToAdd = { ...newMessage, isOptimistic: newMessage.isOptimistic ?? false };
                if (!state.history.some(msg => msg.id === messageToAdd.id)) {
                    state.history.push(messageToAdd);
                }
            }
        },
        // Action to explicitly remove a message
        removeChatMessage: (state, action: PayloadAction<{ id: number }>) => {
            state.history = state.history.filter(msg => msg.id !== action.payload.id);
        },
        // Action to set an error message
        setChatError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchChatHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchChatHistory.fulfilled, (state, action: PayloadAction<ChatMessage[]>) => {
                state.loading = false;
                // Reverse the array received from the backend (newest-first)
                // to get oldest-first for rendering top-down
                state.history = action.payload.reverse().map(msg => ({ ...msg, isOptimistic: false }));
                state.error = null; // Clear any previous error
            })
            .addCase(fetchChatHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string || "Failed to fetch chat history";
            });
    },
});

// Export actions and reducer
export const { addChatMessage, removeChatMessage, setChatError } = chatSlice.actions;
export default chatSlice.reducer;
