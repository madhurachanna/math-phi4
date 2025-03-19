import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchChatHistory, addChatMessage } from "../services/store/chatSlice";
import { RootState, AppDispatch } from "../services/store";
import { sendChatMessage, logout } from "../services/api";
import { useNavigate } from 'react-router-dom';

const TypingEffect: React.FC<{
    text: string; animate: boolean; onUpdate: () => void
}> = ({
    text, animate, onUpdate
}) => {
        const [displayedText, setDisplayedText] = useState(animate ? "" : text);

        useEffect(() => {
            if (!animate) return;
            setDisplayedText("");
            text.split("").forEach((char, index) => {
                setTimeout(() => {
                    setDisplayedText((prev) => prev + char);
                    if (index % 10 === 0) onUpdate();
                }, index * 40);
            });
        }, [text, animate]);

        return <span>{displayedText}</span>;
    };

const ChatWindow: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { history, loading, error } = useSelector((state: RootState) => state.chat);
    const [message, setMessage] = useState("");
    const [newMessageIds, setNewMessageIds] = useState<Set<number>>(new Set());
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        dispatch(fetchChatHistory());
    }, [dispatch]);

    useEffect(() => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 100);
    }, [history]);

    const sendMessage = async () => {
        if (!message.trim()) return;
        try {
            const response = await sendChatMessage(message);
            if (response) {
                dispatch(addChatMessage(response));
                setMessage("");
                setNewMessageIds((prev) => new Set(prev).add(response.id));
            }
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "40px";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 100);
    };

    const handleSignOut = () => {
        logout();
        navigate('/signin');
    };

    return (
        <div className="w-100 h-100 bg-blur flex flex-column">
            <div className="h3 bg-black text-white flex items-center justify-between ph5">
                <div>Chat</div>
                <div className="pointer dim og b" onClick={handleSignOut}>Sign Out</div>
            </div>
            <div className="flex-auto w-100 h-100 overflow-y-auto p-3 custom-scroll">
                <div className="w-100 flex justify-center">
                    <div className="w-40">
                        {loading && <p className="text-center">Loading...</p>}
                        {error && <p className="text-red-500 text-center">{error}</p>}
                        {history.map((chat) => (
                            <div key={chat.id} className="mb-2">
                                <div className="flex justify-end">
                                    <div className="bg-mid-gray text-white pv2 ph3 br4 max-w-xs text-right mv3 ml-4">
                                        {chat.question}
                                    </div>
                                </div>
                                <div className="flex justify-start mt-1">
                                    <div className="bg-dark-gray pa2 ph3 br4 max-w-xs text-left">
                                        <TypingEffect
                                            text={chat.answer}
                                            animate={newMessageIds.has(chat.id)}
                                            onUpdate={scrollToBottom} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                </div>
            </div>
            <div className="relative w-40 center mt3 flex items-center">
                <textarea
                    ref={textareaRef}
                    className="pa3 w-full ba b--black-20 br4 pr10 custom-scroll resize-none textarea-custom"
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value);
                        adjustTextareaHeight();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                />
                <button
                    className="absolute top-1 right-1 bg-gray text-white br-pill pointer bg-og white ba b--orange dim b f3"
                    onClick={sendMessage}
                >
                    &#8593;
                </button>
            </div>
        </div>
    );
};

export default ChatWindow;
