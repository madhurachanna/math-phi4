import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define the shape of the user state
interface UserState {
    name: string;
    email: string;
    bio: string;
    token: string | null;
    // --- Renamed this field ---
    explanation_level: number; // Use explanation_level to match backend/component
}

// Define the initial state
const initialState: UserState = {
    name: '',
    email: '',
    bio: '',
    token: null,
    // --- Renamed this key and set a default (e.g., 2 for Detailed) ---
    explanation_level: 2, // Default to Detailed level
};

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        // This reducer now correctly handles 'explanation_level' if it's in the payload
        setUser: (state, action: PayloadAction<Partial<UserState>>) => {
            // Using Object.assign is slightly safer for merging partial updates
            Object.assign(state, action.payload);
            // Or stick with spread if preferred and tested:
            // return { ...state, ...action.payload };
        },
        clearUser: (state) => {
            // Reset user state on logout, ensuring all fields are reset
            state.name = initialState.name;
            state.email = initialState.email;
            state.bio = initialState.bio;
            state.token = initialState.token;
            // --- Reset explanation_level too ---
            state.explanation_level = initialState.explanation_level;
        },
        setToken: (state, action: PayloadAction<string | null>) => {
            state.token = action.payload;
        },
        // --- Renamed reducer and updated the field it modifies ---
        setExplanationLevel: (state, action: PayloadAction<number>) => {
            // Add validation if desired (e.g., ensure level is between 1 and 4)
            if (action.payload >= 1 && action.payload <= 4) {
                state.explanation_level = action.payload;
            } else {
                console.warn(`Invalid explanation level received: ${action.payload}. Keeping current level: ${state.explanation_level}`);
            }
        },
    },
});

// Export the actions for use in components - note the renamed action
export const { setUser, clearUser, setToken, setExplanationLevel } = userSlice.actions;

// Export the reducer for the store
export default userSlice.reducer;

