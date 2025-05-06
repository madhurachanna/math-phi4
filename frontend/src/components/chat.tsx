import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from 'react-router-dom';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import {
    fetchSessions, createNewSession, fetchHistoryForSession, setActiveSession,
    sendMessageToSession, deleteSessionById, clearSessionState, setSessionError
} from "../services/store/sessionSlice";
import { RootState, AppDispatch } from "../services/store";
import { logout } from "../services/api";
import type { SessionListItem, MessageResponse } from "../services/api";

interface ChatMessage extends MessageResponse {
    isOptimistic?: boolean;
    tempId?: number;
}

const placeholderStyle = `
@keyframes pulseOpacity { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
.pulsing-placeholder { animation: pulseOpacity 1.8s infinite ease-in-out; color: #bdbdbd; font-style: italic; }
`;

type SpanElementWithChildren = React.ReactElement<{ className?: string; children?: React.ReactNode | string }>;

const renderMessageContent = (content: string): React.ReactNode[] => {
    const regex = /(\\\[[\s\S]*?\\\]|\\\(.*?\\\)|```([\s\S]*?)```|`.*?`)/g;
    const parts = content.split(regex);

    let keyCounter = 0;
    const renderedNodes: React.ReactNode[] = [];

    parts
        .filter(part => part != null && part.length > 0)
        .forEach(part => {
            keyCounter++;

            try {
                if (part.startsWith('\\[') && part.endsWith('\\]')) {
                    const mathContent = part.slice(2, -2);
                    if (mathContent.trim()) {
                        renderedNodes.push(<div className="db mv1" key={`block-math-${keyCounter}`}><BlockMath>{mathContent}</BlockMath></div>);
                    }
                } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
                    const mathContent = part.slice(2, -2);
                    if (mathContent.trim()) {
                        renderedNodes.push(<InlineMath key={`inline-math-${keyCounter}`}>{mathContent}</InlineMath>);
                    }
                } else if (part.startsWith('```') && part.endsWith('```')) {
                    const codeContent = part.slice(3, -3).trim();
                    renderedNodes.push(<pre key={`codeblock-${keyCounter}`} className="bg-black-10 pa2 br2 f6 code mv1 overflow-x-auto"><code>{codeContent || ''}</code></pre>);
                } else if (part.startsWith('`') && part.endsWith('`')) {
                    const inlineCode = part.slice(1, -1);
                    renderedNodes.push(<code key={`inline-code-${keyCounter}`} className="bg-black-10 ph1 br1 f6 code">{inlineCode}</code>);
                } else if (!part.match(/^(\\\[|\\\(|```|`)/)) {
                    const lines = part.split('\n');
                    lines.forEach((line, lineIndex) => {
                        const headingMatch = line.match(/^(\s*)###\s*(.*)$/);
                        if (headingMatch) {
                            const headingText = headingMatch[2];
                            if (headingMatch[1]) {
                                renderedNodes.push(<span key={`text-${keyCounter}-line-${lineIndex}-leading-${renderedNodes.length}`}>{headingMatch[1]}</span>);
                            }
                            renderedNodes.push(<h3 key={`heading-${keyCounter}-line-${lineIndex}`} className="f5 fw6 mv2 near-white">{headingText}</h3>);
                        } else {
                            const boldRegex = /(\*(.*?)\*)/g;
                            let lastIndex = 0;
                            let boldMatch;
                            const lineNodes: React.ReactNode[] = [];

                            while ((boldMatch = boldRegex.exec(line)) !== null) {
                                if (boldMatch.index > lastIndex) {
                                    lineNodes.push(<span key={`text-${keyCounter}-line-${lineIndex}-${lineNodes.length}`}>{line.substring(lastIndex, boldMatch.index)}</span>);
                                }
                                lineNodes.push(<strong key={`bold-${keyCounter}-line-${lineIndex}-${lineNodes.length}`} className="fw6">{boldMatch[2]}</strong>);
                                lastIndex = boldRegex.lastIndex;
                            }

                            if (lastIndex < line.length) {
                                lineNodes.push(<span key={`text-${keyCounter}-line-${lineIndex}-${lineNodes.length}`}>{line.substring(lastIndex)}</span>);
                            }

                            if (lineNodes.length > 0) {
                                const firstNode = lineNodes[0];
                                if (React.isValidElement(firstNode) && firstNode.type === 'span') {
                                    const typedFirstNode = firstNode as SpanElementWithChildren;
                                    const updatedFirstNode = React.cloneElement(typedFirstNode, {
                                        className: `${typedFirstNode.props.className || ''} lh-copy ${line.trim().startsWith('Final Answer:') ? 'fw6 og' : 'near-white'}`.trim()
                                    });
                                    renderedNodes.push(updatedFirstNode, ...lineNodes.slice(1));
                                } else {
                                    renderedNodes.push(...lineNodes);
                                }
                            } else if (line.length > 0) {
                                renderedNodes.push(<span key={`text-${keyCounter}-line-${lineIndex}`} className={`lh-copy ${line.trim().startsWith('Final Answer:') ? 'fw6 og' : 'near-white'}`}>{line}</span>);
                            }
                        }

                        if (lineIndex < lines.length - 1 && !headingMatch) {
                            renderedNodes.push(<br key={`br-${keyCounter}-line-${lineIndex}`} />);
                        }
                    });
                }
            } catch (error) {
                console.error("Error rendering content part:", part, error);
                renderedNodes.push(<span className="near-white i light-red lh-copy" key={`render-error-${keyCounter}`}>{`[Render Error]`}</span>);
            }
        });

    return renderedNodes;
};

interface TypingEffectProps {
    content: string;
    onUpdate: () => void;
    onComplete: () => void;
}

const TypingEffect: React.FC<TypingEffectProps> = React.memo(({ content, onUpdate, onComplete }) => {
    const [animatedContent, setAnimatedContent] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMounted = useRef(true);

    const contentTokens = useMemo(() => {
        const regex = /(\\\[[\s\S]*?\\\]|\\\(.*?\\\)|```([\s\S]*?)```|`.*?`|^###\s*[^\n]*)/gm;
        return content.split(regex).filter(part => part != null && part.length > 0);
    }, [content]);

    const currentTokenIndex = useRef(0);
    const currentCharIndex = useRef(0);

    const type = useCallback(() => {
        if (!isMounted.current) return;

        const currentToken = contentTokens[currentTokenIndex.current];

        if (!currentToken) {
            onComplete();
            return;
        }

        const isBlockOrInlineOrHeading = currentToken.match(/^(\\\[[\s\S]*?\\\]|\\\(.*?\\\)|```[\s\S]*?```|`.*?`|###\s*[^\n]*)$/m);

        if (isBlockOrInlineOrHeading) {
            setAnimatedContent(prev => prev + currentToken);
            currentTokenIndex.current += 1;
            currentCharIndex.current = 0;
            onUpdate();
            timeoutRef.current = setTimeout(type, 10);
        } else {
            if (currentCharIndex.current < currentToken.length) {
                const nextChar = currentToken[currentCharIndex.current];
                setAnimatedContent(prev => prev + nextChar);
                currentCharIndex.current += 1;
                onUpdate();

                const delay = 20;
                timeoutRef.current = setTimeout(type, delay);
            } else {
                currentTokenIndex.current += 1;
                currentCharIndex.current = 0;
                timeoutRef.current = setTimeout(type, 10);
            }
        }
    }, [contentTokens, onUpdate, onComplete]);

    useEffect(() => {
        isMounted.current = true;
        setAnimatedContent("");
        currentTokenIndex.current = 0;
        currentCharIndex.current = 0;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (contentTokens && contentTokens.length > 0) {
            type();
        } else {
            onComplete();
        }

        return () => {
            isMounted.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [contentTokens, type]);

    return <>{renderMessageContent(animatedContent)}</>;
});

const SessionSidebar = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { sessions, activeSessionId, sessionLoading } = useSelector((state: RootState) => state.session);

    useEffect(() => { dispatch(fetchSessions()); }, [dispatch]);

    const handleCreateNew = () => { dispatch(createNewSession()); };
    const handleSelectSession = (id: number) => { if (id !== activeSessionId) dispatch(setActiveSession(id)); };
    const handleDeleteSession = (id: number, event: React.MouseEvent) => {
        event.stopPropagation();
        if (window.confirm("Delete this chat session?")) dispatch(deleteSessionById(id));
    };

    const sessionItemBase = "db w-100 pa3 mb2 br2 pointer dim f6";
    const sessionItemIdle = "bg-white-10 hover-bg-white-20 near-white";
    const sessionItemActive = "bg-og white fw6";

    return (
        <div className="w-25 h-100 flex flex-column bg-near-black pa3 br b--white-10 overflow-hidden">
            <div className="flex-shrink-0 mb3 flex justify-between items-center">
                <h2 className="f5 fw6 white mv0">Chats</h2>
                <button onClick={handleCreateNew} className="bg-transparent hover-bg-white-10 white bn pa1 br-100 pointer dim" title="New Chat">
                    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 20 20" fill="currentColor" className="w1 h1"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                </button>
            </div>
            <div className="flex-auto overflow-y-auto custom-scroll pr2">
                {sessionLoading && <p className="tc light-gray f6">Loading...</p>}
                {!sessionLoading && sessions.map((session) => (
                    <div key={session.id} onClick={() => handleSelectSession(session.id)}
                        className={`${sessionItemBase} ${activeSessionId === session.id ? sessionItemActive : sessionItemIdle} flex justify-between items-center`}>
                        <span className="truncate pr2">{session.title || `Chat ${session.id}`}</span>
                        <button onClick={(e) => handleDeleteSession(session.id, e)} className="bg-transparent bn pa1 br-100 pointer f7 dim session-item-delete-btn" title="Delete Chat">
                            <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 16 16" fill="currentColor" className="w1 h1 white hover-light-red"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.5-.75v.75h1V2.5h-1ZM4.5 5.5l.75 7.5h5.5l.75-7.5h-7ZM7 7.25a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Zm2.5.75a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                ))}
                {!sessionLoading && sessions.length === 0 && (<p className="tc light-gray f6 i mt3">No chats yet.</p>)}
            </div>
        </div>
    );
};

const ChatWindow: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { activeSessionId, messages, messageLoading, sendMessageLoading, error } = useSelector((state: RootState) => state.session);
    const sessions = useSelector((state: RootState) => state.session.sessions);

    const [messageInput, setMessageInput] = useState("");
    const [animatingMessageId, setAnimatingMessageId] = useState<number | null>(null);
    const lastAnimatedIdRef = useRef<number | null>(null);
    const displayedHistoryMessageIds = useRef<Set<number>>(new Set());

    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const activeSessionTitle = activeSessionId ? sessions.find(s => s.id === activeSessionId)?.title : null;
    const headerTitle = activeSessionId ? (activeSessionTitle || `Chat ${activeSessionId}`) : "AI Math Tutor";

    useEffect(() => {
        if (activeSessionId !== null) {
            if (error) dispatch(setSessionError(null));
            dispatch(fetchHistoryForSession(activeSessionId));
            setAnimatingMessageId(null);
            lastAnimatedIdRef.current = null;
            displayedHistoryMessageIds.current.clear();
        } else {
            displayedHistoryMessageIds.current.clear();
        }
    }, [activeSessionId, dispatch, error]);

    useEffect(() => {
        if (activeSessionId !== null && !messageLoading && messages.length > 0 && displayedHistoryMessageIds.current.size === 0) {
            messages.forEach(msg => {
                if (msg.id !== undefined) {
                    displayedHistoryMessageIds.current.add(msg.id);
                }
            });
        }
    }, [messages, messageLoading, activeSessionId]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        if (chatEndRef.current) {
            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: behavior, block: "end" });
            }, 50);
        }
    }, []);

    useEffect(() => {
        scrollToBottom(messageLoading ? "auto" : "smooth");
    }, [messages, messageLoading, scrollToBottom]);

    const handleAnimationComplete = useCallback((completedMessageId: number) => {
        if (animatingMessageId === completedMessageId) {
            setAnimatingMessageId(null);
        }
        lastAnimatedIdRef.current = completedMessageId;
    }, [animatingMessageId]);

    const latestAnimatableMessageId = useMemo(() => {
        const latestAssistantMessage = [...messages].reverse().find(msg => !msg.isOptimistic && msg.answer);
        return latestAssistantMessage?.id ?? null;
    }, [messages]);

    useEffect(() => {
        if (latestAnimatableMessageId !== null &&
            animatingMessageId === null &&
            !displayedHistoryMessageIds.current.has(latestAnimatableMessageId) &&
            latestAnimatableMessageId !== lastAnimatedIdRef.current) {
            setAnimatingMessageId(latestAnimatableMessageId);
        }
    }, [latestAnimatableMessageId, animatingMessageId]);

    const handleSendMessage = () => {
        const trimmedMessage = messageInput.trim();
        if (!activeSessionId || !trimmedMessage || sendMessageLoading || animatingMessageId) return;

        setMessageInput("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "44px";
        }
        dispatch(sendMessageToSession({ sessionId: activeSessionId, question: trimmedMessage }));
        scrollToBottom('smooth');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const adjustTextareaHeight = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const scrollHeight = textareaRef.current.scrollHeight;
            const newHeight = Math.max(44, Math.min(scrollHeight, 120));
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [messageInput, adjustTextareaHeight]);

    const handleSignOut = () => {
        logout();
        dispatch(clearSessionState());
        navigate('/signin');
    };

    const commonClasses = {
        userBubble: "bg-near-black og pa3 br3 mw6 mw7-ns shadow-3 fw5 lh-copy self-end",
        assistantBubble: "bg-near-black near-white pa3 br3 mw6 mw7-ns shadow-3 lh-copy break-word self-start",
        sendButton: "bg-og hover-bg-orange white fw6 pa2 ph3 br3 bn pointer dim flex items-center justify-center",
        signOutButton: "bg-og hover-bg-orange white fw6 pv1 ph3 br-pill bn pointer dim f6",
        textArea: "flex-grow-1 pa3 ba b--white-20 bg-near-black near-white br3 mr2 resize-none lh-copy",
        chatContainer: "mw8 w-100 center flex flex-column ph2",
    };

    return (
        <div className="w-100 h-100 flex sans-serif white bg-blur overflow-hidden">
            <style>{placeholderStyle}</style>

            <SessionSidebar />

            <div className="w-75 h-100 flex flex-column">
                <div className="flex-shrink-0 white flex items-center justify-between ph3 pv3 shadow-3" style={{ background: 'linear-gradient(to right, #2c3e50, #34495e)' }}>
                    <h1 className="f4 fw6 mv0 white truncate">{headerTitle}</h1>
                    <button className={commonClasses.signOutButton} onClick={handleSignOut}>Sign Out</button>
                </div>

                <div key={activeSessionId || 'no-session'} className="flex-auto w-100 overflow-y-auto pa3 custom-scroll">
                    <div className={commonClasses.chatContainer} style={{ minHeight: '100%' }}>
                        {messageLoading && activeSessionId && <p className="tc light-gray f6 mv4">Loading chat...</p>}
                        {!activeSessionId && <p className="tc gray f5 i mv4">Select or start a chat.</p>}
                        {activeSessionId && !messageLoading && messages.length === 0 && !error && (<p className="tc gray f5 i mv4">Ask a math question!</p>)}
                        {error && (<div className="mh-auto mv2" style={{ maxWidth: '80%' }}><p className="tc light-red fw5 pa2 bg-dark-red br2 ma0">{error}</p></div>)}

                        {activeSessionId && messages.map((chat) => {
                            const shouldAnimate = animatingMessageId === chat.id;
                            const isCurrentlyWaiting = chat.isOptimistic && sendMessageLoading;
                            const isHistoryMessage = chat.id !== undefined && displayedHistoryMessageIds.current.has(chat.id);

                            return (
                                <div key={chat.tempId || chat.id} className="mv3 flex flex-column">
                                    <div className={commonClasses.userBubble}>{chat.question}</div>

                                    {(isCurrentlyWaiting || (!chat.isOptimistic && chat.answer)) && (
                                        <div className={`${commonClasses.assistantBubble} mt2`}>
                                            {isCurrentlyWaiting ? (
                                                <span className="pulsing-placeholder">Reasoning...</span>
                                            )
                                                : shouldAnimate && !isHistoryMessage ? (
                                                    <TypingEffect
                                                        key={`typing-${chat.id}`}
                                                        content={chat.answer}
                                                        onUpdate={scrollToBottom}
                                                        onComplete={() => handleAnimationComplete(chat.id)}
                                                    />
                                                )
                                                    : (chat.answer ? renderMessageContent(chat.answer) : null)
                                            }
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={chatEndRef} style={{ height: '1px' }} />
                    </div>
                </div>

                <div className="flex-shrink-0 pa3 bg-near-black bt b--white-10">
                    <div className={"mw8 center flex items-center"}>
                        <textarea ref={textareaRef}
                            className={commonClasses.textArea} value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onInput={adjustTextareaHeight}
                            onKeyDown={handleKeyDown}
                            placeholder={activeSessionId ? "Ask a math question..." : "Select a chat"}
                            disabled={!activeSessionId || sendMessageLoading || !!animatingMessageId}
                            rows={1} style={{ minHeight: '44px', maxHeight: '120px' }} />

                        <button className={commonClasses.sendButton} onClick={handleSendMessage}
                            disabled={!activeSessionId || sendMessageLoading || !!animatingMessageId || !messageInput.trim()}>
                            {sendMessageLoading ? "..." : (
                                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 20 20" fill="currentColor" className="w1 h1">
                                    <path d="M3.105 3.105a1.5 1.5 0 011.995-.001l11.788 9.569a1.5 1.5 0 010 2.654l-11.788 9.57a1.5 1.5 0 01-1.995-.001 1.498 1.498 0 01-.31-2.108l3.493-6.515a.75.75 0 000-.695L2.795 5.213a1.498 1.498 0 01.31-2.108z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
