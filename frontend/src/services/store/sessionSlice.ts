import { createSlice, createAsyncThunk, PayloadAction, SerializedError } from "@reduxjs/toolkit";
import {
    listChatSessions,
    createChatSession,
    getSessionHistory,
    deleteSession,
    sendChatMessage,
    SessionResponse,
    SessionListItem,
    MessageResponse
} from "../api";
import type { RootState } from './index';

interface ChatMessage extends MessageResponse {
    isOptimistic?: boolean;
    tempId?: number;
}

interface SessionState {
    sessions: SessionListItem[];
    activeSessionId: number | null;
    messages: ChatMessage[];
    sessionLoading: boolean;
    messageLoading: boolean;
    sendMessageLoading: boolean;
    error: string | null;
}

const initialState: SessionState = {
    sessions: [],
    activeSessionId: null,
    messages: [],
    sessionLoading: false,
    messageLoading: false,
    sendMessageLoading: false,
    error: null,
};

export const fetchSessions = createAsyncThunk(
    "session/fetchSessions",
    async (_, { rejectWithValue }) => {
        try {
            const sessions = await listChatSessions();
            return sessions;
        } catch (error: any) {
            const errorMsg = error?.detail || error?.message || 'Unknown fetch sessions error';
            return rejectWithValue(errorMsg);
        }
    }
);

export const createNewSession = createAsyncThunk(
    "session/createSession",
    async (_, { rejectWithValue }) => {
        try {
            const newSession = await createChatSession();
            return newSession;
        } catch (error: any) {
            const errorMsg = error?.detail || error?.message || 'Unknown create session error';
            return rejectWithValue(errorMsg);
        }
    }
);

export const fetchHistoryForSession = createAsyncThunk(
    "session/fetchHistory",
    async (sessionId: number, { rejectWithValue }) => {
        try {
            const history = await getSessionHistory(sessionId);
            return history;
        } catch (error: any) {
            const errorMsg = error?.detail || error?.message || 'Unknown fetch history error';
            return rejectWithValue(`Failed to fetch history for session ${sessionId}: ${errorMsg}`);
        }
    }
);

export const deleteSessionById = createAsyncThunk(
    "session/deleteSession",
    async (sessionId: number, { rejectWithValue }) => {
        try {
            await deleteSession(sessionId);
            return sessionId;
        } catch (error: any) {
            const errorMsg = error?.detail || error?.message || 'Unknown delete session error';
            return rejectWithValue(`Failed to delete session ${sessionId}: ${errorMsg}`);
        }
    }
);

