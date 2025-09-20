// platform.js 

const { ipcRenderer } = require('electron');

class GamesPlatform {
    constructor() {
        this.currentGame = null;
        this.gameInstance = null;
        this.microbitConnected = false;
        this.buttonStates = [false, false, false, false]; // Green1, White, Red, Green2
        
        console.log('GamesPlatform initializing...');
        this.initializeEventListeners();
        this.setupMicrobitListeners();
        this.checkMicrobitConnection();
    }

    setupMicrobitListeners() {
        console.log('Setting up Microbit event listeners...');
        
        // Listen for button press events from Microbits
        ipcRenderer.on('microbit-button-press', (event, data) => {
            console.log(`🎮 Microbit Button Press: ${data.color} Button ${data.button} (${data.position})`);
            
            // Update button state
            this.buttonStates[data.button - 1] = true;
            
            // Forward to current game as keyboard event
            if (this.gameInstance) {
                this.handleMicrobitButtonPress(data);
            }
            
            // Update UI indicator
            this.updateButtonIndicator(data.button, true);
        });

        // Listen for button release events
        ipcRenderer.on('microbit-button-release', (event, data) => {
            console.log(`🎮 Microbit Button Release: ${data.color} Button ${data.button} (${data.position})`);
            
            // Update button state
            this.buttonStates[data.button - 1] = false;
            
            // Forward to current game
            if (this.gameInstance) {
                this.handleMicrobitButtonRelease(data);
            }
            
            // Update UI indicator
            this.updateButtonIndicator(data.button, false);
        });

        // Listen for Microbit status updates
        ipcRenderer.on('microbit-status', (event, data) => {
            console.log('Microbit status update:', data);
            this.updateMicrobitStatus(data.status === 'connected');
        });
    }

    handleMicrobitButtonPress(data) {
        // Convert Microbit button press to game-appropriate input
        if (!this.gameInstance) return;

        // For Pong game - use 4-button layout
        if (this.currentGame === 'pong') {
            if (this.gameInstance.handleMicrobitButtonPress) {
                this.gameInstance.handleMicrobitButtonPress(data.button);
            }
            return;
        }

        // For Stream Stop game - map buttons to streams
        if (this.currentGame === 'streamstop') {
            if (this.gameInstance.handleKeyDown) {
                // Map buttons to Stream Stop keys: Green1=a, White=s, Red=d, Green2=f
                const streamKeys = ['a', 's', 'd', 'f'];
                const key = streamKeys[data.button - 1];
                
                this.gameInstance.handleKeyDown({ key: key, preventDefault: () => {} });
            }
            return;
        }

        // For Rhythm Timer game - map all buttons to spacebar
        if (this.currentGame === 'rhythmtimer') {
            if (this.gameInstance.handleMicrobitButtonPress) {
                this.gameInstance.handleMicrobitButtonPress(data.button);
            } else {
                // Fallback to spacebar
                const keyEvent = { key: ' ', preventDefault: () => {} };
                this.gameInstance.handleKeyDown(keyEvent);
            }
            return;
        }

        // For other games - map to spacebar or arrow keys
        if (this.gameInstance.handleKeyDown) {
            let keyEvent = { preventDefault: () => {} };
            
            switch (this.currentGame) {
                case 'flappybird':
                case 'stopthesprite':
                    // These games use spacebar
                    keyEvent.key = ' ';
                    break;
                    
                case 'snake':
                    // Use 4-button intuitive layout for Snake
                    if (this.gameInstance.handleMicrobitButtonPress) {
                        this.gameInstance.handleMicrobitButtonPress(data.button);
                    } else {
                        // Fallback to old arrow key mapping
                        const arrowKeys = ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'];
                        keyEvent.key = arrowKeys[data.button - 1];
                        this.gameInstance.handleKeyDown(keyEvent);
                    }
                    break;
                    
                default:
                    // Default to spacebar
                    keyEvent.key = ' ';
            }
            
            this.gameInstance.handleKeyDown(keyEvent);
        }
    }

