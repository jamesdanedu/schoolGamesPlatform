// js/games/flappybird.js - Flappy Bird Game Implementation with Progressive Difficulty

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
        
        // Progressive difficulty system
        this.basePipeSpeed = 1.5 * this.scaleX; // Slower starting speed
        this.speedIncrement = 0.3; // Speed multiplier increase per level
        this.pipesPerLevel = 5; // Pipes needed to increase difficulty
        this.currentLevel = 0;
        this.pipesCleared = 0;
        
        // Progressive gap system
        this.basePipeGap = 220 * this.scaleY; // Much larger starting gap
        this.minPipeGap = 140 * this.scaleY; // Minimum gap at higher levels
        this.gapReductionPerLevel = 8 * this.scaleY; // Gap reduction per level
        
        // Pipe properties
        this.pipeWidth = 60 * this.scaleX;
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

    // Calculate current pipe gap based on level
    getCurrentPipeGap() {
        const gapReduction = this.currentLevel * this.gapReductionPerLevel;
        return Math.max(this.minPipeGap, this.basePipeGap - gapReduction);
    }

    // Calculate current pipe speed based on level
    getCurrentPipeSpeed() {
        return this.basePipeSpeed * (1 + this.currentLevel * this.speedIncrement);
    }

    // Calculate current speed multiplier for display
    getCurrentSpeedMultiplier() {
        return (1 + this.currentLevel * this.speedIncrement).toFixed(1);
    }

    // Get pipes remaining until next speed increase
    getPipesUntilNextLevel() {
        return this.pipesPerLevel - (this.pipesCleared % this.pipesPerLevel);
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
        const currentGap = this.getCurrentPipeGap();
        const minHeight = 50 * this.scaleY;
        const maxHeight = this.canvas.height - currentGap - minHeight;
        const topHeight = minHeight + Math.random() * (maxHeight - minHeight);
        
        this.pipes.push({
            x: this.canvas.width,
            topHeight: topHeight,
            bottomY: topHeight + currentGap,
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
            
            // Get current speed
            const currentSpeed = this.getCurrentPipeSpeed();
            
            // Update pipes
            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const pipe = this.pipes[i];
                pipe.x -= currentSpeed;
                
                // Remove off-screen pipes
                if (pipe.x + this.pipeWidth < 0) {
                    this.pipes.splice(i, 1);
                    continue;
                }
                
                // Score when bird passes pipe
                if (!pipe.passed && pipe.x + this.pipeWidth < this.birdX) {
                    pipe.passed = true;
                    this.score++;
                    this.pipesCleared++;
                    
                    // Check for level up
                    const newLevel = Math.floor(this.pipesCleared / this.pipesPerLevel);
                    if (newLevel > this.currentLevel) {
                        this.currentLevel = newLevel;
                        // Optional: Could add visual/audio feedback here
                    }
                    
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
        
        // Score and game info
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        const fontSize = Math.max(24, 32 * this.scaleY);
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.strokeText(this.score.toString(), this.canvas.width / 2, 50 * this.scaleY);
        this.ctx.fillText(this.score.toString(), this.canvas.width / 2, 50 * this.scaleY);
        
        // Progressive difficulty info (top-left corner)
        if (this.gameStarted && this.running) {
            this.ctx.textAlign = 'left';
            const infoSize = Math.max(14, 16 * this.scaleY);
            this.ctx.font = `${infoSize}px Arial`;
            
            const leftMargin = 10 * this.scaleX;
            const topMargin = 25 * this.scaleY;
            const lineHeight = 20 * this.scaleY;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(5 * this.scaleX, 5 * this.scaleY, 180 * this.scaleX, 85 * this.scaleY);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(`Speed: ${this.getCurrentSpeedMultiplier()}x`, leftMargin, topMargin);
            this.ctx.fillText(`Level: ${this.currentLevel + 1}`, leftMargin, topMargin + lineHeight);
            this.ctx.fillText(`Gap: ${Math.round(this.getCurrentPipeGap() / this.scaleY)}px`, leftMargin, topMargin + lineHeight * 2);
            this.ctx.fillText(`Next: ${this.getPipesUntilNextLevel()} pipes`, leftMargin, topMargin + lineHeight * 3);
        }
        
        // Instructions
        if (!this.gameStarted) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            const titleSize = Math.max(32, 48 * this.scaleY);
            this.ctx.font = `bold ${titleSize}px Arial`;
            this.ctx.fillText('Flappy Bird', this.canvas.width / 2, this.canvas.height / 2 - 80 * this.scaleY);
            
            const instructSize = Math.max(16, 20 * this.scaleY);
            this.ctx.font = `${instructSize}px Arial`;
            this.ctx.fillText('Press SPACEBAR to start and flap', this.canvas.width / 2, this.canvas.height / 2 - 20 * this.scaleY);
            this.ctx.fillText('Avoid the pipes!', this.canvas.width / 2, this.canvas.height / 2 + 10 * this.scaleY);
            
            // Progressive difficulty explanation
            const smallSize = Math.max(14, 16 * this.scaleY);
            this.ctx.font = `${smallSize}px Arial`;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillText('Game starts with large gaps that shrink as you progress', this.canvas.width / 2, this.canvas.height / 2 + 50 * this.scaleY);
            
        } else if (!this.running) {
            // Game over screen
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            const gameOverSize = Math.max(32, 48 * this.scaleY);
            this.ctx.font = `bold ${gameOverSize}px Arial`;
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 60 * this.scaleY);
            
            const scoreSize = Math.max(20, 24 * this.scaleY);
            this.ctx.font = `${scoreSize}px Arial`;
            this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 - 20 * this.scaleY);
            this.ctx.fillText(`Reached Level: ${this.currentLevel + 1}`, this.canvas.width / 2, this.canvas.height / 2 + 10 * this.scaleY);
            this.ctx.fillText(`Top Speed: ${this.getCurrentSpeedMultiplier()}x`, this.canvas.width / 2, this.canvas.height / 2 + 40 * this.scaleY);
            
            const encourageSize = Math.max(16, 18 * this.scaleY);
            this.ctx.font = `${encourageSize}px Arial`;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillText('Great progress! Try again to go faster!', this.canvas.width / 2, this.canvas.height / 2 + 80 * this.scaleY);
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
        }, 3000); // Slightly longer to read the detailed stats
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