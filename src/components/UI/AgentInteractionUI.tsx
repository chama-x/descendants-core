"use client";
import React, { useState, useEffect } from 'react';
import { useInteractionStore } from '@/store/interactionStore';
import { generateAgentThought } from '@/app/actions'; // Reuse acting as brain override? 
// Actually we need to send commands to the ClientBrain of that specific agent.
// How do we access a specific agent's brain from UI? 
// ClientBrains are inside useYukaAI hooks... this is tricky.
// We need a Global Brain Registry or Messaging Bus.
// For now, we will simulate it by hacking: Input -> Server Action -> (Hypothetical) -> Brain.
// BUT, ClientBrain is local. 
// Solution: AIManager should map ID -> Brain.
// I will need to register brains in AIManager.

// For now, let's just build the UI.

export const AgentInteractionUI = () => {
    const { isOpen, targetAgentId, closeInteraction } = useInteractionStore();
    const [prompt, setPrompt] = useState("");
    const [isSending, setIsSending] = useState(false);

    if (!isOpen || !targetAgentId) return null;

    const handleCommand = async (command: string) => {
        setIsSending(true);
        console.log(`Sending command to ${targetAgentId}: ${command}`);

        // TODO: Dispatch to actual agent
        // window.dispatchEvent(new CustomEvent('AGENT_COMMAND', { detail: { id: targetAgentId, command } }));
        // Temporary: Just log it.

        // Simulate delay
        await new Promise(r => setTimeout(r, 500));
        setIsSending(false);
        setPrompt("");
        // closeInteraction(); // Keep open for multi-turn?
    };

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #333',
            color: 'white',
            width: '400px',
            zIndex: 1000,
            fontFamily: 'sans-serif'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Interact: {targetAgentId}</h2>
                <button onClick={closeInteraction} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Quick Commands */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <QuickBtn onClick={() => handleCommand("Follow me")} label="Follow Me" />
                <QuickBtn onClick={() => handleCommand("Stay here")} label="Wait Here" />
                <QuickBtn onClick={() => handleCommand("Patrol area")} label="Patrol" />
                <QuickBtn onClick={() => handleCommand("Go to Office")} label="Go to Office" />
            </div>

            {/* Prompt Input */}
            <div style={{ display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter custom command..."
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #444',
                        background: '#222',
                        color: 'white'
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommand(prompt)}
                />
                <button
                    onClick={() => handleCommand(prompt)}
                    disabled={isSending || !prompt}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        background: isSending ? '#555' : '#0070f3',
                        border: 'none',
                        color: 'white',
                        cursor: isSending ? 'default' : 'pointer'
                    }}
                >
                    {isSending ? '...' : 'Send'}
                </button>
            </div>
        </div>
    );
};

const QuickBtn = ({ onClick, label }: { onClick: () => void, label: string }) => (
    <button
        onClick={onClick}
        style={{
            padding: '10px',
            background: '#222',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#ddd',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = '#333'}
        onMouseOut={(e) => e.currentTarget.style.background = '#222'}
    >
        {label}
    </button>
);