       handleMicrobitButtonRelease(data) {
        if (!this.gameInstance) return;

        // For Pong game - handle button releases
        if (this.currentGame === 'pong') {
            if (this.gameInstance.handleMicrobitButtonRelease) {
                this.gameInstance.handleMicrobitButtonRelease(data.button);
            }
            return;
        }

        // For Stream Stop game
        if (this.currentGame === 'streamstop') {
            const streamKeys = ['a', 's', 'd', 'f'];
            const key = streamKeys[data.button - 1];
            if (this.gameInstance.handleKeyUp) {
                this.gameInstance.handleKeyUp({ key: key, preventDefault: () => {} });
            }
            return;
        }

        // For other games that need key release
        if (this.gameInstance.handleKeyUp) {
            let keyEvent = { preventDefault: () => {} };
            
            switch (this.currentGame) {
                case 'snake':
                    const arrowKeys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
                    keyEvent.key = arrowKeys[data.button - 1];
                    break;
                default:
                    keyEvent.key = ' ';
            }
            
            this.gameInstance.handleKeyUp(keyEvent);
        }
    }

    updateButtonIndicator(buttonNumber, pressed) {
        // Update visual indicators in the UI
        const colors = ['green', 'white', 'red', 'green'];
        const color = colors[buttonNumber - 1];
        
        // Create or update button indicator
        let indicator = document.getElementById(`microbit-button-${buttonNumber}`);
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = `microbit-button-${buttonNumber}`;
            indicator.style.cssText = `
                position: fixed;
                bottom: ${20 + (buttonNumber - 1) * 60}px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 25px;
                border: 2px solid #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                z-index: 1000;
                transition: all 0.1s ease;
            `;
            document.body.appendChild(indicator);
        }
        
