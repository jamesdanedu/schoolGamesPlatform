// js/platform.js - Main Games Platform Logic

const { ipcRenderer } = require('electron');

class GamesPlatform {
    constructor() {
        this.currentGame = null;
        this.gameInstance = null;
        this.microbitConnected = false;
        
        this.initializeEventListeners();
        this.checkMicrobitConnection();
    }

    initializeEventListeners() {
        // Game card clicks
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameType = card.dataset.game;
                this.startGame(gameType);
            });

            // Show high scores on hover
            card.addEventListener('mouseenter', () => {
                this.showHighScores(card.dataset.game);
            });
        });

        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            this.returnToMenu();
        });

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
    }

    async checkMicrobitConnection() {
        try {
            const result = await ipcRenderer.invoke('setup-microbit');
            this.updateMicrobitStatus(result.success);
        } catch (error) {
            this.updateMicrobitStatus(false);
        }
    }

    updateMicrobitStatus(connected) {
        const status = document.getElementById('microbitStatus');
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
        this.currentGame = gameType;
        
        // Hide main menu, show game screen
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'flex';
        
        // Update game title
        document.getElementById('gameTitle').textContent = 
            gameType.charAt(0).toUpperCase() + gameType.slice(1);
        
        // Get canvas and resize it to use available space
        const canvas = document.getElementById('gameCanvas');
        const gameCanvasContainer = document.querySelector('.game-canvas');
        
        // Wait for layout to be complete
        setTimeout(() => {
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
                default:
                    // Use most of available space
                    canvasWidth = availableWidth * 0.95;
                    canvasHeight = availableHeight * 0.95;
            }
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            const ctx = canvas.getContext('2d');
            
            switch(gameType) {
                case 'pong':
                    this.gameInstance = new PongGame(canvas, ctx, this);
                    break;
                case 'snake':
                    this.gameInstance = new SnakeGame(canvas, ctx, this);
                    break;
                case 'flappybird':
                    this.gameInstance = new FlappyBirdGame(canvas, ctx, this);
                    break;
                case 'rhythmtimer':
                    this.gameInstance = new RhythmTimerGame(canvas, ctx, this);
                    break;
                case 'stopthesprite':
                    this.gameInstance = new StopTheSpriteGame(canvas, ctx, this);
                    break;
                default:
                    alert(`${gameType} game not yet implemented!`);
                    this.returnToMenu();
            }
        }, 50); // Small delay to ensure layout is complete
    }

    returnToMenu() {
        if (this.gameInstance && this.gameInstance.destroy) {
            this.gameInstance.destroy();
        }
        
        this.gameInstance = null;
        this.currentGame = null;
        
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'block';
    }

    updateScore(score) {
        document.getElementById('gameScore').textContent = `Score: ${score}`;
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
