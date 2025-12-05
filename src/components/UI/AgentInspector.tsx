'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ClientBrain } from '@/components/Systems/ClientBrain'; // Moved to top
// import { generateAgentThought } from '@/app/actions'; // Not used directly, brain handles it

interface Message {
    role: 'user' | 'agent';
    text: string;
}

export const AgentInspector = () => {
    const inspectedAgentId = useGameStore(state => state.inspectedAgentId);
    const isChatOpen = useGameStore(state => state.isChatOpen);

    // ...

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    // Real State
    const [brainState, setBrainState] = useState<{ thought: string, status: string, memo: string | null }>({
        thought: 'Connecting...',
        status: 'OFFLINE',
        memo: null
    });

    const scrollRef = useRef<HTMLDivElement>(null);

    // Poll for Brain State Updates
    useEffect(() => {
        if (!inspectedAgentId) return;

        const interval = setInterval(() => {
            const brain = ClientBrain.getBrain(inspectedAgentId);
            if (brain) {
                setBrainState({
                    thought: brain.state.thought,
                    status: brain.state.isThinking ? 'THINKING' : (brain.state.isPausedForChat ? 'CHATTING' : 'ACTIVE'),
                    memo: brain.state.memo
                });

                // Sync History on load (optional, or just append)
                if (messages.length === 0 && brain.state.chatHistory.length > 0) {
                    setMessages(brain.state.chatHistory);
                }
            }
        }, 500); // 2Hz update

        return () => clearInterval(interval);
    }, [inspectedAgentId, messages.length]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!isChatOpen || !inspectedAgentId) return null;

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        const brain = ClientBrain.getBrain(inspectedAgentId);
        if (brain) {
            try {
                // Call real brain chat
                // We need to implement the actual LLM call in brain.chat() properly now
                // For now, let's call the server action manually here if brain.chat isn't async connected
                // Actually brain.chat() should handle it.

                // Temporary Direct Call simulation via Brain
                // In reality, brain.chat() will update state.
                const response = await brain.chat(userMsg);

                setMessages(prev => [...prev, { role: 'agent', text: response }]);
            } catch {
                setMessages(prev => [...prev, { role: 'agent', text: "Error: Connection lost." }]);
            }
        }
        setIsTyping(false);
    };

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '800px',
            height: '500px',
            backgroundColor: 'rgba(10, 10, 15, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Left Panel: Context & State */}
            <div style={{
                width: '300px',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                <div>
                    <h2 style={{ color: '#fff', fontSize: '18px', margin: 0 }}>AGENT:{inspectedAgentId}</h2>
                    <div style={{ color: '#00ff41', fontSize: '12px', marginTop: '4px' }}>● {brainState.status}</div>
                </div>

                <div style={{ flex: 1 }}>
                    <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase' }}>Current Thought</h3>
                    <p style={{ color: '#fff', fontSize: '14px', marginTop: '8px', fontStyle: 'italic' }}>&quot;{brainState.thought}&quot;</p>

                    <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', marginTop: '16px' }}>Memo</h3>
                    <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>{brainState.memo || "No active memos."}</p>
                </div>

                <div>
                    <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase' }}>Stats</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}>
                            <div style={{ color: '#888', fontSize: '10px' }}>MODE</div>
                            <div style={{ color: '#fff', fontSize: '12px' }}>{isChatOpen ? 'MANUAL' : 'AUTO'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Chat & Thought Stream */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    flex: 1,
                    padding: '24px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }} ref={scrollRef}>
                    {messages.length === 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '100px' }}>
                            Initialize connection to start conversation...
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} style={{
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            background: m.role === 'user' ? '#0066ff' : 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            lineHeight: '1.4'
                        }}>
                            {m.text}
                        </div>
                    ))}
                    {isTyping && (
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginLeft: '16px' }}>
                            Agent is thinking...
                        </div>
                    )}
                </div>

                <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Type a message..."
                            style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '12px',
                                color: '#fff',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            style={{
                                background: '#fff',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0 24px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            SEND
                        </button>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                        Press ESC to close connection
                    </div>
                </div>
            </div>
        </div>
    );
};
