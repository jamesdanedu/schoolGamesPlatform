// js/games/stop-sprite.js - Stop the Sprite Game Implementation

class StopTheSpriteGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Game properties
        this.sprite = {
            x: 0,
            y: this.canvas.height / 2,
            size: 20 * Math.min(this.scaleX, this.scaleY),
            speed: 2 * this.scaleX,
            direction: 1
        };
        
        // Target zone
        this.targetZone = {
            x: this.canvas.width / 2 - 50 * this.scaleX,
            y: this.canvas.height / 2 - 30 * this.scaleY,
            width: 100 * this.scaleX,
            height: 60 * this.scaleY
        };
        
        // Game state
        this.score = 0;
        this.round = 1;
        this.maxRounds = 10;
        this.running = true;
        this.gameStarted = false;
        this.roundActive = false;
        this.roundStartTime = 0;
        
        // Difficulty progression
        this.baseSpeed = 2 * this.scaleX;
        this.speedMultiplier = 1;
        
        // Controls
        this.spacePressed = false;
        
        // Visual effects
        this.particles = [];
        this.showFeedback = false;
        this.feedbackText = '';
        this.feedbackColor = '#fff';
        this.feedbackTimer = 0;
        
        this.gameLoop = this.gameLoop.bind(this);
        this.gameLoop();
    }

    handleKeyDown(e) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            
            if (!this.spacePressed) {
                if (!this.gameStarted) {
                    this.startGame();
                } else if (this.roundActive) {
                    this.stopSprite();
                } else {
                    this.startRound();
                }
                this.spacePressed = true;
            }
        }
    }

    handleKeyUp(e) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            this.spacePressed = false;
        }
    }

    startGame() {
        this.gameStarted = true;
        this.startRound();
    }

    startRound() {
        if (this.round > this.maxRounds) {
            this.gameOver();
            return;
        }
        
        // Reset sprite position
        this.sprite.x = 0;
        this.sprite.y = this.canvas.height / 2;
        this.sprite.direction = 1;
        
        // Increase difficulty
        this.speedMultiplier = 1 + (this.round - 1) * 0.3;
        this.sprite.speed = this.baseSpeed * this.speedMultiplier;
        
        // Add some randomness to sprite path
        this.sprite.y = this.canvas.height * (0.3 + Math.random() * 0.4);
        
        this.roundActive = true;
        this.roundStartTime = Date.now();
        this.showFeedback = false;
    }

    stopSprite() {
        if (!this.roundActive) return;
        
        this.roundActive = false;
        
        // Check if sprite is in target zone
        const spriteInZone = this.sprite.x >= this.targetZone.x &&
                           this.sprite.x <= this.targetZone.x + this.targetZone.width &&
                           this.sprite.y >= this.targetZone.y &&
                           this.sprite.y <= this.targetZone.y + this.targetZone.height;
        
        if (spriteInZone) {
            // Perfect stop!
            const centerX = this.targetZone.x + this.targetZone.width / 2;
            const centerY = this.targetZone.y + this.targetZone.height / 2;
            const distance = Math.sqrt(
                Math.pow(this.sprite.x - centerX, 2) + 
                Math.pow(this.sprite.y - centerY, 2)
            );
            
            // Score based on accuracy (closer to center = more points)
            const maxDistance = Math.sqrt(
                Math.pow(this.targetZone.width / 2, 2) + 
                Math.pow(this.targetZone.height / 2, 2)
            );
            const accuracy = 1 - (distance / maxDistance);
            const points = Math.floor(accuracy * 100 * this.round);
            
            this.score += points;
            this.platform.updateScore(this.score);
            
            this.feedbackText = `Great! +${points} points`;
            this.feedbackColor = '#00ff00';
            this.addSuccessParticles();
            
        } else {
            // Missed the target
            this.feedbackText = 'Missed the target!';
            this.feedbackColor = '#ff0000';
            this.addMissParticles();
        }
        
        this.showFeedback = true;
        this.feedbackTimer = 120; // frames to show feedback
        
        // Advance to next round after delay
        setTimeout(() => {
            this.round++;
            if (this.round <= this.maxRounds) {
                this.startRound();
            } else {
                this.gameOver();
            }
        }, 2000);
    }

    addSuccessParticles() {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: this.sprite.x,
                y: this.sprite.y,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                life: 1.0,
                decay: 0.02,
                color: '#00ff00',
                size: Math.random() * 4 + 2
            });
        }
    }

    addMissParticles() {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: this.sprite.x,
                y: this.sprite.y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                decay: 0.03,
                color: '#ff0000',
                size: Math.random() * 3 + 1
            });
        }
    }

    update() {
        if (!this.running) return;
        
        if (this.roundActive) {
            // Move sprite
            this.sprite.x += this.sprite.speed * this.sprite.direction;
            
            // Bounce off walls
            if (this.sprite.x <= 0 || this.sprite.x >= this.canvas.width) {
                this.sprite.direction *= -1;
                this.sprite.x = Math.max(0, Math.min(this.canvas.width, this.sprite.x));
            }
            
            // Add slight vertical movement for more challenge
            const timeSinceStart = Date.now() - this.roundStartTime;
            this.sprite.y += Math.sin(timeSinceStart * 0.003) * 0.5 * this.scaleY;
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            particle.vx *= 0.98; // slight friction
            particle.vy *= 0.98;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update feedback timer
        if (this.feedbackTimer > 0) {
            this.feedbackTimer--;
            if (this.feedbackTimer <= 0) {
                this.showFeedback = false;
            }
        }
    }

    draw() {
        // Background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#2c1810');
        gradient.addColorStop(1, '#1a0e08');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.gameStarted) {
            // Start screen
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Stop the Sprite', this.canvas.width / 2, this.canvas.height / 2 - 50 * this.scaleY);
            
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR to stop the moving sprite', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText('in the target zone for points!', this.canvas.width / 2, this.canvas.height / 2 + 25 * this.scaleY);
            this.ctx.fillText('Closer to center = more points', this.canvas.width / 2, this.canvas.height / 2 + 50 * this.scaleY);
            this.ctx.fillText('Press SPACEBAR to start', this.canvas.width / 2, this.canvas.height / 2 + 80 * this.scaleY);
            return;
        }
        
        // Draw target zone
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.strokeRect(this.targetZone.x, this.targetZone.y, this.targetZone.width, this.targetZone.height);
        this.ctx.setLineDash([]);
        
        // Fill target zone with semi-transparent color
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
        this.ctx.fillRect(this.targetZone.x, this.targetZone.y, this.targetZone.width, this.targetZone.height);
        
        // Draw target zone center indicator
        const centerX = this.targetZone.x + this.targetZone.width / 2;
        const centerY = this.targetZone.y + this.targetZone.height / 2;
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw sprite
        if (this.roundActive || this.showFeedback) {
            this.ctx.fillStyle = this.roundActive ? '#00ffff' : '#888888';
            this.ctx.beginPath();
            this.ctx.arc(this.sprite.x, this.sprite.y, this.sprite.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Sprite trail effect when moving
            if (this.roundActive) {
                this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                this.ctx.beginPath();
                this.ctx.arc(this.sprite.x - this.sprite.direction * 10, this.sprite.y, this.sprite.size * 0.7, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.fillStyle = particle.color + Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        this.ctx.fillText(`Round: ${this.round}/${this.maxRounds}`, 20, 55);
        this.ctx.fillText(`Speed: ${this.speedMultiplier.toFixed(1)}x`, 20, 80);
        
        // Instructions
        if (this.roundActive) {
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR to stop the sprite in the target!', this.canvas.width / 2, this.canvas.height - 30);
        } else if (!this.showFeedback && this.round <= this.maxRounds) {
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR for next round', this.canvas.width / 2, this.canvas.height - 30);
        }
        
        // Feedback text
        if (this.showFeedback) {
            this.ctx.fillStyle = this.feedbackColor;
            this.ctx.font = `bold ${Math.max(24, 32 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.feedbackText, this.canvas.width / 2, this.canvas.height / 2 + 100 * this.scaleY);
        }
        
        if (!this.running) {
            // Game over screen
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Game Complete!', this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
            
            this.ctx.font = `${Math.max(20, 24 * this.scaleY)}px Arial`;
            this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20 * this.scaleY);
            
            const averageScore = Math.floor(this.score / this.maxRounds);
            this.ctx.fillText(`Average per Round: ${averageScore}`, this.canvas.width / 2, this.canvas.height / 2 + 50 * this.scaleY);
        }
    }

    gameOver() {
        this.running = false;
        setTimeout(() => {
            this.platform.gameOver(this.score);
        }, 3000);
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
