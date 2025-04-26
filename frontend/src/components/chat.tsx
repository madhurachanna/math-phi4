import React, { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchChatHistory, addChatMessage, removeChatMessage, setChatError } from "../services/store/chatSlice";
import { RootState, AppDispatch } from "../services/store";
import { sendChatMessage, logout } from "../services/api";
import { useNavigate } from 'react-router-dom';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// --- CSS for Pulsing Placeholder Text ---
const placeholderStyle = `
@keyframes pulseOpacity {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.pulsing-placeholder {
  animation: pulseOpacity 1.8s infinite ease-in-out;
  color: #bdbdbd; /* Placeholder text color */
  font-style: italic;
}
`;

// --- Typing Effect Component ---
// (Code remains the same as the previous version)
const TypingEffect: React.FC<{ nodes: React.ReactNode[]; onUpdate: () => void; onComplete: () => void }> = ({ nodes, onUpdate, onComplete }) => {
    const [displayedNodes, setDisplayedNodes] = useState<React.ReactNode[]>([]);
    const nodeIndexRef = useRef(0);
    const charIndexRef = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentTextNodeContent = useRef<string>("");
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        setDisplayedNodes([]);
        nodeIndexRef.current = 0;
        charIndexRef.current = 0;
        currentTextNodeContent.current = "";
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const processNode = () => {
            if (!isMounted.current) return;
            if (nodeIndexRef.current >= nodes.length) {
                onComplete();
                return;
            }

            const currentNode = nodes[nodeIndexRef.current];
            let isTextNode = false;
            let textContent = "";

            if (typeof currentNode === 'string') {
                isTextNode = true;
                textContent = currentNode;
            } else if (React.isValidElement(currentNode) && currentNode.type === 'span') {
                const element = currentNode as React.ReactElement<{ children?: React.ReactNode }>;
                if (typeof element.props.children === 'string') {
                    isTextNode = true;
                    textContent = element.props.children;
                }
            }

            if (isTextNode) {
                if (charIndexRef.current === 0) {
                    currentTextNodeContent.current = textContent;
                    const initialElement = typeof currentNode === 'string'
                        ? <span className="near-white" key={`text-${nodeIndexRef.current}`}></span>
                        : React.cloneElement(currentNode as React.ReactElement, { key: `text-${nodeIndexRef.current}` }, "");
                    if (isMounted.current) setDisplayedNodes(prev => [...prev.slice(0, nodeIndexRef.current), initialElement]);
                }

                if (charIndexRef.current < currentTextNodeContent.current.length) {
                    const nextChar = currentTextNodeContent.current[charIndexRef.current];
                    if (isMounted.current) {
                        setDisplayedNodes(prev => {
                            const updatedNodes = [...prev];
                            const lastNode = updatedNodes[nodeIndexRef.current];
                            if (React.isValidElement(lastNode)) {
                                const typedLastNode = lastNode as React.ReactElement<{ children?: string }>;
                                const currentChildren = typeof typedLastNode.props.children === 'string' ? typedLastNode.props.children : '';
                                updatedNodes[nodeIndexRef.current] = React.cloneElement(typedLastNode, { key: `text-${nodeIndexRef.current}` }, currentChildren + nextChar);
                            }
                            return updatedNodes;
                        });
                    }
                    charIndexRef.current += 1;
                    if (charIndexRef.current % 5 === 0 || charIndexRef.current === currentTextNodeContent.current.length) onUpdate();
                    timeoutRef.current = setTimeout(processNode, 25);
                } else {
                    nodeIndexRef.current += 1;
                    charIndexRef.current = 0;
                    currentTextNodeContent.current = "";
                    processNode();
                }
            } else {
                const nodeToAdd = React.isValidElement(currentNode) && currentNode.key == null
                    ? React.cloneElement(currentNode, { key: `node-${nodeIndexRef.current}` })
                    : currentNode;
                if (isMounted.current) setDisplayedNodes(prev => [...prev, nodeToAdd]);
                nodeIndexRef.current += 1;
                onUpdate();
                processNode();
            }
        };
        processNode();
        return () => {
            isMounted.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [nodes, onUpdate, onComplete]);

    return <>{displayedNodes}</>;
};


