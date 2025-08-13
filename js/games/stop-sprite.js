// js/games/stop-sprite.js - Stop the Sprite Game Implementation

class StopTheSpriteGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Sprite properties
        this.baseSpeed = 3 * this.scaleX;
        this.maxSpeed = 8 * this.scaleX;
        this.sprite = {
            x: 0,
            y: this.canvas.height / 2,
            size: 15 * Math.min(this.scaleX, this.scaleY),
            speed: this.baseSpeed,
            direction: 1
        };
        
        // Target strip properties
        this.baseStripWidth = 120 * this.scaleX; // Starting width
        this.minStripWidth = 40 * this.scaleX;   // Minimum width
        this.stripHeight = 80 * this.scaleY;
        this.stripX = this.canvas.width / 2 - this.baseStripWidth / 2;
        this.stripY = this.canvas.height / 2 - this.stripHeight / 2;
        this.currentStripWidth = this.baseStripWidth;
        
        // Game state
        this.attempt = 1;
        this.maxAttempts = 5;
        this.scores = []; // Store individual attempt scores
        this.running = true;
        this.gameStarted = false;
        this.spriteMoving = false;
        this.attemptComplete = false;
        
        // Feedback
        this.showFeedback = false;
        this.feedbackText = '';
        this.feedbackColor = '#fff';
        this.feedbackTimer = 0;
        
        // Controls
        this.spacePressed = false;
        
        this.gameLoop = this.gameLoop.bind(this);
        this.gameLoop();
    }

    handleKeyDown(e) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            
            if (!this.spacePressed) {
                if (!this.gameStarted) {
                    this.startGame();
                } else if (this.spriteMoving) {
                    this.stopSprite();
                } else if (this.attemptComplete && this.attempt <= this.maxAttempts) {
                    this.startNextAttempt();
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
        this.startNextAttempt();
    }

    startNextAttempt() {
        if (this.attempt > this.maxAttempts) {
            this.gameOver();
            return;
        }
        
        // Reset sprite to starting position
        this.sprite.x = 0;
        this.sprite.direction = 1;
        
        // Update strip width based on previous performance
        this.updateStripWidth();
        
        // Start sprite movement
        this.spriteMoving = true;
        this.attemptComplete = false;
        this.showFeedback = false;
    }

    updateStripWidth() {
        if (this.scores.length === 0) {
            this.currentStripWidth = this.baseStripWidth;
            this.sprite.speed = this.baseSpeed;
            return;
        }
        
        // Calculate average score so far
        const averageScore = this.scores.reduce((sum, score) => sum + score, 0) / this.scores.length;
        
        // Narrow the strip AND increase speed based on performance
        let widthReduction = 0;
        let speedMultiplier = 1;
        
        if (averageScore >= 90) {
            widthReduction = 0.7; // Very narrow
            speedMultiplier = 2.2; // Much faster
        } else if (averageScore >= 80) {
            widthReduction = 0.5; // Narrow
            speedMultiplier = 1.8; // Faster
        } else if (averageScore >= 70) {
            widthReduction = 0.3; // Slightly narrow
            speedMultiplier = 1.5; // Moderately faster
        } else if (averageScore >= 60) {
            widthReduction = 0.15; // A bit narrow
            speedMultiplier = 1.2; // Slightly faster
        }
        // else no reduction for scores < 60%
        
        this.currentStripWidth = Math.max(
            this.minStripWidth,
            this.baseStripWidth * (1 - widthReduction)
        );
        
        // Update sprite speed
        this.sprite.speed = Math.min(this.maxSpeed, this.baseSpeed * speedMultiplier);
        
        // Center the strip
        this.stripX = this.canvas.width / 2 - this.currentStripWidth / 2;
    }

    stopSprite() {
        if (!this.spriteMoving) return;
        
        this.spriteMoving = false;
        this.attemptComplete = true;
        
        // Calculate score based on accuracy
        const stripCenter = this.stripX + this.currentStripWidth / 2;
        const distanceFromCenter = Math.abs(this.sprite.x - stripCenter);
        const maxDistance = this.currentStripWidth / 2;
        
        let score = 0;
        if (distanceFromCenter <= maxDistance) {
            // Sprite is within the strip
            const accuracy = 1 - (distanceFromCenter / maxDistance);
            score = Math.round(accuracy * 100);
        }
        
        this.scores.push(score);
        
        // Update platform score with current average
        const currentAverage = Math.round(this.scores.reduce((sum, s) => sum + s, 0) / this.scores.length);
        this.platform.updateScore(currentAverage);
        
        // Show feedback
        if (score === 100) {
            this.feedbackText = 'PERFECT! 100%';
            this.feedbackColor = '#00ff00';
        } else if (score >= 90) {
            this.feedbackText = `Excellent! ${score}%`;
            this.feedbackColor = '#00ff00';
        } else if (score >= 70) {
            this.feedbackText = `Good! ${score}%`;
            this.feedbackColor = '#ffff00';
        } else if (score >= 50) {
            this.feedbackText = `OK! ${score}%`;
            this.feedbackColor = '#ff8800';
        } else if (score > 0) {
            this.feedbackText = `Close! ${score}%`;
            this.feedbackColor = '#ff4400';
        } else {
            this.feedbackText = 'Missed! 0%';
            this.feedbackColor = '#ff0000';
        }
        
        this.showFeedback = true;
        this.feedbackTimer = 180; // 3 seconds at 60fps
        
        // Advance to next attempt
        this.attempt++;
        
        // Auto-advance after showing feedback
        if (this.attempt > this.maxAttempts) {
            setTimeout(() => this.gameOver(), 3000);
        }
    }

    update() {
        if (!this.running) return;
        
        // Move sprite continuously
        if (this.spriteMoving) {
            this.sprite.x += this.sprite.speed * this.sprite.direction;
            
            // Bounce off walls
            if (this.sprite.x <= this.sprite.size || this.sprite.x >= this.canvas.width - this.sprite.size) {
                this.sprite.direction *= -1;
                this.sprite.x = Math.max(this.sprite.size, 
                    Math.min(this.canvas.width - this.sprite.size, this.sprite.x));
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
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.gameStarted) {
            // Start screen
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Stop the Sprite', this.canvas.width / 2, this.canvas.height / 2 - 80 * this.scaleY);
            
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText('Stop the moving sprite in the target strip', this.canvas.width / 2, this.canvas.height / 2 - 20 * this.scaleY);
            this.ctx.fillText('100% for perfect center, lower for edges', this.canvas.width / 2, this.canvas.height / 2 + 10 * this.scaleY);
            this.ctx.fillText('5 attempts total - strip narrows & speed increases with good scores', this.canvas.width / 2, this.canvas.height / 2 + 40 * this.scaleY);
            
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = `bold ${Math.max(18, 24 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR to start', this.canvas.width / 2, this.canvas.height / 2 + 80 * this.scaleY);
            
            // Show sample strip
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(this.stripX, this.stripY, this.currentStripWidth, this.stripHeight);
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            this.ctx.fillRect(this.stripX, this.stripY, this.currentStripWidth, this.stripHeight);
            
            return;
        }
        
        // Draw target strip
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.stripX, this.stripY, this.currentStripWidth, this.stripHeight);
        
        // Fill strip with semi-transparent color
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
        this.ctx.fillRect(this.stripX, this.stripY, this.currentStripWidth, this.stripHeight);
        
        // Draw center line
        const centerX = this.stripX + this.currentStripWidth / 2;
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, this.stripY);
        this.ctx.lineTo(centerX, this.stripY + this.stripHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw sprite
        if (this.spriteMoving || this.attemptComplete) {
            // Sprite color changes when stopped
            this.ctx.fillStyle = this.spriteMoving ? '#00ffff' : '#ff00ff';
            this.ctx.beginPath();
            this.ctx.arc(this.sprite.x, this.sprite.y, this.sprite.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Sprite outline
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Movement trail when moving
            if (this.spriteMoving) {
                for (let i = 1; i <= 3; i++) {
                    const trailX = this.sprite.x - (this.sprite.direction * i * 8);
                    const alpha = (4 - i) / 4;
                    this.ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.5})`;
                    this.ctx.beginPath();
                    this.ctx.arc(trailX, this.sprite.y, this.sprite.size * (1 - i * 0.1), 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
        
        // Draw UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'left';
        
        const margin = 20 * this.scaleX;
        this.ctx.fillText(`Attempt: ${Math.min(this.attempt, this.maxAttempts)}/${this.maxAttempts}`, margin, 30 * this.scaleY);
        
        // Show individual scores
        if (this.scores.length > 0) {
            this.ctx.fillText(`Scores: ${this.scores.join(', ')}`, margin, 55 * this.scaleY);
            const average = Math.round(this.scores.reduce((sum, s) => sum + s, 0) / this.scores.length);
            this.ctx.fillText(`Average: ${average}%`, margin, 80 * this.scaleY);
        }
        
        // Strip width indicator
        const stripWidthPercent = Math.round((this.currentStripWidth / this.baseStripWidth) * 100);
        const speedMultiplier = (this.sprite.speed / this.baseSpeed).toFixed(1);
        this.ctx.fillText(`Strip Width: ${stripWidthPercent}%`, margin, 105 * this.scaleY);
        this.ctx.fillText(`Speed: ${speedMultiplier}x`, margin, 130 * this.scaleY);
        
        // Instructions
        this.ctx.textAlign = 'center';
        if (this.spriteMoving) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = `bold ${Math.max(20, 26 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR to STOP!', this.canvas.width / 2, this.canvas.height - 40 * this.scaleY);
        } else if (this.attemptComplete && this.attempt <= this.maxAttempts) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR for next attempt', this.canvas.width / 2, this.canvas.height - 40 * this.scaleY);
        }
        
        // Feedback text
        if (this.showFeedback) {
            this.ctx.fillStyle = this.feedbackColor;
            this.ctx.font = `bold ${Math.max(32, 42 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            
            // Add text shadow for better visibility
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(this.feedbackText, this.canvas.width / 2, this.canvas.height / 2 + 150 * this.scaleY);
            this.ctx.fillText(this.feedbackText, this.canvas.width / 2, this.canvas.height / 2 + 150 * this.scaleY);
        }
        
        // Game over screen
        if (!this.running) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(36, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Game Complete!', this.canvas.width / 2, this.canvas.height / 2 - 80 * this.scaleY);
            
            this.ctx.font = `${Math.max(20, 26 * this.scaleY)}px Arial`;
            this.ctx.fillText(`Individual Scores: ${this.scores.join(', ')}`, this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
            
            const finalAverage = Math.round(this.scores.reduce((sum, s) => sum + s, 0) / this.scores.length);
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = `bold ${Math.max(24, 32 * this.scaleY)}px Arial`;
            this.ctx.fillText(`Final Average: ${finalAverage}%`, this.canvas.width / 2, this.canvas.height / 2 + 10 * this.scaleY);
            
            // Performance message
            let message = '';
            if (finalAverage >= 90) message = 'Outstanding precision!';
            else if (finalAverage >= 80) message = 'Excellent accuracy!';
            else if (finalAverage >= 70) message = 'Good job!';
            else if (finalAverage >= 60) message = 'Not bad!';
            else message = 'Keep practicing!';
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
            this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2 + 50 * this.scaleY);
        }
    }

    gameOver() {
        this.running = false;
        const finalAverage = Math.round(this.scores.reduce((sum, s) => sum + s, 0) / this.scores.length);
        setTimeout(() => {
            this.platform.gameOver(finalAverage);
        }, 4000);
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