export const sendMessageToSession = createAsyncThunk(
    'session/sendMessage',
    async (
        { sessionId, question }: { sessionId: number; question: string },
        { dispatch, getState, rejectWithValue }
    ) => {
        const tempId = Date.now();
        const currentState = getState() as RootState;

        if (currentState.session.activeSessionId !== sessionId) {
            return rejectWithValue('Session changed before message could be sent.');
        }

        dispatch(sessionSlice.actions.addOptimisticMessage({
            id: tempId,
            session_id: sessionId,
            question: question,
            answer: "",
            timestamp: new Date().toISOString(),
            isOptimistic: true,
            tempId: tempId,
        }));

        try {
            const response = await sendChatMessage(sessionId, question);
            if (response && response.id) {
                dispatch(sessionSlice.actions.updateOptimisticMessage({
                    ...response,
                    tempId: tempId
                }));
                return response;
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err: any) {
            dispatch(sessionSlice.actions.removeOptimisticMessage({ tempId }));
            const errorMsg = err.detail || err.message || 'Unknown send message error';
            return rejectWithValue(`Error sending message: ${errorMsg}`);
        }
    }
);

const sessionSlice = createSlice({
    name: "session",
    initialState,
    reducers: {
        setActiveSession: (state, action: PayloadAction<number | null>) => {
            if (state.activeSessionId !== action.payload) {
                state.activeSessionId = action.payload;
                state.messages = [];
                state.error = null;
                state.messageLoading = action.payload !== null;
                state.sendMessageLoading = false;
            }
        },
        clearSessionState: (state) => {
            Object.assign(state, initialState);
        },
        setSessionError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.sessionLoading = false;
            state.messageLoading = false;
            state.sendMessageLoading = false;
        },
        addOptimisticMessage: (state, action: PayloadAction<ChatMessage>) => {
            if (action.payload.session_id === state.activeSessionId && !state.messages.some(msg => msg.id === action.payload.id && msg.isOptimistic)) {
                state.messages.push(action.payload);
            }
        },
        updateOptimisticMessage: (state, action: PayloadAction<ChatMessage & { tempId: number }>) => {
            if (action.payload.session_id === state.activeSessionId) {
                const index = state.messages.findIndex(msg => msg.id === action.payload.tempId && msg.isOptimistic);
                if (index !== -1) {
                    state.messages[index] = { ...action.payload, isOptimistic: false, tempId: undefined };
                } else {
                    if (!state.messages.some(msg => msg.id === action.payload.id)) {
                        state.messages.push({ ...action.payload, isOptimistic: false });
                    }
                }
            }
        },
        removeOptimisticMessage: (state, action: PayloadAction<{ tempId: number }>) => {
            state.messages = state.messages.filter(msg => !(msg.id === action.payload.tempId && msg.isOptimistic));
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSessions.pending, (state) => { state.sessionLoading = true; state.error = null; })
            .addCase(fetchSessions.fulfilled, (state, action: PayloadAction<SessionListItem[]>) => {
                state.sessionLoading = false;
                state.sessions = action.payload;
            })
            .addCase(fetchSessions.rejected, (state, action) => { state.sessionLoading = false; state.error = action.payload as string; });

        builder
            .addCase(createNewSession.pending, (state) => { state.sessionLoading = true; })
            .addCase(createNewSession.fulfilled, (state, action: PayloadAction<SessionResponse>) => {
                state.sessionLoading = false;
                const newListItem: SessionListItem = { id: action.payload.id, title: action.payload.title, created_at: action.payload.created_at };
                state.sessions.unshift(newListItem);
                state.activeSessionId = action.payload.id;
                state.messages = [];
                state.error = null;
                state.messageLoading = false;
                state.sendMessageLoading = false;
            })
            .addCase(createNewSession.rejected, (state, action) => { state.sessionLoading = false; state.error = action.payload as string; });

        builder
            .addCase(fetchHistoryForSession.pending, (state, action) => {
                if (state.activeSessionId === action.meta.arg) { state.messageLoading = true; state.error = null; state.messages = []; }
            })
            .addCase(fetchHistoryForSession.fulfilled, (state, action: PayloadAction<MessageResponse[], string, { arg: number }>) => {
                if (state.activeSessionId === action.meta.arg) {
                    state.messageLoading = false;
                    state.messages = action.payload.map(msg => ({ ...msg, isOptimistic: false }));
                }
            })
            .addCase(fetchHistoryForSession.rejected, (state, action: PayloadAction<unknown, string, { arg: number }, any>) => {
                if (state.activeSessionId === action.meta.arg) {
                    state.messageLoading = false;
                    state.error = action.payload as string || `Failed history fetch for session ${action.meta.arg}`;
                }
            });

        builder
            .addCase(deleteSessionById.fulfilled, (state, action: PayloadAction<number>) => {
                const deletedSessionId = action.payload;
                state.sessions = state.sessions.filter(s => s.id !== deletedSessionId);
                if (state.activeSessionId === deletedSessionId) {
                    state.activeSessionId = null;
                    state.messages = [];
                    state.messageLoading = false;
                }
            })
            .addCase(deleteSessionById.rejected, (state, action) => { state.error = action.payload as string; });

        builder
            .addCase(sendMessageToSession.pending, (state) => { state.sendMessageLoading = true; state.error = null; })
            .addCase(sendMessageToSession.fulfilled, (state, action: PayloadAction<MessageResponse>) => {
                state.sendMessageLoading = false;
                const finalMessage = action.payload;
                const index = state.messages.findIndex(msg => msg.id === finalMessage.id);
                if (index !== -1) {
                    state.messages[index] = { ...finalMessage, isOptimistic: false };
                }
            })
            .addCase(sendMessageToSession.rejected, (state, action) => {
                state.sendMessageLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const {
    setActiveSession,
    clearSessionState,
    setSessionError,
} = sessionSlice.actions;

export default sessionSlice.reducer;
