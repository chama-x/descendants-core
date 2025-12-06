'use client';

import React from 'react';
import { useGameStore } from '@/store/gameStore';

export const Crosshair = () => {
    const hoveredAgentId = useGameStore(state => state.hoveredAgentId);

    return (
        <div style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {/* Center Dot */}
            <div style={{
                width: hoveredAgentId ? '12px' : '6px',
                height: hoveredAgentId ? '12px' : '6px',
                borderRadius: '50%',
                backgroundColor: hoveredAgentId ? '#00ff41' : 'rgba(255, 255, 255, 0.6)',
                boxShadow: hoveredAgentId ? '0 0 10px #00ff41' : 'none',
                transition: 'all 0.2s ease-out'
            }} />

            {/* Hover Text */}
            {hoveredAgentId && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    color: '#00ff41',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    textShadow: '0 0 5px rgba(0, 255, 65, 0.5)',
                    whiteSpace: 'nowrap'
                }}>
                    [ INSPECT AGENT: {hoveredAgentId} ]
                </div>
            )}
        </div>
    );
};
