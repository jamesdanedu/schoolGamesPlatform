// js/games/snake.js - Snake Game Implementation with Fixed Button Handling

class SnakeGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Game settings
        this.gridSize = 20;
        this.tileCountX = Math.floor(canvas.width / this.gridSize);
        this.tileCountY = Math.floor(canvas.height / this.gridSize);
        
        // Snake properties
        this.snake = [
            {x: Math.floor(this.tileCountX / 2), y: Math.floor(this.tileCountY / 2)}
        ];
        this.direction = {x: 1, y: 0};
        this.nextDirection = {x: 1, y: 0};
        
        // Food properties
        this.food = this.generateFood();
        
        // Game state
        this.score = 0;
        this.running = true;
        this.gameSpeed = 150; // milliseconds
        this.gameOver = false; // Track if game ended vs paused
        
        // Button handling properties
        this.lastButtonTime = 0;
        this.buttonDebounceTime = 100; // 100ms minimum between direction changes
        this.directionChanged = false; // Prevent multiple direction changes per tick
        
        // Start game loop
        this.gameLoop = this.gameLoop.bind(this);
        this.lastTime = 0;
        requestAnimationFrame(this.gameLoop);
    }

    handleKeyDown(e) {
        // Check if game is over and allow restart
        if (this.gameOver) {
            if (e.key === ' ' || e.key === 'Spacebar' || e.key.startsWith('Arrow')) {
                this.restartGame();
                e.preventDefault();
                return;
            }
        }

        if (!this.running) {
            // Handle pause/unpause
            if (e.key === ' ' || e.key === 'Spacebar') {
                this.running = !this.running;
                if (this.running) {
                    requestAnimationFrame(this.gameLoop);
                }
                e.preventDefault();
            }
            return;
        }

        const currentTime = Date.now();
        
        // Apply same debouncing to keyboard
        if (currentTime - this.lastButtonTime < this.buttonDebounceTime) {
            return;
        }
        
        if (this.directionChanged) {
            return;
        }

        let newDirection = null;

        // Prevent reverse direction
        switch(e.key) {
            case 'ArrowUp':
                if (this.direction.y !== 1) {
                    newDirection = {x: 0, y: -1};
                }
                e.preventDefault();
                break;
            case 'ArrowDown':
                if (this.direction.y !== -1) {
                    newDirection = {x: 0, y: 1};
                }
                e.preventDefault();
                break;
            case 'ArrowLeft':
                if (this.direction.x !== 1) {
                    newDirection = {x: -1, y: 0};
                }
                e.preventDefault();
                break;
            case 'ArrowRight':
                if (this.direction.x !== -1) {
                    newDirection = {x: 1, y: 0};
                }
                e.preventDefault();
                break;
            case ' ':
                // Spacebar to pause/unpause
                this.running = !this.running;
                if (this.running) {
                    requestAnimationFrame(this.gameLoop);
                }
                e.preventDefault();
                break;
        }

        if (newDirection) {
            this.nextDirection = newDirection;
            this.lastButtonTime = currentTime;
            this.directionChanged = true;
        }
    }

    handleKeyUp(e) {
        // No special key up handling needed for Snake
    }

    generateFood() {
        let food;
        do {
            food = {
                x: Math.floor(Math.random() * this.tileCountX),
                y: Math.floor(Math.random() * this.tileCountY)
            };
        } while (this.snake.some(segment => segment.x === food.x && segment.y === food.y));
        
        return food;
    }

    handleMicrobitButtonPress(buttonNumber) {
        // Check if game is over and allow restart
        if (this.gameOver) {
            this.restartGame();
            return;
        }

        if (!this.running) {
            // Game is paused, any button resumes
            this.running = true;
            requestAnimationFrame(this.gameLoop);
            return;
        }

        const currentTime = Date.now();
        
        // Debounce button presses
        if (currentTime - this.lastButtonTime < this.buttonDebounceTime) {
            return;
        }
        
        // Prevent multiple direction changes before the next game update
        if (this.directionChanged) {
            return;
        }

        let newDirection = null;

        switch(buttonNumber) {
            case 1: // Button 1 - UP
                if (this.direction.y !== 1) { // Can't go up if currently going down
                    newDirection = {x: 0, y: -1};
                }
                break;
            case 2: // Button 2 - LEFT
                if (this.direction.x !== 1) { // Can't go left if currently going right
                    newDirection = {x: -1, y: 0};
                }
                break;
            case 3: // Button 3 - RIGHT
                if (this.direction.x !== -1) { // Can't go right if currently going left
                    newDirection = {x: 1, y: 0};
                }
                break;
            case 4: // Button 4 - DOWN
                if (this.direction.y !== -1) { // Can't go down if currently going up
                    newDirection = {x: 0, y: 1};
                }
                break;
        }

        // Only update if we have a valid new direction
        if (newDirection) {
            this.nextDirection = newDirection;
            this.lastButtonTime = currentTime;
            this.directionChanged = true;
            
            console.log(`Snake direction changed to: ${buttonNumber === 1 ? 'UP' : buttonNumber === 2 ? 'LEFT' : buttonNumber === 3 ? 'RIGHT' : 'DOWN'}`);
        }
    }

    // Handle Microbit button releases (not needed for Snake, but good practice)
    handleMicrobitButtonRelease(buttonNumber) {
        // Snake doesn't need release handling since it's discrete moves
    }

    update() {
        if (!this.running) return;

        // Reset direction change flag at start of each update
        this.directionChanged = false;

        // Update direction
        this.direction = {...this.nextDirection};

        // Move snake head
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };

        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCountX || head.y < 0 || head.y >= this.tileCountY) {
            this.endGame();
            return;
        }

        // Check self collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.endGame();
            return;
        }

        this.snake.unshift(head);

        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.platform.updateScore(this.score);
            this.food = this.generateFood();
            
            // Increase speed slightly
            this.gameSpeed = Math.max(80, this.gameSpeed - 2);
        } else {
            // Remove tail if no food eaten
            this.snake.pop();
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid (subtle)
        this.ctx.strokeStyle = '#111';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.tileCountX; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i <= this.tileCountY; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.gridSize);
            this.ctx.lineTo(this.canvas.width, i * this.gridSize);
            this.ctx.stroke();
        }

        // Draw snake
        this.snake.forEach((segment, index) => {
            if (index === 0) {
                // Head
                this.ctx.fillStyle = '#4CAF50';
            } else {
                // Body
                this.ctx.fillStyle = '#81C784';
            }
            
            this.ctx.fillRect(
                segment.x * this.gridSize + 1,
                segment.y * this.gridSize + 1,
                this.gridSize - 2,
                this.gridSize - 2
            );
        });

        // Draw food
        this.ctx.fillStyle = '#F44336';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2,
            this.food.y * this.gridSize + this.gridSize / 2,
            this.gridSize / 2 - 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Draw score
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        this.ctx.fillText(`Length: ${this.snake.length}`, 10, 55);

        // Draw instructions with button layout
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        const hasButtons = this.lastButtonTime > 0; // Shows if buttons have been used
        if (hasButtons) {
            this.ctx.fillText('🎮 Buttons: 1↑ 2← 3→ 4↓ • Arrow keys • Spacebar to pause', this.canvas.width / 2, this.canvas.height - 20);
        } else {
            this.ctx.fillText('Use arrow keys to move • Spacebar to pause • 🎮 Use buttons: 1↑ 2← 3→ 4↓', this.canvas.width / 2, this.canvas.height - 20);
        }

        // Handle pause screen (only when running=false but gameOver=false)
        if (!this.running && !this.gameOver && this.score > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
            
            this.ctx.font = '20px Arial';
            this.ctx.fillText('Press Spacebar or any button to Continue', this.canvas.width / 2, this.canvas.height / 2 + 40);
        }

        // Handle game over screen
        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);
            
            this.ctx.font = '24px Arial';
            this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
            
            this.ctx.font = '18px Arial';
            this.ctx.fillText(`Snake Length: ${this.snake.length}`, this.canvas.width / 2, this.canvas.height / 2 + 40);

            this.ctx.font = '20px Arial';
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillText('Press any button or Spacebar to play again', this.canvas.width / 2, this.canvas.height / 2 + 80);
        }
    }

    gameLoop(currentTime) {
        if (currentTime - this.lastTime >= this.gameSpeed) {
            this.update();
            this.draw();
            this.lastTime = currentTime;
        }

        if (this.running) {
            requestAnimationFrame(this.gameLoop);
        }
    }

    endGame() {
        this.running = false;
        this.gameOver = true;
        
        // Don't immediately trigger platform game over - allow restart
        console.log('Snake game ended - press any button to restart');
    }

    restartGame() {
        console.log('Restarting Snake game...');
        
        // Reset all game state
        this.snake = [
            {x: Math.floor(this.tileCountX / 2), y: Math.floor(this.tileCountY / 2)}
        ];
        this.direction = {x: 1, y: 0};
        this.nextDirection = {x: 1, y: 0};
        this.food = this.generateFood();
        this.score = 0;
        this.gameSpeed = 150;
        this.gameOver = false;
        this.running = true;
        this.directionChanged = false;
        this.lastButtonTime = 0;
        
        // Update platform score
        this.platform.updateScore(this.score);
        
        // Restart game loop
        this.lastTime = 0;
        requestAnimationFrame(this.gameLoop);
    }

    gameOver() {
        // This method is kept for compatibility but now calls endGame
        this.endGame();
        
        // Only trigger platform game over after a delay, giving chance to restart
        setTimeout(() => {
            if (this.gameOver) { // Only if still in game over state (not restarted)
                this.platform.gameOver(this.score);
            }
        }, 5000); // 5 second delay before going to menu
    }

    destroy() {
        this.running = false;
    }
}