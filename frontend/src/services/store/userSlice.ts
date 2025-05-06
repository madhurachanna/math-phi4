import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserState {
    id?: number;
    name: string;
    email: string;
    bio: string | null;
    token: string | null;
    explanation_level: number | null;
}

const initialState: UserState = {
    name: '',
    email: '',
    bio: null,
    token: null,
    explanation_level: 2,
};

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<Partial<UserState>>) => {
            Object.assign(state, action.payload);
        },
        clearUser: (state) => {
            Object.assign(state, initialState);
            state.token = null;
        },
        setToken: (state, action: PayloadAction<string | null>) => {
            state.token = action.payload;
        },
        setExplanationLevel: (state, action: PayloadAction<number | null>) => {
            if (action.payload === null || (action.payload >= 1 && action.payload <= 4)) {
                state.explanation_level = action.payload;
            } else {
                console.warn(`Invalid explanation level: ${action.payload}`);
            }
        },
    },
});

export const { setUser, clearUser, setToken, setExplanationLevel } = userSlice.actions;
export default userSlice.reducer;