// --- Message Content Renderer ---
// (Code remains the same as the previous version)
const renderMessageContent = (content: string): React.ReactNode[] => {
    const regex = /(\\\[.*?\\\]|\\\(.*?\\\))/g;
    const parts = content.split(regex);

    return parts
        .filter(part => part && part.trim() !== '')
        .map((part, index) => {
            try {
                if (part.startsWith('\\(') && part.endsWith('\\)')) {
                    const mathContent = part.slice(2, -2);
                    return mathContent ? <InlineMath key={`inline-${index}`}>{mathContent}</InlineMath> : null;
                }
                else if (part.startsWith('\\[') && part.endsWith('\\]')) {
                    const mathContent = part.slice(2, -2);
                    return mathContent ? <div key={`block-${index}`} className="db mv1"><BlockMath>{mathContent}</BlockMath></div> : null;
                }
                else {
                    return (
                        <span className="near-white lh-copy" key={`text-${index}`}>
                            {part}
                        </span>
                    );
                }
            } catch (error) {
                console.error("Error rendering KaTeX for part:", part, error);
                return (
                    <span className="near-white i light-red lh-copy" key={`error-${index}`}>
                        {`[Error rendering: ${part}]`}
                    </span>
                );
            }
        })
        .filter(node => node !== null) as React.ReactNode[];
};


