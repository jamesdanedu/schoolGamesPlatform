// js/games/streamstop.js - Stream Stop Game Implementation (Fixed Button Mapping)

class StreamStopGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Game configuration
        this.numStreams = 4;
        this.streamWidth = this.canvas.width / this.numStreams;
        this.spriteSize = 25 * Math.min(this.scaleX, this.scaleY);
        this.spriteSpeed = 2 * this.scaleY;
        
        // MUCH lower spawn rate - starts very low and gradually increases
        this.baseSpawnRate = 0.003; // Very low starting spawn rate
        this.maxSpawnRate = 0.008; // Maximum spawn rate (still much lower than before)
        this.spawnRateIncrease = 0.0001; // Gradual increase per second
        this.currentSpawnRate = this.baseSpawnRate;
        
        // Minimum time between spawns in the same stream
        this.minSpawnInterval = 2000; // 2 seconds minimum between sprites in same stream
        this.streamLastSpawn = [0, 0, 0, 0]; // Track last spawn time for each stream
        
        // Target zones (where sprites should be stopped)
        this.targetY = this.canvas.height * 0.8;
        this.targetHeight = 60 * this.scaleY;
        this.targetZoneY = this.targetY - this.targetHeight / 2;
        
        // Stream control keys - simplified to match platform mapping
        this.streamKeys = ['a', 's', 'd', 'f']; // Direct mapping for 4 buttons
        
        // Game state
        this.streams = [];
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.totalHits = 0;
        this.totalMisses = 0;
        this.running = true;
        this.gameStarted = false;
        this.gameTime = 0;
        this.gameDuration = 60000; // 60 seconds in milliseconds
        this.startTime = 0;
        
        // Visual effects
        this.particles = [];
        this.feedbackTexts = [];
        
        // Controls
        this.keys = {};
        this.keyPressed = {};
        this.lastButtonPresses = [0, 0, 0, 0]; // Track last press time for each button to prevent spam
        
        // Initialize streams
        this.initializeStreams();
        
        this.gameLoop = this.gameLoop.bind(this);
        this.gameLoop();
        
        console.log('StreamStop initialized with button mapping: 1→A, 2→S, 3→D, 4→F');
    }
    
    initializeStreams() {
        for (let i = 0; i < this.numStreams; i++) {
            this.streams.push({
                id: i,
                x: i * this.streamWidth + this.streamWidth / 2,
                sprites: [],
                lastStop: 0 // Prevent rapid fire
            });
        }
    }
    
    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        this.keys[key] = true;
        
        if (!this.gameStarted) {
            if (key === ' ' || key === 'spacebar') {
                this.startGame();
                return;
            }
        }
        
        // Find which stream this key corresponds to
        const streamIndex = this.streamKeys.indexOf(key);
        if (streamIndex !== -1) {
            if (!this.keyPressed[key]) {
                console.log(`Key ${key.toUpperCase()} pressed -> Stream ${streamIndex + 1}`);
                this.stopSprite(streamIndex);
                this.keyPressed[key] = true;
            }
        }
    }
    
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        this.keys[key] = false;
        this.keyPressed[key] = false;
    }

    // Add Microbit button support with direct mapping
    handleMicrobitButtonPress(buttonNumber) {
        if (!this.gameStarted) {
            this.startGame();
            return;
        }

        // Direct mapping: Button 1→Stream 0, Button 2→Stream 1, etc.
        const streamIndex = buttonNumber - 1;
        
        if (streamIndex >= 0 && streamIndex < this.numStreams) {
            const currentTime = Date.now();
            
            // Prevent button spam (minimum 100ms between presses)
            if (currentTime - this.lastButtonPresses[streamIndex] < 100) {
                return;
            }
            
            this.lastButtonPresses[streamIndex] = currentTime;
            
            console.log(`🎮 Button ${buttonNumber} pressed -> Stream ${streamIndex + 1}`);
            this.stopSprite(streamIndex);
        }
    }

    handleMicrobitButtonRelease(buttonNumber) {
        // No action needed on release for this game
    }
    
    startGame() {
        this.gameStarted = true;
        this.startTime = Date.now();
        this.score = 0;
        this.combo = 0;
        this.totalHits = 0;
        this.totalMisses = 0;
        this.currentSpawnRate = this.baseSpawnRate;
        
        // Clear all streams
        this.streams.forEach(stream => {
            stream.sprites = [];
        });
        
        // Reset spawn timers
        this.streamLastSpawn = [0, 0, 0, 0];
        this.lastButtonPresses = [0, 0, 0, 0];
        
        // Update platform score
        this.platform.updateScore(this.score);
        
        console.log('StreamStop game started!');
    }
    
    stopSprite(streamIndex) {
        if (!this.gameStarted || !this.running) return;
        
        const stream = this.streams[streamIndex];
        const currentTime = Date.now();
        
        // Prevent rapid fire (minimum 100ms between stops)
        if (currentTime - stream.lastStop < 100) return;
        stream.lastStop = currentTime;
        
        console.log(`Attempting to stop sprite in stream ${streamIndex + 1}`);
        
        // Find the sprite closest to the target zone
        let closestSprite = null;
        let closestDistance = Infinity;
        let closestIndex = -1;
        
        for (let i = 0; i < stream.sprites.length; i++) {
            const sprite = stream.sprites[i];
            const distance = Math.abs(sprite.y - this.targetY);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSprite = sprite;
                closestIndex = i;
            }
        }
        
        if (closestSprite) {
            console.log(`Found sprite at distance ${closestDistance} from target`);
            
            // Remove the sprite
            stream.sprites.splice(closestIndex, 1);
            
            // Calculate score based on accuracy
            const maxDistance = this.targetHeight / 2;
            let points = 0;
            let accuracy = 0;
            
            if (closestDistance <= maxDistance) {
                // Hit! Calculate accuracy
                accuracy = 1 - (closestDistance / maxDistance);
                points = Math.round(accuracy * 100);
                
                // Bonus for perfect hits
                if (accuracy > 0.9) points += 50;
                if (accuracy === 1) points += 100;
                
                // Combo multiplier
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                points *= Math.min(this.combo, 10); // Max 10x multiplier
                
                this.score += points;
                this.totalHits++;
                this.platform.updateScore(this.score);
                
                console.log(`HIT! Points: ${points}, Total score: ${this.score}, Combo: ${this.combo}`);
                
                // Visual feedback
                this.addHitFeedback(stream.x, closestSprite.y, points, accuracy);
                this.addHitParticles(stream.x, closestSprite.y);
                
            } else {
                // Miss - too far from target
                this.combo = 0;
                this.totalMisses++;
                console.log(`MISS! Distance: ${closestDistance}, Max allowed: ${maxDistance}`);
                this.addMissFeedback(stream.x, closestSprite.y);
                this.addMissParticles(stream.x, closestSprite.y);
            }
        } else {
            // No sprite to stop
            this.combo = 0;
            this.totalMisses++;
            console.log(`No sprite found in stream ${streamIndex + 1}`);
        }
    }
    
    addHitFeedback(x, y, points, accuracy) {
        let text = `+${points}`;
        let color = '#00ff00';
        
        if (accuracy > 0.95) {
            text = `PERFECT! +${points}`;
            color = '#ffff00';
        } else if (accuracy > 0.8) {
            text = `GREAT! +${points}`;
            color = '#00ff88';
        }
        
        if (this.combo > 1) {
            text += ` x${Math.min(this.combo, 10)}`;
        }
        
        this.feedbackTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 1.0,
            decay: 0.02,
            vy: -2
        });
    }
    
    addMissFeedback(x, y) {
        this.feedbackTexts.push({
            x: x,
            y: y,
            text: 'MISS',
            color: '#ff0000',
            life: 1.0,
            decay: 0.025,
            vy: -1.5
        });
    }
    
    addHitParticles(x, y) {
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                decay: 0.02,
                color: '#00ff00',
                size: Math.random() * 4 + 2
            });
        }
    }
    
    addMissParticles(x, y) {
        for (let i = 0; i < 6; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1.0,
                decay: 0.03,
                color: '#ff0000',
                size: Math.random() * 3 + 1
            });
        }
    }
    
    update() {
        if (!this.running) return;
        
        if (this.gameStarted) {
            this.gameTime = Date.now() - this.startTime;
            
            // Check if game time is up
            if (this.gameTime >= this.gameDuration) {
                this.gameOver();
                return;
            }
            
            // Gradually increase spawn rate over time
            const timeProgress = this.gameTime / this.gameDuration;
            this.currentSpawnRate = this.baseSpawnRate + (this.maxSpawnRate - this.baseSpawnRate) * timeProgress;
            
            // Spawn new sprites with improved logic
            const currentTime = Date.now();
            this.streams.forEach((stream, index) => {
                // Check if enough time has passed since last spawn in this stream
                const timeSinceLastSpawn = currentTime - this.streamLastSpawn[index];
                
                if (timeSinceLastSpawn >= this.minSpawnInterval && 
                    Math.random() < this.currentSpawnRate && 
                    stream.sprites.length < 2) { // Limit max sprites per stream
                    
                    stream.sprites.push({
                        y: -this.spriteSize,
                        color: this.getRandomSpriteColor(),
                        id: Date.now() + Math.random()
                    });
                    
                    this.streamLastSpawn[index] = currentTime;
                    console.log(`Spawned sprite in stream ${index + 1}`);
                }
            });
            
            // Update sprites
            this.streams.forEach(stream => {
                for (let i = stream.sprites.length - 1; i >= 0; i--) {
                    const sprite = stream.sprites[i];
                    sprite.y += this.spriteSpeed;
                    
                    // Remove sprites that have gone off screen
                    if (sprite.y > this.canvas.height + this.spriteSize) {
                        stream.sprites.splice(i, 1);
                        // Small penalty for letting sprites pass
                        this.combo = Math.max(0, this.combo - 1);
                    }
                }
            });
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update feedback texts
        for (let i = this.feedbackTexts.length - 1; i >= 0; i--) {
            const feedback = this.feedbackTexts[i];
            feedback.y += feedback.vy;
            feedback.life -= feedback.decay;
            
            if (feedback.life <= 0) {
                this.feedbackTexts.splice(i, 1);
            }
        }
    }
    
    getRandomSpriteColor() {
        const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    draw() {
        // Background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#0a0a0a');
        gradient.addColorStop(1, '#1a1a2e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.gameStarted) {
            // Start screen
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(36, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Stream Stop', this.canvas.width / 2, this.canvas.height / 2 - 100 * this.scaleY);
            
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText('Stop falling sprites in the target zone!', this.canvas.width / 2, this.canvas.height / 2 - 50 * this.scaleY);
            
            // Show controls - simplified for button mapping
            this.ctx.font = `${Math.max(14, 18 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#ffff00';
            const keyY = this.canvas.height / 2 - 10 * this.scaleY;
            const spacing = this.streamWidth;
            
            for (let i = 0; i < this.numStreams; i++) {
                const x = (i + 0.5) * spacing;
                this.ctx.fillText(`${this.streamKeys[i].toUpperCase()}`, x, keyY);
            }
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText('🎮 Use Arcade Buttons 1-4 or A/S/D/F keys', this.canvas.width / 2, this.canvas.height / 2 + 30 * this.scaleY);
            this.ctx.fillText('Build combos for score multipliers!', this.canvas.width / 2, this.canvas.height / 2 + 50 * this.scaleY);
            
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = `bold ${Math.max(18, 24 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR or any button to start', this.canvas.width / 2, this.canvas.height / 2 + 90 * this.scaleY);
            
            // Draw sample target zone
            this.drawTargetZones();
            return;
        }
        
        // Draw stream dividers
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        for (let i = 1; i < this.numStreams; i++) {
            const x = i * this.streamWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw target zones
        this.drawTargetZones();
        
        // Draw stream labels with button numbers
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(14, 18 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        for (let i = 0; i < this.numStreams; i++) {
            const x = (i + 0.5) * this.streamWidth;
            this.ctx.fillText(`🎮${i + 1} ${this.streamKeys[i].toUpperCase()}`, x, 25 * this.scaleY);
        }
        
        // Draw sprites
        this.streams.forEach(stream => {
            stream.sprites.forEach(sprite => {
                this.ctx.fillStyle = sprite.color;
                this.ctx.beginPath();
                this.ctx.arc(stream.x, sprite.y, this.spriteSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Sprite outline
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            });
        });
        
        // Draw particles
        this.particles.forEach(particle => {
            const alpha = Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.fillStyle = particle.color + alpha;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw feedback texts
        this.feedbackTexts.forEach(feedback => {
            const alpha = feedback.life;
            this.ctx.fillStyle = feedback.color;
            this.ctx.globalAlpha = alpha;
            this.ctx.font = `bold ${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(feedback.text, feedback.x, feedback.y);
            this.ctx.globalAlpha = 1;
        });
        
        // Draw UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'left';
        
        const margin = 10 * this.scaleX;
        const timeLeft = Math.max(0, this.gameDuration - this.gameTime) / 1000;
        this.ctx.fillText(`Time: ${timeLeft.toFixed(1)}s`, margin, this.canvas.height - 80 * this.scaleY);
        this.ctx.fillText(`Score: ${this.score}`, margin, this.canvas.height - 55 * this.scaleY);
        this.ctx.fillText(`Combo: ${this.combo}`, margin, this.canvas.height - 30 * this.scaleY);
        
        // Difficulty indicator
        const difficultyPercent = ((this.currentSpawnRate - this.baseSpawnRate) / (this.maxSpawnRate - this.baseSpawnRate) * 100).toFixed(0);
        this.ctx.fillText(`Difficulty: ${difficultyPercent}%`, margin, this.canvas.height - 105 * this.scaleY);
        
        // Accuracy stats
        const accuracy = this.totalHits + this.totalMisses > 0 ? 
            (this.totalHits / (this.totalHits + this.totalMisses) * 100).toFixed(1) : 0;
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Accuracy: ${accuracy}%`, this.canvas.width - margin, this.canvas.height - 55 * this.scaleY);
        this.ctx.fillText(`Max Combo: ${this.maxCombo}`, this.canvas.width - margin, this.canvas.height - 30 * this.scaleY);
        
        // Game over screen
        if (!this.running) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(36, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Time Up!', this.canvas.width / 2, this.canvas.height / 2 - 80 * this.scaleY);
            
            this.ctx.font = `${Math.max(24, 30 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
            
            this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(`Hits: ${this.totalHits} | Misses: ${this.totalMisses}`, this.canvas.width / 2, this.canvas.height / 2 + 10 * this.scaleY);
            this.ctx.fillText(`Accuracy: ${accuracy}%`, this.canvas.width / 2, this.canvas.height / 2 + 40 * this.scaleY);
            this.ctx.fillText(`Max Combo: ${this.maxCombo}`, this.canvas.width / 2, this.canvas.height / 2 + 70 * this.scaleY);
        }
    }
    
    drawTargetZones() {
        for (let i = 0; i < this.numStreams; i++) {
            const x = i * this.streamWidth;
            
            // Target zone background
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            this.ctx.fillRect(x, this.targetZoneY, this.streamWidth, this.targetHeight);
            
            // Target zone border
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, this.targetZoneY, this.streamWidth, this.targetHeight);
            
            // Center line
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.targetY);
            this.ctx.lineTo(x + this.streamWidth, this.targetY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }
    
    gameOver() {
        this.running = false;
        setTimeout(() => {
            this.platform.gameOver(this.score);
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
