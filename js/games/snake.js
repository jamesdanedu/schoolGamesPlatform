// js/games/snake.js - Snake Game Implementation

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
        
        // Start game loop
        this.gameLoop = this.gameLoop.bind(this);
        this.lastTime = 0;
        requestAnimationFrame(this.gameLoop);
    }

    handleKeyDown(e) {
        if (!this.running) return;

        // Prevent reverse direction
        switch(e.key) {
            case 'ArrowUp':
                if (this.direction.y !== 1) {
                    this.nextDirection = {x: 0, y: -1};
                }
                e.preventDefault();
                break;
            case 'ArrowDown':
                if (this.direction.y !== -1) {
                    this.nextDirection = {x: 0, y: 1};
                }
                e.preventDefault();
                break;
            case 'ArrowLeft':
                if (this.direction.x !== 1) {
                    this.nextDirection = {x: -1, y: 0};
                }
                e.preventDefault();
                break;
            case 'ArrowRight':
                if (this.direction.x !== -1) {
                    this.nextDirection = {x: 1, y: 0};
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

    update() {
        if (!this.running) return;

        // Update direction
        this.direction = {...this.nextDirection};

        // Move snake head
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };

        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCountX || head.y < 0 || head.y >= this.tileCountY) {
            this.gameOver();
            return;
        }

        // Check self collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.gameOver();
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

        // Draw instructions
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Use arrow keys to move • Spacebar to pause', this.canvas.width / 2, this.canvas.height - 20);

        if (!this.running && this.score > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
            
            this.ctx.font = '20px Arial';
            this.ctx.fillText('Press Spacebar to Continue', this.canvas.width / 2, this.canvas.height / 2 + 40);
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

    gameOver() {
        this.running = false;
        
        // Draw game over screen
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 20);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
        
        this.ctx.font = '18px Arial';
        this.ctx.fillText(`Snake Length: ${this.snake.length}`, this.canvas.width / 2, this.canvas.height / 2 + 50);

        // Trigger platform game over
        setTimeout(() => {
            this.platform.gameOver(this.score);
        }, 2000);
    }

    destroy() {
        this.running = false;
    }
}
