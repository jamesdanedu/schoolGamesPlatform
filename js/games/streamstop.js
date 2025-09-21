// js/games/streamstop.js - Stream Stop Game Implementation (Fixed Button Mapping)

class StreamStopGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Game mode selection
        this.gameMode = null; // Will be set when player selects mode
        this.modeSelected = false;
        this.availableModes = [
            { players: 1, name: "1-Player Mode", description: "Slow speed, control all 4 streams!", color: "#4CAF50" },
            { players: 2, name: "2-Player Mode", description: "Medium speed, 2 streams each", color: "#FF9800" }, 
            { players: 4, name: "4-Player Mode", description: "Fast speed, 1 stream each", color: "#F44336" }
        ];
        this.selectedModeIndex = 0;
        
        // Game configuration (will be set based on mode)
        this.numStreams = 4; // Always 4 streams, but different speeds
        this.streamWidth = this.canvas.width / this.numStreams;
        this.spriteSize = 25 * Math.min(this.scaleX, this.scaleY);
        
        // Speed and spawn rate configurations per mode
        this.modeConfigs = {
            1: {
                baseSpriteSpeed: 1.0 * this.scaleY,   // Slow base speed
                maxSpriteSpeed: 2.5 * this.scaleY,    // Slower max speed
                baseSpawnRate: 0.002,                  // Lower spawn rate
                maxSpawnRate: 0.005,                   // Lower max spawn rate
                speedIncreaseRate: 0.0008,             // Gradual speed increase
                activeStreams: [0, 1, 2, 3],           // Use ALL 4 streams - 1 player multitasks
                playerAssignments: {
                    1: [0, 1, 2, 3]                    // Player 1 controls all streams
                }
            },
            2: {
                baseSpriteSpeed: 1.5 * this.scaleY,   // Medium base speed
                maxSpriteSpeed: 3.5 * this.scaleY,    // Medium max speed  
                baseSpawnRate: 0.004,                  // Medium spawn rate
                maxSpawnRate: 0.008,                   // Medium max spawn rate
                speedIncreaseRate: 0.001,              // Medium speed increase
                activeStreams: [0, 1, 2, 3],           // Use all 4 streams
                playerAssignments: {
                    1: [0, 1],                         // Player 1 controls streams 1 & 2 (buttons 1 & 2)
                    2: [2, 3]                          // Player 2 controls streams 3 & 4 (buttons 3 & 4)
                }
            },
            4: {
                baseSpriteSpeed: 2.0 * this.scaleY,   // Fast base speed
                maxSpriteSpeed: 5.0 * this.scaleY,    // Very fast max speed
                baseSpawnRate: 0.006,                  // High spawn rate
                maxSpawnRate: 0.015,                   // High max spawn rate  
                speedIncreaseRate: 0.0015,             // Rapid speed increase
                activeStreams: [0, 1, 2, 3],           // Use all 4 streams
                playerAssignments: {
                    1: [0],                            // Player 1 controls stream 1 (button 1)
                    2: [1],                            // Player 2 controls stream 2 (button 2)  
                    3: [2],                            // Player 3 controls stream 3 (button 3)
                    4: [3]                             // Player 4 controls stream 4 (button 4)
                }
            }
        };
        
        // Current game settings (will be set when mode is selected)
        this.spriteSpeed = 2 * this.scaleY;
        this.currentSpawnRate = 0.003;
        
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
        
        console.log('StreamStop initialized - select game mode to begin');
    }

    selectGameMode(modeIndex) {
        if (modeIndex >= 0 && modeIndex < this.availableModes.length) {
            this.gameMode = this.availableModes[modeIndex];
            this.modeSelected = true;
            
            // Apply mode configuration
            const config = this.modeConfigs[this.gameMode.players];
            this.baseSpriteSpeed = config.baseSpriteSpeed;
            this.maxSpriteSpeed = config.maxSpriteSpeed;
            this.baseSpawnRate = config.baseSpawnRate;
            this.maxSpawnRate = config.maxSpawnRate;
            this.speedIncreaseRate = config.speedIncreaseRate;
            this.activeStreams = config.activeStreams;
            this.playerAssignments = config.playerAssignments;
            
            // Set initial values
            this.spriteSpeed = this.baseSpriteSpeed;
            this.currentSpawnRate = this.baseSpawnRate;
            
            console.log(`Selected ${this.gameMode.name}`);
            console.log(`Active streams: ${this.activeStreams.map(i => i + 1).join(', ')}`);
            console.log(`Player assignments:`, this.playerAssignments);
            console.log(`Speed range: ${this.baseSpriteSpeed.toFixed(1)} - ${this.maxSpriteSpeed.toFixed(1)}`);
        }
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
        
        // Mode selection screen
        if (!this.modeSelected) {
            if (key === 'arrowup' || key === 'w') {
                this.selectedModeIndex = Math.max(0, this.selectedModeIndex - 1);
                return;
            }
            if (key === 'arrowdown' || key === 's') {
                this.selectedModeIndex = Math.min(this.availableModes.length - 1, this.selectedModeIndex + 1);
                return;
            }
            if (key === ' ' || key === 'spacebar' || key === 'enter') {
                this.selectGameMode(this.selectedModeIndex);
                return;
            }
            // Number keys for quick selection
            if (key >= '1' && key <= '4') {
                const modeIndex = parseInt(key) - 1;
                if (modeIndex < this.availableModes.length) {
                    this.selectedModeIndex = modeIndex;
                    this.selectGameMode(modeIndex);
                }
                return;
            }
        }
        
        // Game start screen
        if (!this.gameStarted && this.modeSelected) {
            if (key === ' ' || key === 'spacebar') {
                this.startGame();
                return;
            }
            // Allow going back to mode selection
            if (key === 'escape' || key === 'backspace') {
                this.modeSelected = false;
                this.gameMode = null;
                return;
            }
        }
        
        // In-game controls - check if button is assigned to any player
        if (this.gameStarted && this.running) {
            const streamIndex = this.streamKeys.indexOf(key);
            if (streamIndex !== -1 && this.isStreamControlledByAnyPlayer(streamIndex)) {
                if (!this.keyPressed[key]) {
                    console.log(`Key ${key.toUpperCase()} pressed -> Stream ${streamIndex + 1}`);
                    this.stopSprite(streamIndex);
                    this.keyPressed[key] = true;
                }
            }
        }
    }
    
    // Helper function to check if a stream is controlled by any player in current mode
    isStreamControlledByAnyPlayer(streamIndex) {
        if (!this.playerAssignments) return true; // Fallback for old modes
        
        for (const playerStreams of Object.values(this.playerAssignments)) {
            if (playerStreams.includes(streamIndex)) {
                return true;
            }
        }
        return false;
    }
    
    // Helper function to get which player number controls a specific stream
    getPlayerForStream(streamIndex) {
        if (!this.playerAssignments) return 1; // Fallback
        
        for (const [playerNum, streams] of Object.entries(this.playerAssignments)) {
            if (streams.includes(streamIndex)) {
                return parseInt(playerNum);
            }
        }
        return 1; // Fallback
    }
    
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        this.keys[key] = false;
        this.keyPressed[key] = false;
    }

    // Add Microbit button support with direct mapping
    handleMicrobitButtonPress(buttonNumber) {
        // Mode selection with buttons
        if (!this.modeSelected) {
            if (buttonNumber >= 1 && buttonNumber <= this.availableModes.length) {
                this.selectedModeIndex = buttonNumber - 1;
                this.selectGameMode(this.selectedModeIndex);
            }
            return;
        }
        
        // Game start
        if (!this.gameStarted && this.modeSelected) {
            this.startGame();
            return;
        }

        // In-game controls - check if button controls a stream in current mode
        if (this.gameStarted && this.running) {
            const streamIndex = buttonNumber - 1;
            
            if (streamIndex >= 0 && streamIndex < this.numStreams && this.isStreamControlledByAnyPlayer(streamIndex)) {
                const currentTime = Date.now();
                
                // Prevent button spam (minimum 100ms between presses)
                if (currentTime - this.lastButtonPresses[streamIndex] < 100) {
                    return;
                }
                
                this.lastButtonPresses[streamIndex] = currentTime;
                
                const playerNum = this.getPlayerForStream(streamIndex);
                console.log(`🎮 Button ${buttonNumber} (Player ${playerNum}) pressed -> Stream ${streamIndex + 1}`);
                this.stopSprite(streamIndex);
            }
        }
    }

    handleMicrobitButtonRelease(buttonNumber) {
        // No action needed on release for this game
    }
    
    startGame() {
        if (!this.modeSelected) return;
        
        this.gameStarted = true;
        this.startTime = Date.now();
        this.score = 0;
        this.combo = 0;
        this.totalHits = 0;
        this.totalMisses = 0;
        
        // Reset speed and spawn rate to base values for selected mode
        this.spriteSpeed = this.baseSpriteSpeed;
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
        
        console.log(`${this.gameMode.name} started! Active streams: ${this.activeStreams.map(i => i + 1).join(', ')}`);
    }
    
    stopSprite(streamIndex) {
        if (!this.gameStarted || !this.running) return;
        
        // Check if this stream is controlled by any player in current mode
        if (!this.isStreamControlledByAnyPlayer(streamIndex)) {
            console.log(`Stream ${streamIndex + 1} is not controlled by any player in ${this.gameMode.name}`);
            return;
        }
        
        const stream = this.streams[streamIndex];
        const currentTime = Date.now();
        
        // Prevent rapid fire (minimum 100ms between stops)
        if (currentTime - stream.lastStop < 100) return;
        stream.lastStop = currentTime;
        
        const playerNum = this.getPlayerForStream(streamIndex);
        console.log(`Player ${playerNum} attempting to stop sprite in stream ${streamIndex + 1}`);
        
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
                
                // Mode-based score multipliers
                let modeMultiplier = 1;
                switch(this.gameMode.players) {
                    case 1: modeMultiplier = 1.0; break;   // 1-player: base scoring
                    case 2: modeMultiplier = 1.5; break;   // 2-player: 50% bonus
                    case 4: modeMultiplier = 2.0; break;   // 4-player: 100% bonus
                }
                
                // Combo multiplier
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                const comboMultiplier = Math.min(this.combo, 10); // Max 10x multiplier
                
                points = Math.round(points * modeMultiplier * comboMultiplier);
                
                this.score += points;
                this.totalHits++;
                this.platform.updateScore(this.score);
                
                console.log(`HIT! Points: ${points} (${modeMultiplier}x mode, ${comboMultiplier}x combo), Total: ${this.score}`);
                
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
            
            // Gradually increase speed and spawn rate over time
            const timeProgress = this.gameTime / this.gameDuration;
            
            // Increase sprite speed over time
            this.spriteSpeed = this.baseSpriteSpeed + (this.maxSpriteSpeed - this.baseSpriteSpeed) * timeProgress;
            
            // Increase spawn rate over time
            this.currentSpawnRate = this.baseSpawnRate + (this.maxSpawnRate - this.baseSpawnRate) * timeProgress;
            
            // Spawn new sprites - only in active streams
            const currentTime = Date.now();
            this.activeStreams.forEach(streamIndex => {
                const stream = this.streams[streamIndex];
                
                // Check if enough time has passed since last spawn in this stream
                const timeSinceLastSpawn = currentTime - this.streamLastSpawn[streamIndex];
                
                if (timeSinceLastSpawn >= this.minSpawnInterval && 
                    Math.random() < this.currentSpawnRate && 
                    stream.sprites.length < 2) { // Limit max sprites per stream
                    
                    stream.sprites.push({
                        y: -this.spriteSize,
                        color: this.getRandomSpriteColor(),
                        id: Date.now() + Math.random(),
                        speed: this.spriteSpeed + (Math.random() - 0.5) * this.spriteSpeed * 0.2 // ±20% speed variation
                    });
                    
                    this.streamLastSpawn[streamIndex] = currentTime;
                    console.log(`Spawned sprite in stream ${streamIndex + 1} at speed ${this.spriteSpeed.toFixed(1)}`);
                }
            });
            
            // Update sprites in all streams
            this.streams.forEach((stream, streamIndex) => {
                for (let i = stream.sprites.length - 1; i >= 0; i--) {
                    const sprite = stream.sprites[i];
                    // Use individual sprite speed if available, otherwise use global speed
                    sprite.y += sprite.speed || this.spriteSpeed;
                    
                    // Remove sprites that have gone off screen
                    if (sprite.y > this.canvas.height + this.spriteSize) {
                        stream.sprites.splice(i, 1);
                        // Small penalty for letting sprites pass (only in active streams)
                        if (this.activeStreams.includes(streamIndex)) {
                            this.combo = Math.max(0, this.combo - 1);
                        }
                    }
                }
            });
        }
        
        // Update particles and feedback (existing code)
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
        
        // Mode selection screen
        if (!this.modeSelected) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(36, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Stream Stop', this.canvas.width / 2, this.canvas.height / 2 - 120 * this.scaleY);
            
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText('Select Game Mode:', this.canvas.width / 2, this.canvas.height / 2 - 60 * this.scaleY);
            
            // Draw mode options
            this.availableModes.forEach((mode, index) => {
                const y = this.canvas.height / 2 + (index - 1) * 50 * this.scaleY;
                const isSelected = index === this.selectedModeIndex;
                
                // Background for selected mode
                if (isSelected) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    this.ctx.fillRect(this.canvas.width / 2 - 200 * this.scaleX, y - 20 * this.scaleY, 
                                    400 * this.scaleX, 40 * this.scaleY);
                }
                
                // Mode text
                this.ctx.fillStyle = isSelected ? mode.color : '#fff';
                this.ctx.font = `bold ${Math.max(20, 24 * this.scaleY)}px Arial`;
                this.ctx.fillText(`${index + 1}. ${mode.name}`, this.canvas.width / 2, y);
                
                this.ctx.fillStyle = isSelected ? '#ffff00' : '#ccc';
                this.ctx.font = `${Math.max(14, 16 * this.scaleY)}px Arial`;
                this.ctx.fillText(mode.description, this.canvas.width / 2, y + 20 * this.scaleY);
            });
            
            // Instructions
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = `${Math.max(16, 18 * this.scaleY)}px Arial`;
            this.ctx.fillText('🎮 Press button 1-3 or ↑/↓ + Enter/Spacebar', this.canvas.width / 2, this.canvas.height / 2 + 120 * this.scaleY);
            
            return;
        }
        
        // Game start screen
        if (!this.gameStarted) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(32, 42 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.gameMode.name, this.canvas.width / 2, this.canvas.height / 2 - 100 * this.scaleY);
            
            this.ctx.fillStyle = this.gameMode.color;
            this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
            this.ctx.fillText(this.gameMode.description, this.canvas.width / 2, this.canvas.height / 2 - 60 * this.scaleY);
            
            // Show active streams and player assignments
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            
            if (this.gameMode.players === 1) {
                this.ctx.fillText('You control ALL 4 streams - multitask!', this.canvas.width / 2, this.canvas.height / 2 - 20 * this.scaleY);
                this.ctx.fillText('🎮 Buttons: 1️⃣ 2️⃣ 3️⃣ 4️⃣', this.canvas.width / 2, this.canvas.height / 2);
            } else if (this.gameMode.players === 2) {
                this.ctx.fillText('Player 1: Streams 1 & 2 (🎮 1️⃣ 2️⃣)', this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
                this.ctx.fillText('Player 2: Streams 3 & 4 (🎮 3️⃣ 4️⃣)', this.canvas.width / 2, this.canvas.height / 2 - 10 * this.scaleY);
            } else if (this.gameMode.players === 4) {
                this.ctx.fillText('Each player controls 1 stream', this.canvas.width / 2, this.canvas.height / 2 - 20 * this.scaleY);
                this.ctx.fillText('P1:🎮1️⃣ P2:🎮2️⃣ P3:🎮3️⃣ P4:🎮4️⃣', this.canvas.width / 2, this.canvas.height / 2);
            }
            
            // Speed info
            this.ctx.fillText(`Speed: ${this.baseSpriteSpeed.toFixed(1)} → ${this.maxSpriteSpeed.toFixed(1)}`, 
                             this.canvas.width / 2, this.canvas.height / 2 + 10 * this.scaleY);
            
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = `bold ${Math.max(18, 24 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press SPACEBAR or any button to start', this.canvas.width / 2, this.canvas.height / 2 + 60 * this.scaleY);
            
            this.ctx.fillStyle = '#ccc';
            this.ctx.font = `${Math.max(12, 14 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press ESC to change mode', this.canvas.width / 2, this.canvas.height / 2 + 90 * this.scaleY);
            
            // Draw target zones for active streams only
            this.drawTargetZones();
            return;
        }
        
        // In-game drawing
        this.drawGameplay();
    }
    
    drawGameplay() {
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
        
        // Draw stream labels - highlight based on player assignments
        this.ctx.font = `${Math.max(14, 18 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        for (let i = 0; i < this.numStreams; i++) {
            const x = (i + 0.5) * this.streamWidth;
            const playerNum = this.getPlayerForStream(i);
            
            // Color code by player
            const playerColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0']; // Green, Blue, Orange, Purple
            this.ctx.fillStyle = playerColors[playerNum - 1] || '#fff';
            
            let text;
            if (this.gameMode.players === 1) {
                text = `🎮${i + 1} ${this.streamKeys[i].toUpperCase()}`;
            } else {
                text = `P${playerNum} 🎮${i + 1} ${this.streamKeys[i].toUpperCase()}`;
            }
            
            this.ctx.fillText(text, x, 25 * this.scaleY);
        }
        
        // Draw sprites in all active streams
        this.streams.forEach((stream, streamIndex) => {
            if (this.activeStreams.includes(streamIndex)) {
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
            }
        });
        
        // Draw particles and feedback (existing code)
        this.particles.forEach(particle => {
            const alpha = Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.fillStyle = particle.color + alpha;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
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
        this.ctx.fillText(`Time: ${timeLeft.toFixed(1)}s`, margin, this.canvas.height - 105 * this.scaleY);
        this.ctx.fillText(`Score: ${this.score}`, margin, this.canvas.height - 80 * this.scaleY);
        this.ctx.fillText(`Combo: ${this.combo}`, margin, this.canvas.height - 55 * this.scaleY);
        this.ctx.fillText(`Speed: ${this.spriteSpeed.toFixed(1)}`, margin, this.canvas.height - 30 * this.scaleY);
        
        // Mode info
        this.ctx.fillStyle = this.gameMode.color;
        this.ctx.fillText(`Mode: ${this.gameMode.name}`, margin, this.canvas.height - 130 * this.scaleY);
        
        // Accuracy stats
        const accuracy = this.totalHits + this.totalMisses > 0 ? 
            (this.totalHits / (this.totalHits + this.totalMisses) * 100).toFixed(1) : 0;
        this.ctx.fillStyle = '#fff';
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
            this.ctx.fillStyle = this.gameMode.color;
            this.ctx.fillText(`${this.gameMode.name} Complete!`, this.canvas.width / 2, this.canvas.height / 2);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(`Hits: ${this.totalHits} | Misses: ${this.totalMisses}`, this.canvas.width / 2, this.canvas.height / 2 + 30 * this.scaleY);
            this.ctx.fillText(`Accuracy: ${accuracy}%`, this.canvas.width / 2, this.canvas.height / 2 + 55 * this.scaleY);
            this.ctx.fillText(`Max Combo: ${this.maxCombo}`, this.canvas.width / 2, this.canvas.height / 2 + 80 * this.scaleY);
        }
    }
    
    drawTargetZones() {
        for (let i = 0; i < this.numStreams; i++) {
            const x = i * this.streamWidth;
            // All streams are active in the new design, but color-code by player
            const playerNum = this.modeSelected ? this.getPlayerForStream(i) : 1;
            const playerColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0']; // Green, Blue, Orange, Purple
            const playerColor = playerColors[playerNum - 1] || '#ffff00';
            
            // Target zone background
            this.ctx.fillStyle = playerColor.replace('#', 'rgba(') + ', 0.2)'.replace('rgba(rgba(', 'rgba(');
            // Convert hex to rgba properly
            const r = parseInt(playerColor.slice(1, 3), 16);
            const g = parseInt(playerColor.slice(3, 5), 16);
            const b = parseInt(playerColor.slice(5, 7), 16);
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
            this.ctx.fillRect(x, this.targetZoneY, this.streamWidth, this.targetHeight);
            
            // Target zone border
            this.ctx.strokeStyle = playerColor;
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, this.targetZoneY, this.streamWidth, this.targetHeight);
            
            // Center line
            this.ctx.strokeStyle = playerColor;
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