        // Update appearance based on state
        if (pressed) {
            indicator.style.backgroundColor = color === 'white' ? '#ffffff' : color;
            indicator.style.color = color === 'white' ? '#000' : '#fff';
            indicator.style.transform = 'scale(1.2)';
            indicator.textContent = `${buttonNumber}`;
        } else {
            indicator.style.backgroundColor = 'rgba(255,255,255,0.2)';
            indicator.style.color = '#fff';
            indicator.style.transform = 'scale(1.0)';
            indicator.textContent = `${buttonNumber}`;
        }
    }

    // ========================================
    // LED CONTROL METHODS
    // ========================================

    // Basic LED Control
    async setLED(buttonNumber, state) {
        try {
            const result = await ipcRenderer.invoke('set-led', buttonNumber, state);
            if (result.success) {
                console.log(`💡 LED ${buttonNumber} set to ${state ? 'ON' : 'OFF'}`);
            }
            return result.success;
        } catch (error) {
            console.error('Error controlling LED:', error);
            return false;
        }
    }

    async setAllLEDs(state) {
        try {
            const result = await ipcRenderer.invoke('set-all-leds', state);
            if (result.success) {
                console.log(`💡 All LEDs set to ${state ? 'ON' : 'OFF'}`);
            }
            return result.success;
        } catch (error) {
            console.error('Error controlling all LEDs:', error);
            return false;
        }
    }

    async flashLED(buttonNumber, times = 3, duration = 500) {
        try {
            const result = await ipcRenderer.invoke('flash-led', buttonNumber, times, duration);
            if (result.success) {
                console.log(`⚡ LED ${buttonNumber} flashed ${times} times`);
            }
            return result.success;
        } catch (error) {
            console.error('Error flashing LED:', error);
            return false;
        }
    }

    async flashAllLEDs(times = 3, duration = 300) {
        try {
            const result = await ipcRenderer.invoke('flash-all-leds', times, duration);
            if (result.success) {
                console.log(`⚡ All LEDs flashed ${times} times`);
            }
            return result.success;
        } catch (error) {
            console.error('Error flashing all LEDs:', error);
            return false;
        }
    }

    async chaseLEDs(rounds = 2, speed = 200) {
        try {
            const result = await ipcRenderer.invoke('chase-leds', rounds, speed);
            if (result.success) {
                console.log(`🌈 LED chase pattern completed`);
            }
            return result.success;
        } catch (error) {
            console.error('Error running LED chase:', error);
            return false;
        }
    }

    // Random LED Patterns
    async randomLEDSequence(count = 4, onDuration = 500, offDuration = 100, totalSequences = 1) {
        try {
            const result = await ipcRenderer.invoke('random-led-sequence', count, onDuration, offDuration, totalSequences);
            if (result.success) {
                console.log(`🎲 Random LED sequence completed`);
            }
            return result.success;
        } catch (error) {
            console.error('Error running random LED sequence:', error);
            return false;
        }
    }

    async randomFlashSequence(sequences = 3, flashDuration = 500) {
        try {
            const result = await ipcRenderer.invoke('random-flash-sequence', sequences, flashDuration);
            if (result.success) {
                console.log(`⚡ Random flash sequence completed`);
            }
            return result.success;
        } catch (error) {
            console.error('Error running random flash sequence:', error);
            return false;
        }
    }

    async randomLEDGame(rounds = 5, speed = 600) {
        try {
            const result = await ipcRenderer.invoke('random-led-game', rounds, speed);
            if (result.success) {
                console.log(`🎮 Random LED game completed`);
            }
            return result.success;
        } catch (error) {
            console.error('Error running random LED game:', error);
            return false;
        }
    }

    async simonSaysPattern(patternLength = 4, playbackSpeed = 800) {
        try {
            const result = await ipcRenderer.invoke('simon-says-pattern', patternLength, playbackSpeed);
            if (result.success) {
                console.log(`🧠 Simon Says pattern: ${result.pattern.join(' → ')}`);
                return result.pattern; // Return the pattern for games to use
            }
            return null;
        } catch (error) {
            console.error('Error running Simon Says pattern:', error);
            return null;
        }
    }

    async randomCascade(waves = 3, waveSpeed = 200) {
        try {
            const result = await ipcRenderer.invoke('random-cascade', waves, waveSpeed);
            if (result.success) {
                console.log(`🌊 Random cascade completed`);
            }
            return result.success;
        } catch (error) {
            console.error('Error running random cascade:', error);
            return false;
        }
    }

    async rhythmicRandomPattern(beats = 8, tempo = 600) {
        try {
            const result = await ipcRenderer.invoke('rhythmic-random-pattern', beats, tempo);
            if (result.success) {
                console.log(`🎵 Rhythmic random pattern completed`);
            }
            return result.success;
        } catch (error) {
            console.error('Error running rhythmic pattern:', error);
            return false;
        }
    }

    // Game Event LED Patterns
    async onGameStart() {
        console.log('🎮 Game starting - LED pattern');
        await ipcRenderer.invoke('game-start-pattern');
    }

    async onGameOver() {
        console.log('🎮 Game over - LED pattern');
        await ipcRenderer.invoke('game-over-pattern');
    }

    async onGameWin() {
        console.log('🎮 Game won - LED pattern');
        await ipcRenderer.invoke('game-win-pattern');
    }

    // ========================================
    // GAME INTEGRATION WITH LED EFFECTS
    // ========================================

    async startGame(gameType) {
        console.log(`Starting game: ${gameType}`);
        
        // Run game start LED pattern
        await this.onGameStart();
        
        this.currentGame = gameType;
        
        // Hide main menu, show game screen
        const mainMenu = document.getElementById('mainMenu');
        const gameScreen = document.getElementById('gameScreen');
        
        if (mainMenu) mainMenu.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'flex';
        
        // Update game title
        const gameTitle = document.getElementById('gameTitle');
        if (gameTitle) {
            gameTitle.textContent = gameType.charAt(0).toUpperCase() + gameType.slice(1);
        }
        
        // Get canvas and resize it to use available space
        const canvas = document.getElementById('gameCanvas');
        const gameCanvasContainer = document.querySelector('.game-canvas');
        
        if (!canvas || !gameCanvasContainer) {
            console.error('Canvas or container not found');
            this.returnToMenu();
            return;
        }
        
        // Wait for layout to be complete
        setTimeout(async () => {
            try {
                const containerRect = gameCanvasContainer.getBoundingClientRect();
                const availableWidth = containerRect.width - 20;
                const availableHeight = containerRect.height - 20;
                
                let canvasWidth, canvasHeight;
                
                switch(gameType) {
                    case 'snake':
                        const minDimension = Math.min(availableWidth, availableHeight);
                        const gridSize = 20;
                        canvasWidth = Math.floor(minDimension / gridSize) * gridSize;
                        canvasHeight = canvasWidth;
                        if (availableWidth > availableHeight * 1.2) {
                            canvasWidth = Math.floor(availableWidth * 0.8 / gridSize) * gridSize;
                        }
                        break;
                    case 'pong':
                        canvasWidth = Math.min(availableWidth * 0.95, 1000);
                        canvasHeight = Math.min(availableHeight * 0.95, canvasWidth * 0.6);
                        break;
                    case 'flappybird':
                        canvasHeight = availableHeight * 0.95;
                        canvasWidth = Math.min(availableWidth * 0.95, canvasHeight * 0.75);
                        break;
                    case 'wirebuzzer':
                        canvasWidth = availableWidth * 0.95;
                        canvasHeight = Math.min(availableHeight * 0.95, canvasWidth * 0.7);
                        break;
                    case 'bikerbeat':
                    case 'streamstop':
                        canvasWidth = availableWidth * 0.95;
                        canvasHeight = Math.min(availableHeight * 0.95, canvasWidth * 0.6);
                        break;
                    default:
                        canvasWidth = availableWidth * 0.95;
                        canvasHeight = availableHeight * 0.95;
                }
                
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                const ctx = canvas.getContext('2d');
                
                // Create game instance based on type
                switch(gameType) {
                    case 'pong':
                        if (typeof PongGame !== 'undefined') {
                            this.gameInstance = new PongGame(canvas, ctx, this);
                            await this.setLED(1, true);
                            await this.setLED(4, true);
                        } else {
                            console.error('PongGame class not found');
                            this.returnToMenu();
                        }
                        break;
                    case 'snake':
                        if (typeof SnakeGame !== 'undefined') {
                            this.gameInstance = new SnakeGame(canvas, ctx, this);
                            await this.setLED(1, true);
                        } else {
                            console.error('SnakeGame class not found');
                            this.returnToMenu();
                        }
                        break;
                    case 'flappybird':
                        if (typeof FlappyBirdGame !== 'undefined') {
                            this.gameInstance = new FlappyBirdGame(canvas, ctx, this);
                            await this.setLED(1, true);
                        } else {
                            console.error('FlappyBirdGame class not found');
                            this.returnToMenu();
                        }
                        break;
                    case 'rhythmtimer':
                        if (typeof RhythmTimerGame !== 'undefined') {
                            this.gameInstance = new RhythmTimerGame(canvas, ctx, this);
                            this.rhythmLEDInterval = setInterval(async () => {
                                await this.flashLED(1, 1, 200);
                            }, 2000);
                        } else {
                            console.error('RhythmTimerGame class not found');
                            this.returnToMenu();
                        }
                        break;
                    case 'stopthesprite':
                        if (typeof StopTheSpriteGame !== 'undefined') {
                            this.gameInstance = new StopTheSpriteGame(canvas, ctx, this);
                            await this.setLED(1, true);
                        } else {
                            console.error('StopTheSpriteGame class not found');
                            this.returnToMenu();
                        }
                        break;
                    case 'streamstop':
                        if (typeof StreamStopGame !== 'undefined') {
                            this.gameInstance = new StreamStopGame(canvas, ctx, this);
                            await this.setAllLEDs(true);
                        } else {
                            console.error('StreamStopGame class not found');
                            this.returnToMenu();
                        }
                        break;
                    case 'wirebuzzer':
                        if (typeof WireBuzzerGame !== 'undefined') {
                            this.gameInstance = new WireBuzzerGame(canvas, ctx, this);
                            await this.setLED(1, true);
                        } else {
                            console.error('WireBuzzerGame class not found');
                            this.returnToMenu();
                        }
                        break;
                    default:
                        console.error(`Unknown game type: ${gameType}`);
                        alert(`Game "${gameType}" is not implemented yet.`);
                        this.returnToMenu();
                }
            } catch (error) {
                console.error('Error starting game:', error);
                alert('Failed to start game. Check console for errors.');
                this.returnToMenu();
            }
        }, 50);
    }

    async returnToMenu() {
        console.log('Returning to menu...');
        
        // Clean up any LED intervals
        if (this.rhythmLEDInterval) {
            clearInterval(this.rhythmLEDInterval);
        }
        
        // Turn off all LEDs when returning to menu
        await this.setAllLEDs(false);
        
        if (this.gameInstance && this.gameInstance.destroy) {
            this.gameInstance.destroy();
        }
        
        this.gameInstance = null;
        this.currentGame = null;
        
        const gameScreen = document.getElementById('gameScreen');
        const mainMenu = document.getElementById('mainMenu');
        
        if (gameScreen) gameScreen.style.display = 'none';
        if (mainMenu) mainMenu.style.display = 'block';
    }

    async gameOver(score) {
        // Run game over LED pattern
        await this.onGameOver();
        
        const playerName = prompt(`Game Over! Score: ${score}\nEnter your name for the high score list:`);
        
        if (playerName && playerName.trim()) {
            const result = await this.saveHighScore(playerName.trim(), score);
            if (result.success) {
                alert('High score saved!');
            }
        }
        
        // Turn off LEDs after game over
        setTimeout(async () => {
            await this.setAllLEDs(false);
            this.returnToMenu();
        }, 3000);
    }

    // ========================================
    // LED TEST PANEL (Enhanced)
    // ========================================

    createLEDTestPanel() {
        // Remove existing panel if it exists
        const existingPanel = document.getElementById('led-test-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const testPanel = document.createElement('div');
        testPanel.id = 'led-test-panel';
        testPanel.innerHTML = `
            <div style="position: fixed; top: 100px; left: 10px; background: rgba(0,0,0,0.95); color: white; padding: 15px; border-radius: 8px; z-index: 1000; font-family: Arial; max-width: 300px;">
                <h4>🎮 LED Control Panel</h4>
                
                <!-- Individual LED Controls -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                    <button id="led-1-on" style="padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 1 ON</button>
                    <button id="led-1-off" style="padding: 8px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 1 OFF</button>
                    <button id="led-2-on" style="padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 2 ON</button>
                    <button id="led-2-off" style="padding: 8px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 2 OFF</button>
                    <button id="led-3-on" style="padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 3 ON</button>
                    <button id="led-3-off" style="padding: 8px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 3 OFF</button>
                    <button id="led-4-on" style="padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 4 ON</button>
                    <button id="led-4-off" style="padding: 8px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">LED 4 OFF</button>
                </div>

                <!-- Basic Controls -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                    <button id="all-leds-on" style="padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">All ON</button>
                    <button id="all-leds-off" style="padding: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">All OFF</button>
                    <button id="flash-all" style="padding: 10px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer;">Flash All</button>
                    <button id="chase-pattern" style="padding: 10px; background: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer;">Chase</button>
                </div>

                <!-- Random Patterns -->
                <h5 style="margin: 15px 0 10px 0; color: #FFD700;">🎲 Random Patterns</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                    <button id="random-sequence" style="padding: 10px; background: #E91E63; color: white; border: none; border-radius: 4px; cursor: pointer;">Random Sequence</button>
                    <button id="random-flash" style="padding: 10px; background: #795548; color: white; border: none; border-radius: 4px; cursor: pointer;">Random Flash</button>
                    <button id="random-game" style="padding: 10px; background: #607D8B; color: white; border: none; border-radius: 4px; cursor: pointer;">Random Game</button>
                    <button id="simon-says" style="padding: 10px; background: #3F51B5; color: white; border: none; border-radius: 4px; cursor: pointer;">Simon Says</button>
                    <button id="cascade" style="padding: 10px; background: #009688; color: white; border: none; border-radius: 4px; cursor: pointer;">Cascade</button>
                    <button id="rhythmic" style="padding: 10px; background: #FF5722; color: white; border: none; border-radius: 4px; cursor: pointer;">Rhythmic</button>
                </div>

                <!-- Game Patterns -->
                <h5 style="margin: 15px 0 10px 0; color: #FFD700;">🎮 Game Events</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                    <button id="game-start-btn" style="padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Start</button>
                    <button id="game-over-btn" style="padding: 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Over</button>
                    <button id="game-win-btn" style="padding: 8px; background: #FFD700; color: black; border: none; border-radius: 4px; cursor: pointer;">Win</button>
                </div>

                <button id="close-led-panel" style="margin-top: 10px; width: 100%; padding: 10px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">Close Panel</button>
            </div>
        `;
        
        document.body.appendChild(testPanel);
        
        // Individual LED controls
        document.getElementById('led-1-on').onclick = () => this.setLED(1, true);
        document.getElementById('led-1-off').onclick = () => this.setLED(1, false);
        document.getElementById('led-2-on').onclick = () => this.setLED(2, true);
        document.getElementById('led-2-off').onclick = () => this.setLED(2, false);
        document.getElementById('led-3-on').onclick = () => this.setLED(3, true);
        document.getElementById('led-3-off').onclick = () => this.setLED(3, false);
        document.getElementById('led-4-on').onclick = () => this.setLED(4, true);
        document.getElementById('led-4-off').onclick = () => this.setLED(4, false);
        
        // Basic controls
        document.getElementById('all-leds-on').onclick = () => this.setAllLEDs(true);
        document.getElementById('all-leds-off').onclick = () => this.setAllLEDs(false);
        document.getElementById('flash-all').onclick = () => this.flashAllLEDs(3, 200);
        document.getElementById('chase-pattern').onclick = () => this.chaseLEDs(2, 150);
        
        // Random patterns
        document.getElementById('random-sequence').onclick = () => this.randomLEDSequence(4, 500, 100, 3);
        document.getElementById('random-flash').onclick = () => this.randomFlashSequence(4, 400);
        document.getElementById('random-game').onclick = () => this.randomLEDGame(6, 500);
        document.getElementById('simon-says').onclick = () => this.simonSaysPattern(6, 600);
        document.getElementById('cascade').onclick = () => this.randomCascade(3, 250);
        document.getElementById('rhythmic').onclick = () => this.rhythmicRandomPattern(12, 500);
        
        // Game events
        document.getElementById('game-start-btn').onclick = () => this.onGameStart();
        document.getElementById('game-over-btn').onclick = () => this.onGameOver();
        document.getElementById('game-win-btn').onclick = () => this.onGameWin();
        
        document.getElementById('close-led-panel').onclick = () => {
            document.getElementById('led-test-panel').remove();
        };
        
        console.log('💡 Enhanced LED test panel created - try all the patterns!');
    }

    // ========================================
    // REST OF YOUR EXISTING METHODS
    // ========================================

    async checkMicrobitConnection() {
        try {
            const status = await ipcRenderer.invoke('get-microbit-status');
            this.microbitConnected = status.connected;
            this.updateMicrobitStatus(status.connected);
            
            if (status.connected) {
                console.log(`✅ Connected to ${status.connectionCount} Microbits`);
            }
        } catch (error) {
            console.log('Microbit not available:', error.message);
            this.updateMicrobitStatus(false);
        }
    }

    updateMicrobitStatus(connected) {
        const status = document.getElementById('microbitStatus');
        if (!status) return;
        
        this.microbitConnected = connected;
        
        if (connected) {
            status.textContent = 'Microbit Arcade: Connected';
            status.className = 'microbit-status connected';
        } else {
            status.textContent = 'Microbit Arcade: Searching...';
            status.className = 'microbit-status disconnected';
        }
    }

    initializeEventListeners() {
        console.log('Setting up event listeners...');
        
        // Game card clicks
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameType = card.dataset.game;
                console.log(`Game card clicked: ${gameType}`);
                this.startGame(gameType);
            });

            card.addEventListener('mouseenter', () => {
                this.showHighScores(card.dataset.game);
            });
        });

        // Back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log('Back button clicked');
                this.returnToMenu();
            });
        }

        // Keep keyboard events for fallback
        document.addEventListener('keydown', (e) => {
            if (this.gameInstance && this.gameInstance.handleKeyDown) {
                this.gameInstance.handleKeyDown(e);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.gameInstance && this.gameInstance.handleKeyUp) {
                this.gameInstance.handleKeyUp(e);
            }
        });
        
        console.log('Event listeners set up successfully');
    }

    async showHighScores(gameType) {
        try {
            const scores = await ipcRenderer.invoke('get-high-scores', gameType);
            const scoresList = document.getElementById('highScoresList');
            
            if (!scoresList) return;
            
            if (scores.length === 0) {
                scoresList.innerHTML = '<p>No scores yet!</p>';
                return;
            }

            const scoresHTML = scores.map((score, index) => `
                <div class="score-item">
                    <span>${index + 1}. ${score.name}</span>
                    <span>${score.score}</span>
                </div>
            `).join('');

            scoresList.innerHTML = `
                <h4>${gameType.charAt(0).toUpperCase() + gameType.slice(1)}</h4>
                <div class="score-list">${scoresHTML}</div>
            `;
        } catch (error) {
            console.error('Error loading high scores:', error);
        }
    }

    updateScore(score) {
        const scoreElement = document.getElementById('gameScore');
        if (scoreElement) {
            scoreElement.textContent = `Score: ${score}`;
        }
    }

    async saveHighScore(playerName, score) {
        try {
            const result = await ipcRenderer.invoke('save-high-score', this.currentGame, playerName, score);
            return result;
        } catch (error) {
            console.error('Error saving high score:', error);
            return { success: false };
        }
    }
}

// Add keyboard shortcut to open LED test panel
document.addEventListener('keydown', (e) => {
    if (e.key === 'L' && e.ctrlKey) { // Ctrl+L
        e.preventDefault();
        if (window.gamesPlatform && !document.getElementById('led-test-panel')) {
            window.gamesPlatform.createLEDTestPanel();
        }
    }
});

// Initialize the platform when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing platform with full Microbit LED support...');
    
    if (typeof GamesPlatform !== 'undefined') {
        console.log('GamesPlatform class found, initializing...');
        window.gamesPlatform = new GamesPlatform();
    } else {
        console.error('GamesPlatform class not found!');
    }
});