import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define the shape of the user state
interface UserState {
    name: string;
    email: string;
    bio: string;
    token: string | null;
    level: number;
}

const initialState: UserState = {
    name: '',
    email: '',
    bio: '',
    token: null,
    level: 1,
};
const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<Partial<UserState>>) => {
            return { ...state, ...action.payload };
        },
        clearUser: () => initialState, // Reset user state on logout
        setToken: (state, action: PayloadAction<string | null>) => {
            state.token = action.payload;
        },
        setLevel: (state, action: PayloadAction<number>) => {
            state.level = action.payload;
        },
    },
});

// Export the actions for use in components
export const { setUser, clearUser, setToken, setLevel } = userSlice.actions;

// Export the reducer for the store
export default userSlice.reducer;