// --- Chat Window Component ---
const ChatWindow: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { history = [], loading: historyLoading, error } = useSelector((state: RootState) => state.chat);
    const [message, setMessage] = useState("");
    const [latestAssistantMessageId, setLatestAssistantMessageId] = useState<number | null>(null);
    const [isWaitingForResponse, setIsWaitingForResponse] = useState<boolean>(false);
    const [isAnimating, setIsAnimating] = useState<boolean>(false);
    // No longer need optimisticMessageId state in component
    // const [optimisticMessageId, setOptimisticMessageId] = useState<number | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        dispatch(fetchChatHistory());
    }, [dispatch]);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 100);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [history, isWaitingForResponse, scrollToBottom]);

    const handleAnimationComplete = useCallback(() => {
        setIsAnimating(false);
    }, []);

    useEffect(() => {
        if (latestAssistantMessageId !== null) {
            // Find the message that should be animating
            const animatingMsg = history.find(msg => msg.id === latestAssistantMessageId);
            // Only start animating if the message exists and has an answer
            if (animatingMsg && animatingMsg.answer) {
                setIsAnimating(true);
            }
        } else {
            setIsAnimating(false);
        }
    }, [latestAssistantMessageId, history]);

    const sendMessage = async () => {
        const trimmedMessage = message.trim();
        // Disable sending if waiting, animating, or message is empty
        if (!trimmedMessage || isWaitingForResponse || isAnimating) return;

        setMessage("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = "40px";
        }
        setLatestAssistantMessageId(null);
        setIsAnimating(false); // Ensure animation state is reset

        // --- Optimistic UI Update ---
        const tempId = Date.now(); // Generate temporary ID
        // Dispatch the user's message optimistically
        dispatch(addChatMessage({
            id: tempId, // Use temporary ID
            question: trimmedMessage,
            answer: "", // Answer is initially empty
            isOptimistic: true // Flag this message as temporary
        }));

        setIsWaitingForResponse(true); // Show the "Reasoning..." placeholder
        scrollToBottom(); // Scroll down

        // --- Call Backend API ---
        try {
            const response = await sendChatMessage(trimmedMessage);
            console.log("Received response from API:", response);
            if (response && response.id) {
                // Dispatch the final message details to update the optimistic one
                dispatch(addChatMessage({
                    id: response.id, // Real ID from backend
                    question: response.question, // Question from backend (usually same as sent)
                    answer: response.answer, // Answer from backend
                    tempId: tempId // Link to the optimistic message ID for update
                }));
                // Set latest ID *after* dispatching the update
                setTimeout(() => setLatestAssistantMessageId(response.id), 0);
            } else {
                console.error("Invalid response received from server (missing ID?):", response);
                if (tempId) dispatch(removeChatMessage({ id: tempId })); // Remove optimistic message
                dispatch(setChatError('Error: Received invalid response from server.'));
            }
        } catch (err) {
            console.error("Failed to send message:", err);
            if (tempId) dispatch(removeChatMessage({ id: tempId })); // Remove optimistic message
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            dispatch(setChatError(`Error: Failed to get response. ${errorMsg}`));
        } finally {
            // Hide placeholder AFTER the update/error handling is done
            setIsWaitingForResponse(false);
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
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    };

    const handleSignOut = () => {
        logout();
        navigate('/signin');
    };

    // --- Tachyons Classes ---
    const userBubbleClasses = "bg-near-black og pa3 br3 mw6 mw7-ns shadow-3 fw5 lh-copy";
    const assistantBubbleClasses = "bg-near-black near-white pa3 br3 mw6 mw7-ns shadow-3 lh-copy break-word";
    const buttonClasses = "bg-og hover-bg-orange white fw6 pa2 ph3 br3 bn pointer dim flex items-center justify-center";
    const signOutButtonClasses = "bg-og hover-bg-orange white fw6 pv1 ph3 br-pill bn pointer dim f6";
    const inputClasses = "flex-grow-1 pa3 ba b--white-20 bg-near-black near-white br3 mr2 resize-none";
    const chatContainerClasses = "mw8 center";

    return (
        // Main container
        <div className="w-100 h-100 flex flex-column sans-serif white bg-blur">
            {/* Inject placeholder pulse CSS */}
            <style>{placeholderStyle}</style>

            {/* Header Bar */}
            <div className="flex-shrink-0 white flex items-center justify-between ph3 pv3 shadow-3"
                style={{ background: 'linear-gradient(to right, #2c3e50, #34495e)' }}>
                <h1 className="f4 fw6 mv0">AI Math Tutor</h1>
                <button className={signOutButtonClasses} onClick={handleSignOut}>Sign Out</button>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-auto w-100 overflow-y-auto pa3 custom-scroll">
                {/* Centered content area */}
                <div className={chatContainerClasses}>
                    {historyLoading && <p className="tc light-gray">Loading history...</p>}
                    {error && <p className="tc light-red fw5 pa2 bg-dark-red br2 mv2">{error}</p>}

                    {/* Map through the chat history */}
                    {history.map((chat, index) => {
                        // Render all messages, handle placeholder/animation conditionally
                        const messageNodes = renderMessageContent(chat.answer);
                        const isLatestAnimating = latestAssistantMessageId === chat.id && isAnimating;
                        const isCurrentlyWaiting = chat.isOptimistic && isWaitingForResponse;

                        return (
                            // Container for a single Q&A pair
                            <div key={chat.id || `chat-${index}`} className="mv3">
                                {/* Always render the question bubble if the question exists */}
                                {chat.question && (
                                    <div className="flex justify-end">
                                        <div className={userBubbleClasses}>
                                            {chat.question}
                                        </div>
                                    </div>
                                )}

                                {/* Render Assistant bubble only if it's waiting OR has an answer */}
                                {(isCurrentlyWaiting || chat.answer) && (
                                    <div className="flex justify-start mt2">
                                        <div className={assistantBubbleClasses}>
                                            {/* Show placeholder if waiting for this specific message */}
                                            {isCurrentlyWaiting ? (
                                                <span className="pulsing-placeholder">Reasoning...</span>
                                            ) : (
                                                // Otherwise, show answer (animated or static)
                                                isLatestAnimating ? (
                                                    <TypingEffect nodes={messageNodes} onUpdate={scrollToBottom} onComplete={handleAnimationComplete} />
                                                ) : (
                                                    messageNodes // Render static answer
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Placeholder is now handled within the map logic */}
                    {/* Ref for scrolling */}
                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Message Input Area */}
            <div className="flex-shrink-0 pa3 bg-near-black bt b--white-10">
                {/* Centered input area */}
                <div className={chatContainerClasses + " flex items-center"}>
                    <textarea
                        ref={textareaRef}
                        className={inputClasses + " lh-copy"}
                        value={message}
                        onChange={(e) => { setMessage(e.target.value); adjustTextareaHeight(); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a math question..."
                        rows={1}
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                        disabled={isWaitingForResponse || isAnimating}
                    />
                    <button
                        className={buttonClasses}
                        onClick={sendMessage}
                        disabled={isWaitingForResponse || isAnimating || !message.trim() || historyLoading}
                    >
                        {isWaitingForResponse ? "Waiting..." : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w1 h1">
                                <path d="M3.105 3.105a1.5 1.5 0 011.995-.001l11.788 9.569a1.5 1.5 0 010 2.654l-11.788 9.57a1.5 1.5 0 01-1.995-.001 1.498 1.498 0 01-.31-2.108l3.493-6.515a.75.75 0 000-.695L2.795 5.213a1.498 1.498 0 01.31-2.108z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
