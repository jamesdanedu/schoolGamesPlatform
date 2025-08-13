// js/platform.js - Main Games Platform Logic

const { ipcRenderer } = require('electron');

class GamesPlatform {
    constructor() {
        this.currentGame = null;
        this.gameInstance = null;
        this.microbitConnected = false;
        
        console.log('GamesPlatform initializing...');
        this.initializeEventListeners();
        this.checkMicrobitConnection();
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

            // Show high scores on hover
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

        // Keyboard events
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

    async checkMicrobitConnection() {
        try {
            const result = await ipcRenderer.invoke('setup-microbit');
            this.updateMicrobitStatus(result.success);
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
            status.textContent = 'Microbit: Connected';
            status.className = 'microbit-status connected';
        } else {
            status.textContent = 'Microbit: Disconnected';
            status.className = 'microbit-status disconnected';
        }
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

    startGame(gameType) {
        console.log(`Starting game: ${gameType}`);
        
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
        setTimeout(() => {
            try {
                const containerRect = gameCanvasContainer.getBoundingClientRect();
                const availableWidth = containerRect.width - 20; // account for padding
                const availableHeight = containerRect.height - 20; // account for padding
                
                let canvasWidth, canvasHeight;
                
                switch(gameType) {
                    case 'snake':
                        // Snake works best with square grid, use most of available space
                        const minDimension = Math.min(availableWidth, availableHeight);
                        const gridSize = 20;
                        canvasWidth = Math.floor(minDimension / gridSize) * gridSize;
                        canvasHeight = canvasWidth;
                        // If we have more width available, make it slightly rectangular
                        if (availableWidth > availableHeight * 1.2) {
                            canvasWidth = Math.floor(availableWidth * 0.8 / gridSize) * gridSize;
                        }
                        break;
                    case 'pong':
                        // Pong works best with wide aspect ratio
                        canvasWidth = Math.min(availableWidth * 0.95, 1000);
                        canvasHeight = Math.min(availableHeight * 0.95, canvasWidth * 0.6);
                        break;
                    case 'flappybird':
                        // Flappy Bird works well with vertical aspect ratio
                        canvasHeight = availableHeight * 0.95;
                        canvasWidth = Math.min(availableWidth * 0.95, canvasHeight * 0.75);
                        break;
                    case 'wirebuzzer':
                        // Wire Buzzer works best with wide landscape format
                        canvasWidth = availableWidth * 0.95;
                        canvasHeight = Math.min(availableHeight * 0.95, canvasWidth * 0.7);
                        break;
                    case 'bikerbeat':
                        // Biker Beat works well with wide cinematic format
                        canvasWidth = availableWidth * 0.95;
                        canvasHeight = Math.min(availableHeight * 0.95, canvasWidth * 0.6);
                        break;
                    case 'streamstop':
                        // Stream Stop works well with wide cinematic format
                        canvasWidth = availableWidth * 0.95;
                        canvasHeight = Math.min(availableHeight * 0.95, canvasWidth * 0.6);
                        break;
                    default:
                        // Use most of available space
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
                            console.log('Pong game created successfully');
                        } else {
                            console.error('PongGame class not found');
                            alert('Pong game failed to load. Check console for errors.');
                            this.returnToMenu();
                        }
                        break;
                    case 'snake':
                        if (typeof SnakeGame !== 'undefined') {
                            this.gameInstance = new SnakeGame(canvas, ctx, this);
                            console.log('Snake game created successfully');
                        } else {
                            console.error('SnakeGame class not found');
                            alert('Snake game failed to load. Check console for errors.');
                            this.returnToMenu();
                        }
                        break;
                    case 'flappybird':
                        if (typeof FlappyBirdGame !== 'undefined') {
                            this.gameInstance = new FlappyBirdGame(canvas, ctx, this);
                            console.log('Flappy Bird game created successfully');
                        } else {
                            console.error('FlappyBirdGame class not found');
                            alert('Flappy Bird game failed to load. Check console for errors.');
                            this.returnToMenu();
                        }
                        break;
                    case 'rhythmtimer':
                        if (typeof RhythmTimerGame !== 'undefined') {
                            this.gameInstance = new RhythmTimerGame(canvas, ctx, this);
                            console.log('Rhythm Timer game created successfully');
                        } else {
                            console.error('RhythmTimerGame class not found');
                            alert('Rhythm Timer game failed to load. Check console for errors.');
                            this.returnToMenu();
                        }
                        break;
                    case 'stopthesprite':
                        if (typeof StopTheSpriteGame !== 'undefined') {
                            this.gameInstance = new StopTheSpriteGame(canvas, ctx, this);
                            console.log('Stop the Sprite game created successfully');
                        } else {
                            console.error('StopTheSpriteGame class not found');
                            alert('Stop the Sprite game failed to load. Check console for errors.');
                            this.returnToMenu();
                        }
                        break;
                    case 'streamstop':
                        if (typeof StreamStopGame !== 'undefined') {
                            this.gameInstance = new StreamStopGame(canvas, ctx, this);
                            console.log('Stream Stop game created successfully');
                        } else {
                            console.error('StreamStopGame class not found');
                            alert('Stream Stop game failed to load. Check console for errors.');
                            this.returnToMenu();
                        }
                        break;
                    case 'wirebuzzer':
                        if (typeof WireBuzzerGame !== 'undefined') {
                            this.gameInstance = new WireBuzzerGame(canvas, ctx, this);
                            console.log('Wire Buzzer game created successfully');
                        } else {
                            console.error('WireBuzzerGame class not found');
                            alert('Wire Buzzer game failed to load. Check console for errors.');
                            this.returnToMenu();
                        }
                        break;
                    case 'bikerbeat':
                        if (typeof BikerBeatGame !== 'undefined') {
                            this.gameInstance = new BikerBeatGame(canvas, ctx, this);
                            console.log('Biker Beat game created successfully');
                        } else {
                            console.error('BikerBeatGame class not found');
                            alert('Biker Beat game failed to load. Check console for errors.');
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
        }, 50); // Small delay to ensure layout is complete
    }

    returnToMenu() {
        console.log('Returning to menu...');
        
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

    async gameOver(score) {
        const playerName = prompt(`Game Over! Score: ${score}\nEnter your name for the high score list:`);
        
        if (playerName && playerName.trim()) {
            const result = await this.saveHighScore(playerName.trim(), score);
            if (result.success) {
                alert('High score saved!');
            }
        }
        
        setTimeout(() => {
            this.returnToMenu();
        }, 1000);
    }
}