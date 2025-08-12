// js/games/rhythm-timer.js - Rhythm Timer Game Implementation

class RhythmTimerGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Game properties
        this.bpm = 120; // beats per minute
        this.beatInterval = (60 / this.bpm) * 1000; // milliseconds
        this.tolerance = 100; // timing tolerance in ms
        
        // Game state
        this.score = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.running = true;
        this.gameStarted = false;
        
        // Timing
        this.lastBeatTime = 0;
        this.nextBeatTime = 0;
        this.currentTime = 0;
        
        // Visual elements
        this.beatCircles = [];
        this.particles = [];
        
        // Audio context for beat sounds (optional)
        this.audioContext = null;
        this.initAudio();
        
        // Controls
        this.spacePressed = false;
        
        this.gameLoop = this.gameLoop.bind(this);
        this.startTime = Date.now();
        this.gameLoop();
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    playBeatSound() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    playHitSound(accuracy) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Higher pitch for more accurate hits
        oscillator.frequency.value = 400 + (accuracy * 400);
        oscillator.type = 'triangle';
        
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    handleKeyDown(e) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            
            if (!this.spacePressed) {
                if (!this.gameStarted) {
                    this.gameStarted = true;
                    this.lastBeatTime = Date.now();
                    this.nextBeatTime = this.lastBeatTime + this.beatInterval;
                } else {
                    this.onPlayerHit();
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

    onPlayerHit() {
        if (!this.running) return;
        
        const currentTime = Date.now();
        const timeDiff = Math.abs(currentTime - this.nextBeatTime);
        
        if (timeDiff <= this.tolerance) {
            // Hit within tolerance
            const accuracy = 1 - (timeDiff / this.tolerance);
            const points = Math.floor(accuracy * 100);
            
            this.score += points;
            this.streak++;
            this.maxStreak = Math.max(this.maxStreak, this.streak);
            
            this.platform.updateScore(this.score);
            this.playHitSound(accuracy);
            this.addParticles(accuracy);
            
        } else {
            // Missed the beat
            this.streak = 0;
            this.addMissParticles();
        }
    }

    addParticles(accuracy) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                decay: 0.02,
                color: accuracy > 0.8 ? '#00ff00' : accuracy > 0.5 ? '#ffff00' : '#ff8800'
            });
        }
    }

    addMissParticles() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                decay: 0.03,
                color: '#ff0000'
            });
        }
    }

    update() {
        if (!this.running || !this.gameStarted) return;
        
        this.currentTime = Date.now();
        
        // Check if it's time for the next beat
        if (this.currentTime >= this.nextBeatTime) {
            this.playBeatSound();
            
            // Add visual beat indicator
            this.beatCircles.push({
                radius: 0,
                maxRadius: 100 * Math.min(this.scaleX, this.scaleY),
                life: 1.0,
                decay: 0.02
            });
            
            this.nextBeatTime += this.beatInterval;
        }
        
        // Update beat circles
        for (let i = this.beatCircles.length - 1; i >= 0; i--) {
            const circle = this.beatCircles[i];
            circle.radius += (circle.maxRadius - circle.radius) * 0.1;
            circle.life -= circle.decay;
            
            if (circle.life <= 0) {
                this.beatCircles.splice(i, 1);
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // End game after 30 seconds
        if (this.currentTime - this.startTime > 30000) {
            this.gameOver();
        }
    }

    draw() {
        // Dark background with subtle gradient
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, 0,
            this.canvas.width/2, this.canvas.height/2, this.canvas.width/2
        );
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f23');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.gameStarted) {
            // Start screen
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Rhythm Timer', this.canvas.width / 2, this.canvas.height / 2 - 50 * this.scaleY);
            
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR on the beat!', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText('Listen for the sound and watch the circle', this.canvas.width / 2, this.canvas.height / 2 + 30 * this.scaleY);
            this.ctx.fillText('Press SPACEBAR to start', this.canvas.width / 2, this.canvas.height / 2 + 60 * this.scaleY);
            return;
        }
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Draw beat circles
        this.beatCircles.forEach(circle => {
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${circle.life})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, circle.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        // Draw central target circle
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 50 * Math.min(this.scaleX, this.scaleY), 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw timing indicator
        const timeToBeat = this.nextBeatTime - Date.now();
        const beatProgress = 1 - (timeToBeat / this.beatInterval);
        
        if (beatProgress > 0 && beatProgress < 1) {
            const indicatorRadius = 30 * Math.min(this.scaleX, this.scaleY);
            this.ctx.fillStyle = timeToBeat < this.tolerance ? '#00ff00' : '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, indicatorRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.fillStyle = particle.color + Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        this.ctx.fillText(`Streak: ${this.streak}`, 20, 55);
        this.ctx.fillText(`Best Streak: ${this.maxStreak}`, 20, 80);
        
        // Time remaining
        const timeLeft = Math.max(0, 30 - (Date.now() - this.startTime) / 1000);
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Time: ${timeLeft.toFixed(1)}s`, this.canvas.width - 20, 30);
        
        if (!this.running) {
            // Game over screen
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TIME UP!', this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
            
            this.ctx.font = `${Math.max(20, 24 * this.scaleY)}px Arial`;
            this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20 * this.scaleY);
            this.ctx.fillText(`Best Streak: ${this.maxStreak}`, this.canvas.width / 2, this.canvas.height / 2 + 50 * this.scaleY);
        }
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
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
