"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useInteractionStore } from '@/store/interactionStore';
import AIManager from '../Systems/AIManager';

const COMMANDS = [
    { label: "Follow Me", cmd: { type: "FOLLOW_ENTITY", params: { target: "player-01" } } },
    { label: "Wait Here", cmd: { type: "HOLD_POSITION" } },
    { label: "Patrol Area", cmd: { type: "NAVIGATE_TO_ANCHOR", params: { target: "PatrolPointA" } } },
    { label: "Go to Office", cmd: { type: "NAVIGATE_TO_ANCHOR", params: { target: "Office" } } },
    { label: "Ask Question...", isInput: true }
];

export const AgentInteractionUI = () => {
    const { isOpen, targetAgentId, closeInteraction } = useInteractionStore();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isInputMode, setIsInputMode] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [isSending, setIsSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setSelectedIndex(0);
            setIsInputMode(false);
            setPrompt("");
        }
    }, [isOpen]);

    // Focus input when input mode activates
    useEffect(() => {
        if (isInputMode && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isInputMode]);

    const handleCommand = async (command: any) => {
        setIsSending(true);
        console.log(`Sending command to ${targetAgentId}:`, command);

        if (typeof command === 'string') {
            // Text Input - Treat as Thought Injection or Custom Prompt
            AIManager.getInstance().sendCommand(targetAgentId!, {
                type: "INTERNAL_THOUGHT",
                params: { thought: `User says: "${command}"` }
            });
        } else {
            // Capability Command
            AIManager.getInstance().sendCommand(targetAgentId!, command);
        }

        // Simulation delay for "Transmission" effect
        await new Promise(r => setTimeout(r, 400));

        setIsSending(false);
        closeInteraction();
    };

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isInputMode) {
                // Input Mode: Esc to cancel, Enter handled by input
                if (e.key === 'Escape') {
                    setIsInputMode(false);
                    e.stopPropagation();
                }
                return;
            }

            // Menu Mode
            switch (e.key) {
                case 'w':
                case 'ArrowUp':
                    setSelectedIndex(prev => (prev - 1 + COMMANDS.length) % COMMANDS.length);
                    break;
                case 's':
                case 'ArrowDown':
                    setSelectedIndex(prev => (prev + 1) % COMMANDS.length);
                    break;
                case 'Enter':
                case 'e': // Confirm with E (common gaming trope) or Space
                case 'Space':
                    e.preventDefault();
                    const selected = COMMANDS[selectedIndex];
                    if (selected.isInput) {
                        setIsInputMode(true);
                    } else {
                        handleCommand(selected.cmd);
                    }
                    break;
                case 'Escape':
                    closeInteraction();
                    break;
                // Quick Keys 1-5
                case '1': if (COMMANDS[0] && !COMMANDS[0].isInput) handleCommand(COMMANDS[0].cmd); break;
                case '2': if (COMMANDS[1] && !COMMANDS[1].isInput) handleCommand(COMMANDS[1].cmd); break;
                case '3': if (COMMANDS[2] && !COMMANDS[2].isInput) handleCommand(COMMANDS[2].cmd); break;
                case '4': if (COMMANDS[3] && !COMMANDS[3].isInput) handleCommand(COMMANDS[3].cmd); break;
                case '5': setIsInputMode(true); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isInputMode, selectedIndex, targetAgentId]);

    if (!isOpen || !targetAgentId) return null;

    return (
        <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none', // Allow seeing through, clicks handled by elements if pointer-events auto
        }}>
            {/* Command Wheel / List Container */}
            <div style={{
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: '320px'
            }}>
                {/* Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '10px',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }}>
                    <div style={{ fontSize: '12px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>Command Neural Link</div>
                    <div style={{ fontSize: '24px', color: 'white', fontWeight: 'bold' }}>{targetAgentId}</div>
                </div>

                {isInputMode ? (
                    // Type Mode
                    <div style={{
                        background: 'rgba(0,0,0,0.8)',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '1px solid #00d4ff',
                        boxShadow: '0 0 20px rgba(0, 212, 255, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        <div style={{ fontSize: '14px', color: '#00d4ff' }}>TRANSMIT THOUGHT</div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="Type instructions..."
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '2px solid #555',
                                color: 'white',
                                fontSize: '18px',
                                padding: '8px',
                                outline: 'none'
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && prompt.trim()) {
                                    handleCommand(prompt);
                                }
                            }}
                        />
                        <div style={{ fontSize: '10px', color: '#666' }}>[ENTER] SEND  [ESC] CANCEL</div>
                    </div>
                ) : (
                    // Menu Mode
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        {COMMANDS.map((item, idx) => {
                            const isSelected = selectedIndex === idx;
                            return (
                                <div key={idx} style={{
                                    padding: '12px 20px',
                                    borderRadius: '8px',
                                    background: isSelected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.6)',
                                    color: isSelected ? 'black' : 'white',
                                    fontWeight: isSelected ? 'bold' : 'normal',
                                    borderLeft: isSelected ? '6px solid #00d4ff' : '6px solid transparent',
                                    transform: isSelected ? 'translateX(10px)' : 'translateX(0)',
                                    transition: 'all 0.1s ease',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
                                }}>
                                    <span>{item.label}</span>
                                    {isSelected && <span style={{ fontSize: '10px', opacity: 0.6 }}>[E]</span>}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer Instructions */}
                {!isInputMode && (
                    <div style={{
                        marginTop: '20px',
                        textAlign: 'center',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.5)',
                        textShadow: '0 1px 2px black'
                    }}>
                        [W/S] NAVIGATE  [E] SELECT  [ESC] CLOSE
                    </div>
                )}
            </div>
        </div>
    );
};
