// js/games/flappybird.js - Flappy Bird Game Implementation

class FlappyBirdGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors based on canvas size
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Bird properties
        this.birdX = canvas.width * 0.2;
        this.birdY = canvas.height / 2;
        this.birdSize = 15 * Math.min(this.scaleX, this.scaleY);
        this.birdVelocity = 0;
        this.gravity = 0.5 * this.scaleY;
        this.jumpStrength = -8 * this.scaleY;
        
        // Pipe properties
        this.pipeWidth = 60 * this.scaleX;
        this.pipeGap = 150 * this.scaleY;
        this.pipeSpeed = 3 * this.scaleX;
        this.pipes = [];
        this.pipeSpawnTimer = 0;
        this.pipeSpawnDelay = 90; // frames between pipes
        
        // Game state
        this.score = 0;
        this.running = true;
        this.gameStarted = false;
        
        // Controls
        this.keys = {};
        this.spacePressed = false;
        
        this.gameLoop = this.gameLoop.bind(this);
        this.gameLoop();
    }

    handleKeyDown(e) {
        this.keys[e.key] = true;
        
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (!this.spacePressed) {
                this.jump();
                this.spacePressed = true;
            }
            if (!this.gameStarted) {
                this.gameStarted = true;
            }
        }
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
        
        if (e.key === ' ' || e.key === 'Spacebar') {
            this.spacePressed = false;
        }
    }

    jump() {
        if (this.running) {
            this.birdVelocity = this.jumpStrength;
        }
    }

    generatePipe() {
        const minHeight = 50 * this.scaleY;
        const maxHeight = this.canvas.height - this.pipeGap - minHeight;
        const topHeight = minHeight + Math.random() * (maxHeight - minHeight);
        
        this.pipes.push({
            x: this.canvas.width,
            topHeight: topHeight,
            bottomY: topHeight + this.pipeGap,
            passed: false
        });
    }

    update() {
        if (!this.running) return;
        
        if (this.gameStarted) {
            // Update bird physics
            this.birdVelocity += this.gravity;
            this.birdY += this.birdVelocity;
            
            // Bird bounds checking
            if (this.birdY <= 0 || this.birdY >= this.canvas.height - this.birdSize) {
                this.gameOver();
                return;
            }
            
            // Spawn pipes
            this.pipeSpawnTimer++;
            if (this.pipeSpawnTimer >= this.pipeSpawnDelay) {
                this.generatePipe();
                this.pipeSpawnTimer = 0;
            }
            
            // Update pipes
            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const pipe = this.pipes[i];
                pipe.x -= this.pipeSpeed;
                
                // Remove off-screen pipes
                if (pipe.x + this.pipeWidth < 0) {
                    this.pipes.splice(i, 1);
                    continue;
                }
                
                // Score when bird passes pipe
                if (!pipe.passed && pipe.x + this.pipeWidth < this.birdX) {
                    pipe.passed = true;
                    this.score++;
                    this.platform.updateScore(this.score);
                }
                
                // Collision detection
                if (this.birdX + this.birdSize > pipe.x && 
                    this.birdX < pipe.x + this.pipeWidth) {
                    
                    // Check if bird is in the gap
                    if (this.birdY < pipe.topHeight || 
                        this.birdY + this.birdSize > pipe.bottomY) {
                        this.gameOver();
                        return;
                    }
                }
            }
        }
    }

    draw() {
        // Sky gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98D8E8');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw clouds (simple)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 3; i++) {
            const x = (i * 200 + 100) * this.scaleX;
            const y = (50 + i * 30) * this.scaleY;
            this.drawCloud(x, y);
        }
        
        // Draw pipes
        this.ctx.fillStyle = '#228B22';
        this.pipes.forEach(pipe => {
            // Top pipe
            this.ctx.fillRect(pipe.x, 0, this.pipeWidth, pipe.topHeight);
            // Bottom pipe
            this.ctx.fillRect(pipe.x, pipe.bottomY, this.pipeWidth, this.canvas.height - pipe.bottomY);
            
            // Pipe caps
            this.ctx.fillStyle = '#32CD32';
            this.ctx.fillRect(pipe.x - 5 * this.scaleX, pipe.topHeight - 20 * this.scaleY, 
                            this.pipeWidth + 10 * this.scaleX, 20 * this.scaleY);
            this.ctx.fillRect(pipe.x - 5 * this.scaleX, pipe.bottomY, 
                            this.pipeWidth + 10 * this.scaleX, 20 * this.scaleY);
            this.ctx.fillStyle = '#228B22';
        });
        
        // Draw bird
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(this.birdX, this.birdY, this.birdSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Bird details
        this.ctx.fillStyle = '#FFA500';
        this.ctx.beginPath();
        this.ctx.arc(this.birdX + this.birdSize * 0.3, this.birdY, this.birdSize * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Bird eye
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(this.birdX + this.birdSize * 0.2, this.birdY - this.birdSize * 0.2, 
                   this.birdSize * 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Score
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        const fontSize = Math.max(24, 32 * this.scaleY);
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.strokeText(this.score.toString(), this.canvas.width / 2, 50 * this.scaleY);
        this.ctx.fillText(this.score.toString(), this.canvas.width / 2, 50 * this.scaleY);
        
        // Instructions
        if (!this.gameStarted) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            const titleSize = Math.max(32, 48 * this.scaleY);
            this.ctx.font = `bold ${titleSize}px Arial`;
            this.ctx.fillText('Flappy Bird', this.canvas.width / 2, this.canvas.height / 2 - 50 * this.scaleY);
            
            const instructSize = Math.max(16, 20 * this.scaleY);
            this.ctx.font = `${instructSize}px Arial`;
            this.ctx.fillText('Press SPACEBAR to start and flap', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText('Avoid the pipes!', this.canvas.width / 2, this.canvas.height / 2 + 30 * this.scaleY);
        } else if (!this.running) {
            // Game over screen
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            const gameOverSize = Math.max(32, 48 * this.scaleY);
            this.ctx.font = `bold ${gameOverSize}px Arial`;
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
            
            const scoreSize = Math.max(20, 24 * this.scaleY);
            this.ctx.font = `${scoreSize}px Arial`;
            this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20 * this.scaleY);
        }
    }

    drawCloud(x, y) {
        const size = 20 * Math.min(this.scaleX, this.scaleY);
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.arc(x + size, y, size * 0.8, 0, Math.PI * 2);
        this.ctx.arc(x - size, y, size * 0.8, 0, Math.PI * 2);
        this.ctx.arc(x, y - size * 0.5, size * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
    }

    gameOver() {
        this.running = false;
        setTimeout(() => {
            this.platform.gameOver(this.score);
        }, 2000);
    }

    gameLoop() {
        this.update();
        this.draw();
        
        if (this.running || !this.gameStarted) {
            requestAnimationFrame(this.gameLoop);
        }
    }

    destroy() {
        this.running = false;
    }
}
