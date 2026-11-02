const CONTROLS_PANEL_STYLE = `
    .controls-toggle {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 11;
        padding: 9px 13px;
        border: 1px solid rgba(255, 110, 140, 0.55);
        border-radius: 8px;
        background: rgba(15, 5, 12, 0.82);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.32);
        color: #fff1f4;
        font: 600 13px/1.2 'DFPPOPCorn-W12', sans-serif;
        cursor: pointer;
        backdrop-filter: blur(8px);
    }

    .controls-toggle:hover {
        background: rgba(75, 15, 35, 0.92);
    }

    .controls-toggle:focus-visible {
        outline: 2px solid #ff9caf;
        outline-offset: 3px;
    }

    .controls-panel {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 10;
        width: min(230px, calc(100vw - 32px));
        padding: 14px 16px;
        border: 1px solid rgba(255, 110, 140, 0.45);
        border-radius: 10px;
        background: rgba(15, 5, 12, 0.76);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.32);
        color: #fff1f4;
        font: 13px/1.45 'DFPPOPCorn-W12', sans-serif;
        pointer-events: none;
        backdrop-filter: blur(8px);
    }

    .controls-panel h2 {
        margin: 0 0 9px;
        color: #ff9caf;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .controls-panel dl {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6px 12px;
        margin: 0;
    }

    .controls-panel dt {
        color: rgba(255, 241, 244, 0.82);
    }

    .controls-panel dd {
        margin: 0;
        text-align: right;
    }

    .controls-panel kbd {
        padding: 2px 6px;
        border: 1px solid rgba(255, 190, 202, 0.35);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font: inherit;
        white-space: nowrap;
    }

    @media (max-width: 480px) {
        .controls-toggle {
            top: 10px;
            right: 10px;
        }

        .controls-panel {
            top: 10px;
            left: 10px;
            width: min(205px, calc(100vw - 20px));
            padding: 10px 12px;
            font-size: 12px;
        }
    }
`;

export function createControlsPanel() {
    const style = document.createElement('style');
    style.textContent = CONTROLS_PANEL_STYLE;
    document.head.append(style);

    const toggle = document.createElement('button');
    toggle.className = 'controls-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Hide controls';
    toggle.setAttribute('aria-controls', 'game-controls');
    toggle.setAttribute('aria-expanded', 'true');

    const panel = document.createElement('aside');
    panel.className = 'controls-panel';
    panel.id = 'game-controls';
    panel.setAttribute('aria-label', 'Game controls');
    panel.innerHTML = `
        <h2>Controls</h2>
        <dl>
            <dt>Up</dt><dd><kbd>W</kbd></dd>
            <dt>Left</dt><dd><kbd>A</kbd></dd>
            <dt>Down</dt><dd><kbd>S</kbd></dd>
            <dt>Right</dt><dd><kbd>D</kbd></dd>
            <dt>Move faster</dt><dd><kbd>Shift</kbd></dd>
            <dt>Look around</dt><dd><kbd>Right mouse</kbd></dd>
            <dt>Zoom</dt><dd><kbd>Scroll</kbd></dd>
            <dt>Fire</dt><dd><kbd>Hold left click</kbd></dd>
            <dt>Bomb</dt><dd><kbd>X</kbd></dd>
        </dl>
    `;
    document.body.append(panel);
    document.body.append(toggle);

    const toggleSound = new Audio('assets/audio/ok00.wav');
    toggleSound.preload = 'auto';
    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        panel.hidden = isExpanded;
        toggle.setAttribute('aria-expanded', String(!isExpanded));
        toggle.textContent = isExpanded ? 'Controls' : 'Hide controls';
        toggle.setAttribute(
            'aria-label',
            isExpanded ? 'Show controls' : 'Hide controls'
        );

        toggleSound.currentTime = 0;
        toggleSound.play().catch((error) => {
            console.error('Could not play controls toggle sound:', error);
        });
    });

    return panel;
}
