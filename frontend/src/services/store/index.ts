// --- File: frontend/src/services/store/index.ts ---
import { configureStore } from "@reduxjs/toolkit";
import sessionReducer from "./sessionSlice";
import userReducer from "./userSlice";

export const store = configureStore({
    reducer: {
        user: userReducer,
        session: sessionReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
