// js/games/wire-buzzer.js - Wire Buzzer Game Implementation

class WireBuzzerGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Game settings
        this.timeLimit = 30; // seconds to complete
        this.difficulty = 1; // 1=easy, 2=medium, 3=hard
        
        // Wire path - complex curved path
        this.wirePath = this.generateWirePath();
        this.wireWidth = 8 * Math.min(this.scaleX, this.scaleY);
        
        // Player hoop
        this.hoop = {
            x: this.wirePath[0].x,
            y: this.wirePath[0].y,
            radius: 15 * Math.min(this.scaleX, this.scaleY),
            pathIndex: 0,
            pathProgress: 0
        };
        
        // Game state
        this.gameStarted = false;
        this.gameCompleted = false;
        this.running = true;
        this.startTime = 0;
        this.timeRemaining = this.timeLimit;
        this.buzzCount = 0;
        this.maxBuzzes = 3; // Game over after 3 buzzes
        
        // Microbit connection
        this.microbitConnected = this.platform.microbitConnected;
        this.buzzDetected = false;
        this.lastBuzzTime = 0;
        
        // Visual effects
        this.particles = [];
        this.sparkEffect = false;
        this.sparkTimer = 0;
        
        // Controls
        this.keys = {};
        this.mouseDown = false;
        this.mousePos = { x: 0, y: 0 };
        
        this.setupEventListeners();
        this.gameLoop = this.gameLoop.bind(this);
        this.gameLoop();
    }

    setupEventListeners() {
        // Mouse events for hoop movement
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouseDown = true;
            this.updateMousePosition(e);
            if (!this.gameStarted) {
                this.startGame();
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.mouseDown = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.updateMousePosition(e);
            if (this.mouseDown && this.gameStarted && !this.gameCompleted) {
                this.moveHoop(e);
            }
        });

        // Touch events for mobile/tablet
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        // Set up Microbit listener if available
        if (this.microbitConnected && window.microbitController) {
            window.microbitController.onData((message) => {
                if (message.includes('BUZZ') || message.includes('TOUCH')) {
                    this.onMicrobitBuzz();
                }
            });
        }
    }

    generateWirePath() {
        const path = [];
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const startX = 50 * this.scaleX;
        const startY = centerY;
        
        // Start point
        path.push({ x: startX, y: startY });
        
        // Generate complex curved path
        const segments = 20;
        for (let i = 1; i <= segments; i++) {
            const progress = i / segments;
            
            // Base path across screen
            const baseX = startX + (this.canvas.width - 100 * this.scaleX) * progress;
            
            // Add curves and waves
            const wave1 = Math.sin(progress * Math.PI * 3) * 80 * this.scaleY;
            const wave2 = Math.sin(progress * Math.PI * 2 + Math.PI/3) * 50 * this.scaleY;
            const spiral = Math.sin(progress * Math.PI * 6) * 30 * this.scaleY * progress;
            
            const x = baseX;
            const y = centerY + wave1 + wave2 + spiral;
            
            path.push({ x, y });
        }
        
        return path;
    }

    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
    }

    startGame() {
        this.gameStarted = true;
        this.startTime = Date.now();
        this.buzzCount = 0;
        this.hoop.pathIndex = 0;
        this.hoop.pathProgress = 0;
        this.hoop.x = this.wirePath[0].x;
        this.hoop.y = this.wirePath[0].y;
    }

    moveHoop(e) {
        // Move hoop toward mouse position along the wire path
        const targetX = this.mousePos.x;
        const targetY = this.mousePos.y;
        
        // Find closest point on wire path
        let closestIndex = 0;
        let minDistance = Infinity;
        
        for (let i = 0; i < this.wirePath.length; i++) {
            const point = this.wirePath[i];
            const distance = Math.sqrt(
                Math.pow(targetX - point.x, 2) + 
                Math.pow(targetY - point.y, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }
        
        // Only allow forward movement (no going backwards)
        if (closestIndex > this.hoop.pathIndex) {
            this.hoop.pathIndex = closestIndex;
            this.hoop.x = this.wirePath[closestIndex].x;
            this.hoop.y = this.wirePath[closestIndex].y;
            
            // Check if hoop is touching the wire (for visual feedback)
            if (minDistance > this.hoop.radius + this.wireWidth / 2) {
                // Simulate buzz if not connected to Microbit
                if (!this.microbitConnected) {
                    this.simulateBuzz();
                }
            }
        }
        
        // Check for completion
        if (this.hoop.pathIndex >= this.wirePath.length - 1) {
            this.completeGame();
        }
    }

    onMicrobitBuzz() {
        const now = Date.now();
        // Debounce buzzes (ignore if too frequent)
        if (now - this.lastBuzzTime < 200) return;
        
        this.lastBuzzTime = now;
        this.buzzDetected = true;
        this.buzzCount++;
        
        this.createBuzzEffect();
        
        if (this.buzzCount >= this.maxBuzzes) {
            this.gameOver();
        }
    }

    simulateBuzz() {
        // For testing without Microbit
        const now = Date.now();
        if (now - this.lastBuzzTime < 500) return; // Less sensitive than real Microbit
        
        this.onMicrobitBuzz();
    }

    createBuzzEffect() {
        // Visual buzz effect
        this.sparkEffect = true;
        this.sparkTimer = 30; // frames
        
        // Create spark particles
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: this.hoop.x,
                y: this.hoop.y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0,
                decay: 0.03,
                color: '#ffff00',
                size: Math.random() * 4 + 2
            });
        }
        
        // Send feedback to Microbit if connected
        if (this.microbitConnected && window.microbitController) {
            window.microbitController.showIcon('SAD');
            setTimeout(() => {
                if (window.microbitController) {
                    window.microbitController.clearDisplay();
                }
            }, 1000);
        }
    }

    completeGame() {
        if (this.gameCompleted) return;
        
        this.gameCompleted = true;
        this.running = false;
        
        const completionTime = (Date.now() - this.startTime) / 1000;
        const timeBonus = Math.max(0, this.timeLimit - completionTime) * 10;
        const buzzPenalty = this.buzzCount * 50;
        const finalScore = Math.max(0, 1000 + timeBonus - buzzPenalty);
        
        // Success effect
        this.createSuccessEffect();
        
        // Send success to Microbit
        if (this.microbitConnected && window.microbitController) {
            window.microbitController.showIcon('HAPPY');
        }
        
        setTimeout(() => {
            this.platform.gameOver(Math.floor(finalScore));
        }, 3000);
    }

    createSuccessEffect() {
        // Celebration particles
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: this.hoop.x,
                y: this.hoop.y,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1.0,
                decay: 0.02,
                color: ['#00ff00', '#00ffff', '#ffff00'][Math.floor(Math.random() * 3)],
                size: Math.random() * 6 + 3
            });
        }
    }

    gameOver() {
        this.running = false;
        
        // Send game over to Microbit
        if (this.microbitConnected && window.microbitController) {
            window.microbitController.showIcon('NO');
        }
        
        setTimeout(() => {
            this.platform.gameOver(0); // No score for failure
        }, 2000);
    }

    handleKeyDown(e) {
        this.keys[e.key] = true;
        
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (!this.gameStarted) {
                this.startGame();
            }
        }
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
    }

    update() {
        if (!this.running) return;
        
        if (this.gameStarted && !this.gameCompleted) {
            // Update timer
            const elapsed = (Date.now() - this.startTime) / 1000;
            this.timeRemaining = Math.max(0, this.timeLimit - elapsed);
            
            if (this.timeRemaining <= 0) {
                this.gameOver();
                return;
            }
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
        
        // Update spark effect
        if (this.sparkTimer > 0) {
            this.sparkTimer--;
            if (this.sparkTimer <= 0) {
                this.sparkEffect = false;
            }
        }
    }

    draw() {
        // Background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.gameStarted) {
            // Start screen
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Wire Buzzer Challenge', this.canvas.width / 2, this.canvas.height / 2 - 80 * this.scaleY);
            
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText('Guide the hoop along the wire path', this.canvas.width / 2, this.canvas.height / 2 - 20 * this.scaleY);
            this.ctx.fillText('without touching the wire!', this.canvas.width / 2, this.canvas.height / 2 + 5 * this.scaleY);
            
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillText(`Time limit: ${this.timeLimit} seconds`, this.canvas.width / 2, this.canvas.height / 2 + 40 * this.scaleY);
            this.ctx.fillText(`Maximum buzzes: ${this.maxBuzzes}`, this.canvas.width / 2, this.canvas.height / 2 + 65 * this.scaleY);
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = `${Math.max(18, 22 * this.scaleY)}px Arial`;
            this.ctx.fillText('Click and drag to start', this.canvas.width / 2, this.canvas.height / 2 + 100 * this.scaleY);
            
            // Microbit status
            const statusText = this.microbitConnected ? 'Microbit: Connected ✓' : 'Microbit: Not connected (simulation mode)';
            this.ctx.fillStyle = this.microbitConnected ? '#00ff00' : '#ffaa00';
            this.ctx.font = `${Math.max(14, 16 * this.scaleY)}px Arial`;
            this.ctx.fillText(statusText, this.canvas.width / 2, this.canvas.height - 30 * this.scaleY);
            
            return;
        }
        
        // Draw wire path
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = this.wireWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.wirePath[0].x, this.wirePath[0].y);
        
        for (let i = 1; i < this.wirePath.length; i++) {
            this.ctx.lineTo(this.wirePath[i].x, this.wirePath[i].y);
        }
        this.ctx.stroke();
        
        // Draw wire supports/posts
        this.ctx.fillStyle = '#444444';
        const postHeight = 30 * this.scaleY;
        this.ctx.fillRect(this.wirePath[0].x - 5, this.wirePath[0].y, 10, postHeight);
        this.ctx.fillRect(this.wirePath[this.wirePath.length-1].x - 5, this.wirePath[this.wirePath.length-1].y, 10, postHeight);
        
        // Draw progress line (completed path)
        if (this.hoop.pathIndex > 0) {
            this.ctx.strokeStyle = '#00aa00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(this.wirePath[0].x, this.wirePath[0].y);
            
            for (let i = 1; i <= this.hoop.pathIndex; i++) {
                this.ctx.lineTo(this.wirePath[i].x, this.wirePath[i].y);
            }
            this.ctx.stroke();
        }
        
        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.fillStyle = particle.color + Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw hoop
        this.ctx.strokeStyle = this.sparkEffect ? '#ffff00' : '#00ffff';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(this.hoop.x, this.hoop.y, this.hoop.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Hoop inner ring
        this.ctx.strokeStyle = this.sparkEffect ? '#ffffff' : '#0088ff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.hoop.x, this.hoop.y, this.hoop.radius - 4, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Time: ${this.timeRemaining.toFixed(1)}s`, 20, 30);
        this.ctx.fillText(`Buzzes: ${this.buzzCount}/${this.maxBuzzes}`, 20, 55);
        
        const progress = (this.hoop.pathIndex / (this.wirePath.length - 1)) * 100;
        this.ctx.fillText(`Progress: ${progress.toFixed(1)}%`, 20, 80);
        
        // Warning for too many buzzes
        if (this.buzzCount >= this.maxBuzzes - 1) {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = `bold ${Math.max(18, 24 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⚠️ FINAL WARNING ⚠️', this.canvas.width / 2, 50 * this.scaleY);
        }
        
        if (this.gameCompleted) {
            // Victory screen
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🎉 SUCCESS! 🎉', this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
            
            const completionTime = (Date.now() - this.startTime) / 1000;
            this.ctx.font = `${Math.max(20, 24 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(`Time: ${completionTime.toFixed(1)}s`, this.canvas.width / 2, this.canvas.height / 2 + 20 * this.scaleY);
            this.ctx.fillText(`Buzzes: ${this.buzzCount}`, this.canvas.width / 2, this.canvas.height / 2 + 50 * this.scaleY);
            
        } else if (!this.running) {
            // Game over screen
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
            
            const reason = this.buzzCount >= this.maxBuzzes ? 'Too many buzzes!' : 'Time up!';
            this.ctx.font = `${Math.max(20, 24 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(reason, this.canvas.width / 2, this.canvas.height / 2 + 20 * this.scaleY);
        }
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
        
        // Clean up event listeners
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
    }
}
