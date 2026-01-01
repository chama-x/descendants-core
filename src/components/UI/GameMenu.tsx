'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

type MenuTab = 'gameplay' | 'graphics' | 'controls' | 'ai_console' | 'map';

export default function GameMenu() {
    const {
        // Core
        setMenuOpen,
        volume, setVolume,

        // Gameplay
        gameplaySettings, setGameplaySetting,
        invertedMouse, setInvertedMouse,
        sensitivity, setSensitivity,

        // Graphics
        graphicsSettings, setGraphicsSetting,

        // Controls
        keyBindings, setKeyBinding,

        // AI
        aiSettings, setAISetting
    } = useGameStore();

    const [activeTab, setActiveTab] = useState<MenuTab>('ai_console');
    const [listeningFor, setListeningFor] = useState<string | null>(null);

    const handleClose = () => {
        setMenuOpen(false);
    };

    useEffect(() => {
        if (!listeningFor) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.code === 'Escape' && listeningFor !== 'menu') {
                setListeningFor(null);
                return;
            }

            setKeyBinding(listeningFor, e.code);
            setListeningFor(null);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [listeningFor, setKeyBinding]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 10, 15, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            color: '#eee',
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                width: '900px',
                height: '600px',
                backgroundColor: 'rgba(30, 30, 35, 0.6)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                {/* Sidebar */}
                <div style={{
                    width: '240px',
                    backgroundColor: 'rgba(20, 20, 25, 0.8)',
                    padding: '30px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ padding: '0 30px', marginBottom: '40px' }}>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>PAUSE</h1>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>VERSION 0.1.0</div>
                    </div>

                    <nav style={{ flex: 1 }}>
                        <MenuButton active={activeTab === 'ai_console'} onClick={() => setActiveTab('ai_console')} label="AI Console" isPremium />
                        <MenuButton active={activeTab === 'gameplay'} onClick={() => setActiveTab('gameplay')} label="Gameplay" />
                        <MenuButton active={activeTab === 'graphics'} onClick={() => setActiveTab('graphics')} label="Graphics" />
                        <MenuButton active={activeTab === 'controls'} onClick={() => setActiveTab('controls')} label="Controls" />
                        <MenuButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} label="Map" />
                    </nav>

                    <div style={{ padding: '30px' }}>
                        <button
                            onClick={handleClose}
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#fff',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'transform 0.1s'
                            }}
                        >
                            RESUME
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                    {activeTab === 'ai_console' && (
                        <div>
                            <Header title="AI & Neural Link" description="Configure Yuka AI agents and Large Language Model connectivity." />

                            <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <Toggle
                                    label="Enable Yuka AI System"
                                    checked={aiSettings.enabled}
                                    onChange={(v) => setAISetting({ enabled: v })}
                                    description="Master switch for all autonomous agent behaviors."
                                />
                                <div style={{ height: '16px' }} />
                                <Toggle
                                    label="Connect to Cloud Brain (LLM)"
                                    checked={aiSettings.llmEnabled}
                                    onChange={(v) => setAISetting({ llmEnabled: v })}
                                    description="Allow agents to use external LLMs for complex decision making."
                                    disabled={!aiSettings.enabled}
                                />
                            </div>

                            {aiSettings.enabled && (
                                <>
                                    <h3 style={{ fontSize: '14px', color: '#888', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>Allowed Capabilities</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {['FOLLOW_ENTITY', 'NAVIGATE_TO_ANCHOR', 'NAVIGATE_TO_COORD', 'SOCIAL_INTERACT', 'HOLD_POSITION'].map(cmd => (
                                            <Checkbox
                                                key={cmd}
                                                label={cmd.replace(/_/g, ' ')}
                                                checked={aiSettings.allowedCommands.includes(cmd)}
                                                onChange={(checked) => {
                                                    const newCmds = checked
                                                        ? [...aiSettings.allowedCommands, cmd]
                                                        : aiSettings.allowedCommands.filter(c => c !== cmd);
                                                    setAISetting({ allowedCommands: newCmds });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'gameplay' && (
                        <div>
                            <Header title="Gameplay" description="Adjust game mechanics and accessibility." />
                            <Toggle label="Inverted Mouse" checked={invertedMouse} onChange={setInvertedMouse} />
                            <div style={{ height: '20px' }} />
                            <Toggle label="Head Bob" checked={gameplaySettings.headBob} onChange={(v) => setGameplaySetting({ headBob: v })} />
                            <div style={{ height: '20px' }} />
                            <Toggle label="Toggle Sprint" checked={gameplaySettings.sprintToggle} onChange={(v) => setGameplaySetting({ sprintToggle: v })} />

                            <div style={{ marginTop: '40px' }}>
                                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#aaa' }}>Mouse Sensitivity: {sensitivity.toFixed(1)}</label>
                                <input
                                    type="range" min="0.1" max="5.0" step="0.1"
                                    value={sensitivity}
                                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: '#fff' }}
                                />
                            </div>

                            <div style={{ marginTop: '30px' }}>
                                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#aaa' }}>Master Volume: {Math.round(volume * 100)}%</label>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: '#fff' }}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'graphics' && (
                        <div>
                            <Header title="Graphics" description="Visual fidelity and performance settings." />

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#aaa' }}>Quality Preset</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {['low', 'medium', 'high'].map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => setGraphicsSetting({ quality: q as any })}
                                            style={{
                                                padding: '8px 20px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                backgroundColor: graphicsSettings.quality === q ? '#fff' : 'transparent',
                                                color: graphicsSettings.quality === q ? '#000' : '#888',
                                                cursor: 'pointer',
                                                textTransform: 'capitalize'
                                            }}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Toggle label="Dynamic Shadows" checked={graphicsSettings.shadows} onChange={(v) => setGraphicsSetting({ shadows: v })} />
                            <div style={{ height: '20px' }} />
                            <Toggle label="Weather Effects" checked={graphicsSettings.weather} onChange={(v) => setGraphicsSetting({ weather: v })} />
                        </div>
                    )}

                    {activeTab === 'controls' && (
                        <div>
                            <Header title="Controls" description="Remap your key bindings." />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                <ControlRow action="Move Forward" currentKey={keyBindings.forward} isListening={listeningFor === 'forward'} onListen={() => setListeningFor('forward')} />
                                <ControlRow action="Move Backward" currentKey={keyBindings.backward} isListening={listeningFor === 'backward'} onListen={() => setListeningFor('backward')} />
                                <ControlRow action="Move Left" currentKey={keyBindings.left} isListening={listeningFor === 'left'} onListen={() => setListeningFor('left')} />
                                <ControlRow action="Move Right" currentKey={keyBindings.right} isListening={listeningFor === 'right'} onListen={() => setListeningFor('right')} />
                                <ControlRow action="Jump" currentKey={keyBindings.jump} isListening={listeningFor === 'jump'} onListen={() => setListeningFor('jump')} />
                                <ControlRow action="Sprint" currentKey={keyBindings.sprint} isListening={listeningFor === 'sprint'} onListen={() => setListeningFor('sprint')} />
                                <ControlRow action="Interact" currentKey={keyBindings.interact} isListening={listeningFor === 'interact'} onListen={() => setListeningFor('interact')} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'map' && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🗺️</div>
                            <h3>Map Unavailable</h3>
                            <p>Global positioning system offline.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Components ---

function MenuButton({ active, onClick, label, isPremium }: { active: boolean, onClick: () => void, label: string, isPremium?: boolean }) {
    return (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 30px',
                background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: 'none',
                borderLeft: active ? '3px solid #fff' : '3px solid transparent',
                color: active ? '#fff' : '#888',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: active ? 600 : 400,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}
        >
            {label}
            {isPremium && <span style={{ fontSize: '10px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>NEW</span>}
        </button>
    );
}

function Header({ title, description }: { title: string, description: string }) {
    return (
        <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0' }}>{title}</h2>
            <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{description}</p>
        </div>
    );
}

function Toggle({ label, checked, onChange, description, disabled }: { label: string, checked: boolean, onChange: (v: boolean) => void, description?: string, disabled?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
            <div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>{label}</div>
                {description && <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{description}</div>}
            </div>
            <button
                onClick={() => !disabled && onChange(!checked)}
                style={{
                    width: '48px',
                    height: '24px',
                    backgroundColor: checked ? '#fff' : 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    position: 'relative',
                    border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                }}
            >
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: checked ? '26px' : '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: checked ? '#000' : '#888',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }} />
            </button>
        </div>
    );
}

function Checkbox({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#fff' }}
            />
            <span style={{ fontSize: '14px', color: checked ? '#fff' : '#888' }}>{label}</span>
        </label>
    );
}

function ControlRow({ action, currentKey, isListening, onListen }: { action: string, currentKey: string, isListening: boolean, onListen: () => void }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: isListening ? '1px solid #fff' : '1px solid transparent'
        }}>
            <span style={{ fontSize: '15px' }}>{action}</span>
            <button
                onClick={onListen}
                style={{
                    backgroundColor: isListening ? '#fff' : 'rgba(0,0,0,0.3)',
                    color: isListening ? '#000' : '#bbb',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    minWidth: '80px',
                    cursor: 'pointer'
                }}
            >
                {isListening ? '...' : currentKey.replace('Key', '')}
            </button>
        </div>
    );
}
