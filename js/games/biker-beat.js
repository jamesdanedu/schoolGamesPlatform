// js/games/biker-beat.js - Complete Biker Beat Cycling Game Implementation

class BikerBeatGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors
        this.scaleX = canvas.width / 1000;
        this.scaleY = canvas.height / 600;
        
        // Game settings with difficulty levels
        this.difficulties = {
            easy: { target: 300, name: "Easy Ride", color: "#4CAF50", timeEstimate: "3-6 min" },
            normal: { target: 450, name: "Steady Pace", color: "#FF9800", timeEstimate: "4.5-9 min" },
            hard: { target: 600, name: "Challenge Mode", color: "#F44336", timeEstimate: "6-12 min" },
            extreme: { target: 750, name: "Beast Mode", color: "#9C27B0", timeEstimate: "7.5-15 min" }
        };
        
        this.selectedDifficulty = 'normal';
        this.targetRevolutions = this.difficulties[this.selectedDifficulty].target;
        this.showDifficultySelect = true;
        
        // Game state
        this.currentRevolutions = 0;
        this.gameStarted = false;
        this.gameCompleted = false;
        this.running = true;
        
        // Timing and speed tracking
        this.startTime = 0;
        this.lastRevolutionTime = 0;
        this.currentRPM = 0;
        this.maxRPM = 0;
        this.averageRPM = 0;
        this.rpmHistory = [];
        
        // HW-484 Hall sensor integration
        this.lastMagnetTime = 0;
        this.magnetDebounceTime = 100; // ms between valid detections
        
        // Visual elements
        this.cyclist = {
            x: 150 * this.scaleX,
            y: this.canvas.height - 180 * this.scaleY,
            pedalAngle: 0,
            legAngle: 0,
            armAngle: 0,
            animationSpeed: 0,
            sweatLevel: 0,
            sweatDrops: []
        };
        
        // Dynamic backgrounds that change every 25%
        this.backgrounds = ['mountains', 'forest', 'city', 'space'];
        this.currentBackgroundIndex = 0;
        
        // Background animation
        this.background = {
            cloudOffset: 0,
            mountainOffset: 0,
            treeOffset: 0,
            buildingOffset: 0,
            starOffset: 0,
            roadOffset: 0,
            speed: 0
        };
        
        // Progress and effects
        this.progressAngle = 0;
        this.particles = [];
        this.milestoneReached = false;
        this.lastMilestone = 0;
        
        // Funny motivational messages
        this.motivationalMessages = [
            // 25% messages
            [
                "You're pedaling so fast, you might generate electricity!",
                "The hamsters in their wheels are getting jealous!",
                "Scientists want to study your leg muscles!",
                "You're creating your own personal wind farm!"
            ],
            // 50% messages  
            [
                "NASA called - they want you to pedal to Mars!",
                "The Tour de France is considering adding a 'Basement Category'!",
                "Your legs are now classified as renewable energy sources!",
                "Even the Energizer Bunny is taking notes!"
            ],
            // 75% messages
            [
                "Even Shakespeare would write poems about your pedaling!",
                "The bike is starting to develop feelings for you!",
                "You've entered the legendary realm of 'Pedal Mastery'!",
                "Fitness instructors everywhere are weeping tears of joy!"
            ],
            // 100% messages
            [
                "You are now the Supreme Ruler of All Bicycles!",
                "Legend says your legs now have their own gravitational pull!",
                "The International Committee of Awesome has sent a delegation!",
                "You've achieved what scientists call 'Peak Pedal Perfection'!"
            ]
        ];
        
        this.currentMessage = "";
        this.messageTimer = 0;
        this.messageAlpha = 0;
        
        // Set up Microbit listener for HW-484 sensor data
        this.setupHallSensorListener();
        
        this.gameLoop = this.gameLoop.bind(this);
        this.gameLoop();
    }

    setupHallSensorListener() {
        // Listen for HW-484 hall sensor data from Microbit
        if (window.ipcRenderer) {
            window.ipcRenderer.on('microbit-data', (event, data) => {
                if (data.includes('BIKE_REV:')) {
                    this.processHallSensorData(data);
                }
            });
        }
    }

    processHallSensorData(data) {
        // Parse: "BIKE_REV:<count>:<rpm>:<time>"
        const parts = data.split(':');
        if (parts.length >= 4) {
            const revCount = parseInt(parts[1]);
            const rpm = parseInt(parts[2]);
            const timestamp = parseInt(parts[3]);
            
            // Only process if we have a new revolution
            if (revCount > this.currentRevolutions) {
                this.handleNewRevolution(rpm, timestamp);
                this.currentRevolutions = revCount;
            }
            
            // Update current RPM
            this.currentRPM = rpm;
            this.maxRPM = Math.max(this.maxRPM, rpm);
        }
    }

    handleNewRevolution(rpm, timestamp) {
        if (!this.gameStarted) {
            this.startGame();
        }
        
        // Update timing
        const currentTime = Date.now();
        this.lastRevolutionTime = currentTime;
        
        // Update RPM tracking
        this.rpmHistory.push(rpm);
        if (this.rpmHistory.length > 10) {
            this.rpmHistory.shift();
        }
        
        this.averageRPM = this.rpmHistory.reduce((a, b) => a + b, 0) / this.rpmHistory.length;
        
        // Update cyclist animation based on RPM
        this.cyclist.animationSpeed = Math.max(0.1, rpm / 60); // Convert RPM to animation speed
        this.cyclist.sweatLevel = Math.min(1, rpm / 100); // More sweat at higher RPM
        
        // Update background scroll speed
        this.background.speed = rpm / 20;
        
        // Check for milestones (every 25%)
        const progress = this.currentRevolutions / this.targetRevolutions;
        const milestone = Math.floor(progress * 4); // 0, 1, 2, 3 for 25%, 50%, 75%, 100%
        
        if (milestone > this.lastMilestone && milestone < 4) {
            this.reachMilestone(milestone);
        }
        
        // Update platform score
        this.platform.updateScore(this.currentRevolutions);
        
        // Check for completion
        if (this.currentRevolutions >= this.targetRevolutions) {
            this.completeGame();
        }
    }

    handleKeyDown(e) {
        if (this.showDifficultySelect) {
            switch(e.key) {
                case '1':
                    this.selectDifficulty('easy');
                    break;
                case '2':
                    this.selectDifficulty('normal');
                    break;
                case '3':
                    this.selectDifficulty('hard');
                    break;
                case '4':
                    this.selectDifficulty('extreme');
                    break;
                case ' ':
                    e.preventDefault();
                    this.cycleDifficulty();
                    break;
                case 'Enter':
                    this.startDifficultySelection();
                    break;
            }
        } else if (!this.gameStarted && e.key === ' ') {
            e.preventDefault();
            // Allow changing difficulty before starting
            this.showDifficultySelect = true;
        }
        // Note: Game is controlled by HW-484 sensor, not keyboard during gameplay
    }

    handleKeyUp(e) {
        // Not needed for bike game
    }

    selectDifficulty(difficulty) {
        this.selectedDifficulty = difficulty;
        this.targetRevolutions = this.difficulties[difficulty].target;
    }

    cycleDifficulty() {
        const keys = Object.keys(this.difficulties);
        const currentIndex = keys.indexOf(this.selectedDifficulty);
        const nextIndex = (currentIndex + 1) % keys.length;
        this.selectDifficulty(keys[nextIndex]);
    }

    startDifficultySelection() {
        this.showDifficultySelect = false;
    }

    startGame() {
        if (this.showDifficultySelect) {
            this.startDifficultySelection();
            return;
        }
        
        this.gameStarted = true;
        this.startTime = Date.now();
        this.currentRevolutions = 0;
        this.currentRPM = 0;
        this.maxRPM = 0;
        this.rpmHistory = [];
        this.lastMilestone = 0;
        this.currentBackgroundIndex = 0;
        
        // Reset visual effects
        this.particles = [];
        this.cyclist.sweatDrops = [];
        this.cyclist.sweatLevel = 0;
        
        console.log(`Biker Beat started! Target: ${this.targetRevolutions} revolutions (${this.difficulties[this.selectedDifficulty].name})`);
    }

    reachMilestone(milestone) {
        this.lastMilestone = milestone;
        this.milestoneReached = true;
        
        // Change background scene
        this.currentBackgroundIndex = milestone;
        
        // Show motivational message
        const messages = this.motivationalMessages[milestone];
        this.currentMessage = messages[Math.floor(Math.random() * messages.length)];
        this.messageTimer = 180; // Show for 3 seconds at 60fps
        this.messageAlpha = 1.0;
        
        // Create celebration particles
        this.createCelebrationParticles();
        
        console.log(`Milestone reached: ${((milestone + 1) * 25)}% - ${this.currentMessage}`);
    }

    createCelebrationParticles() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 3;
        
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: centerX + (Math.random() - 0.5) * 200,
                y: centerY + (Math.random() - 0.5) * 100,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0,
                decay: 0.01,
                color: ['#FFD700', '#FF69B4', '#00FFFF', '#98FB98'][Math.floor(Math.random() * 4)],
                size: Math.random() * 6 + 3
            });
        }
    }

    completeGame() {
        if (this.gameCompleted) return;
        
        this.gameCompleted = true;
        this.running = false;
        
        const completionTime = (Date.now() - this.startTime) / 1000;
        const finalScore = Math.floor(this.currentRevolutions + (this.averageRPM * 2));
        
        // Show final motivational message
        const finalMessages = this.motivationalMessages[3];
        this.currentMessage = finalMessages[Math.floor(Math.random() * finalMessages.length)];
        this.messageTimer = 300; // Show longer for completion
        this.messageAlpha = 1.0;
        
        // Massive celebration
        this.createVictoryParticles();
        
        setTimeout(() => {
            this.platform.gameOver(finalScore);
        }, 4000);
    }

    createVictoryParticles() {
        for (let i = 0; i < 100; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1.0,
                decay: 0.005,
                color: ['#FFD700', '#FF1493', '#00FFFF', '#98FB98', '#FF6347'][Math.floor(Math.random() * 5)],
                size: Math.random() * 8 + 4
            });
        }
    }

    update() {
        if (!this.running) return;
        
        if (this.gameStarted) {
            // Update cyclist animation
            if (this.currentRPM > 0) {
                this.cyclist.pedalAngle += this.cyclist.animationSpeed;
                this.cyclist.legAngle = Math.sin(this.cyclist.pedalAngle) * 0.3;
                this.cyclist.armAngle = Math.sin(this.cyclist.pedalAngle * 0.5) * 0.1;
            }
            
            // Update sweat drops
            if (this.cyclist.sweatLevel > 0.3 && Math.random() < 0.1) {
                this.cyclist.sweatDrops.push({
                    x: this.cyclist.x + 20 + Math.random() * 10,
                    y: this.cyclist.y + 10 + Math.random() * 20,
                    vy: 2 + Math.random() * 2,
                    life: 1.0
                });
            }
            
            // Update sweat drops
            for (let i = this.cyclist.sweatDrops.length - 1; i >= 0; i--) {
                const drop = this.cyclist.sweatDrops[i];
                drop.y += drop.vy;
                drop.life -= 0.02;
                
                if (drop.life <= 0 || drop.y > this.canvas.height) {
                    this.cyclist.sweatDrops.splice(i, 1);
                }
            }
            
            // Update background scrolling based on RPM
            this.background.cloudOffset -= this.background.speed * 0.2;
            this.background.mountainOffset -= this.background.speed * 0.5;
            this.background.treeOffset -= this.background.speed * 0.8;
            this.background.buildingOffset -= this.background.speed * 1.0;
            this.background.starOffset -= this.background.speed * 0.3;
            this.background.roadOffset -= this.background.speed * 2.0;
            
            // Progress angle for circular progress indicator
            this.progressAngle = (this.currentRevolutions / this.targetRevolutions) * Math.PI * 2;
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
        
        // Update motivational message
        if (this.messageTimer > 0) {
            this.messageTimer--;
            this.messageAlpha = Math.max(0, this.messageTimer / 180);
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.showDifficultySelect) {
            this.drawDifficultySelection();
            return;
        }
        
        if (!this.gameStarted) {
            this.drawStartScreen();
            return;
        }
        
        // Draw background based on current scene
        this.drawBackground();
        
        // Draw cyclist
        this.drawCyclist();
        
        // Draw UI elements
        this.drawUI();
        
        // Draw particles
        this.drawParticles();
        
        // Draw motivational message
        if (this.messageTimer > 0) {
            this.drawMotivationalMessage();
        }
        
        // Draw completion screen
        if (this.gameCompleted) {
            this.drawCompletionScreen();
        }
    }

    drawDifficultySelection() {
        // Gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#2E3192');
        gradient.addColorStop(1, '#1BFFFF');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `bold ${Math.max(36, 48 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🚴‍♂️ Biker Beat', this.canvas.width / 2, 100 * this.scaleY);
        
        this.ctx.font = `${Math.max(18, 24 * this.scaleY)}px Arial`;
        this.ctx.fillText('Choose Your Challenge Level', this.canvas.width / 2, 150 * this.scaleY);
        
        // Difficulty buttons
        const buttonY = 220 * this.scaleY;
        const buttonWidth = 180 * this.scaleX;
        const buttonHeight = 80 * this.scaleY;
        const spacing = 220 * this.scaleX;
        
        Object.entries(this.difficulties).forEach(([key, diff], index) => {
            const x = (this.canvas.width / 2) - (spacing * 1.5) + (index * spacing);
            const isSelected = key === this.selectedDifficulty;
            
            // Button background
            this.ctx.fillStyle = isSelected ? diff.color : 'rgba(255,255,255,0.2)';
            this.ctx.fillRect(x - buttonWidth/2, buttonY, buttonWidth, buttonHeight);
            
            // Button border
            this.ctx.strokeStyle = diff.color;
            this.ctx.lineWidth = isSelected ? 4 : 2;
            this.ctx.strokeRect(x - buttonWidth/2, buttonY, buttonWidth, buttonHeight);
            
            // Button text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${Math.max(14, 18 * this.scaleY)}px Arial`;
            this.ctx.fillText(diff.name, x, buttonY + 25 * this.scaleY);
            this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText(`${diff.target} revs`, x, buttonY + 45 * this.scaleY);
            this.ctx.font = `${Math.max(12, 14 * this.scaleY)}px Arial`;
            this.ctx.fillText(diff.timeEstimate, x, buttonY + 65 * this.scaleY);
            
            // Number indicator
            this.ctx.fillStyle = diff.color;
            this.ctx.font = `bold ${Math.max(20, 24 * this.scaleY)}px Arial`;
            this.ctx.fillText(`${index + 1}`, x, buttonY - 10 * this.scaleY);
        });
        
        // Instructions
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.fillText('Click a difficulty, press 1-4, or use SPACEBAR to cycle', this.canvas.width / 2, 380 * this.scaleY);
        this.ctx.fillText('Press ENTER to confirm and start!', this.canvas.width / 2, 410 * this.scaleY);
    }

    drawStartScreen() {
        // Sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        
        const titleY = this.canvas.height / 2 - 80 * this.scaleY;
        this.ctx.strokeText('🚴‍♂️ Ready to Ride!', this.canvas.width / 2, titleY);
        this.ctx.fillText('🚴‍♂️ Ready to Ride!', this.canvas.width / 2, titleY);
        
        // Selected difficulty info
        const diff = this.difficulties[this.selectedDifficulty];
        this.ctx.font = `bold ${Math.max(24, 30 * this.scaleY)}px Arial`;
        this.ctx.fillStyle = diff.color;
        this.ctx.fillText(`${diff.name}: ${diff.target} revolutions`, this.canvas.width / 2, titleY + 60 * this.scaleY);
        
        // Instructions
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.fillText('Start pedaling to begin!', this.canvas.width / 2, titleY + 100 * this.scaleY);
        this.ctx.fillText('Press SPACEBAR to change difficulty', this.canvas.width / 2, titleY + 125 * this.scaleY);
    }

    drawBackground() {
        const scene = this.backgrounds[this.currentBackgroundIndex];
        
        switch (scene) {
            case 'mountains':
                this.drawMountainScene();
                break;
            case 'forest':
                this.drawForestScene();
                break;
            case 'city':
                this.drawCityScene();
                break;
            case 'space':
                this.drawSpaceScene();
                break;
        }
        
        // Draw road/ground
        this.drawRoad();
    }

    drawMountainScene() {
        // Sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.7);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#B0E0E6');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.7);
        
        // Mountains (parallax scrolling)
        this.drawMountains();
        
        // Clouds
        this.drawClouds();
    }

    drawForestScene() {
        // Forest sky
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.7);
        gradient.addColorStop(0, '#98FB98');
        gradient.addColorStop(1, '#90EE90');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.7);
        
        // Trees
        this.drawTrees();
    }

    drawCityScene() {
        // City sky
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.7);
        gradient.addColorStop(0, '#FFB6C1');
        gradient.addColorStop(1, '#DDA0DD');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.7);
        
        // Buildings
        this.drawBuildings();
    }

    drawSpaceScene() {
        // Space background
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.7);
        
        // Stars
        this.drawStars();
        
        // Nebula effect
        this.drawNebula();
    }

    drawMountains() {
        this.ctx.fillStyle = '#8FBC8F';
        const mountainY = this.canvas.height * 0.4;
        
        // Background mountains
        for (let i = 0; i < 5; i++) {
            const x = (i * 200 + this.background.mountainOffset % 1000) * this.scaleX;
            const height = (100 + Math.sin(i) * 30) * this.scaleY;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, mountainY + height);
            this.ctx.lineTo(x + 100 * this.scaleX, mountainY);
            this.ctx.lineTo(x + 200 * this.scaleX, mountainY + height);
            this.ctx.lineTo(x + 200 * this.scaleX, this.canvas.height * 0.7);
            this.ctx.lineTo(x, this.canvas.height * 0.7);
            this.ctx.fill();
        }
    }

    drawClouds() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        for (let i = 0; i < 6; i++) {
            const x = (i * 180 + this.background.cloudOffset % 1080) * this.scaleX;
            const y = (50 + Math.sin(i) * 20) * this.scaleY;
            const size = (20 + Math.cos(i) * 5) * Math.min(this.scaleX, this.scaleY);
            
            // Draw fluffy cloud
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.arc(x + size, y, size * 0.8, 0, Math.PI * 2);
            this.ctx.arc(x - size, y, size * 0.8, 0, Math.PI * 2);
            this.ctx.arc(x, y - size * 0.5, size * 0.8, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawTrees() {
        this.ctx.fillStyle = '#228B22';
        
        for (let i = 0; i < 8; i++) {
            const x = (i * 120 + this.background.treeOffset % 960) * this.scaleX;
            const baseY = this.canvas.height * 0.7;
            const height = (80 + Math.sin(i * 0.7) * 20) * this.scaleY;
            
            // Tree trunk
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(x - 5 * this.scaleX, baseY - height * 0.3, 10 * this.scaleX, height * 0.3);
            
            // Tree crown
            this.ctx.fillStyle = '#228B22';
            this.ctx.beginPath();
            this.ctx.arc(x, baseY - height * 0.7, height * 0.4, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawBuildings() {
        for (let i = 0; i < 6; i++) {
            const x = (i * 150 + this.background.buildingOffset % 900) * this.scaleX;
            const baseY = this.canvas.height * 0.7;
            const height = (100 + Math.sin(i * 1.2) * 40) * this.scaleY;
            const width = (80 + Math.cos(i * 0.8) * 20) * this.scaleX;
            
            // Building
            this.ctx.fillStyle = ['#696969', '#708090', '#778899'][i % 3];
            this.ctx.fillRect(x, baseY - height, width, height);
            
            // Windows
            this.ctx.fillStyle = '#FFD700';
            for (let w = 0; w < 3; w++) {
                for (let h = 0; h < Math.floor(height / 40); h++) {
                    if (Math.random() > 0.3) { // Some windows are lit
                        this.ctx.fillRect(
                            x + (w * 20 + 10) * this.scaleX,
                            baseY - height + (h * 30 + 15) * this.scaleY,
                            8 * this.scaleX,
                            12 * this.scaleY
                        );
                    }
                }
            }
        }
    }

    drawStars() {
        this.ctx.fillStyle = '#FFF';
        
        for (let i = 0; i < 50; i++) {
            const x = (i * 37 + this.background.starOffset % 1850) % this.canvas.width;
            const y = (Math.sin(i * 0.5) * 200 + 100) * this.scaleY;
            const size = Math.random() * 3 + 1;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawNebula() {
        // Colorful nebula effect
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width * 0.7, this.canvas.height * 0.3, 0,
            this.canvas.width * 0.7, this.canvas.height * 0.3, 200 * Math.min(this.scaleX, this.scaleY)
        );
        gradient.addColorStop(0, 'rgba(255, 105, 180, 0.3)');
        gradient.addColorStop(0.5, 'rgba(64, 224, 208, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 105, 180, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.7);
    }

    drawRoad() {
        const roadY = this.canvas.height * 0.7;
        
        // Road surface
        this.ctx.fillStyle = '#555';
        this.ctx.fillRect(0, roadY, this.canvas.width, this.canvas.height * 0.3);
        
        // Road markings (scrolling)
        this.ctx.fillStyle = '#FFF';
        for (let i = 0; i < 10; i++) {
            const x = (i * 100 + this.background.roadOffset % 1000) * this.scaleX;
            this.ctx.fillRect(x, roadY + 40 * this.scaleY, 50 * this.scaleX, 5 * this.scaleY);
        }
    }

    drawCyclist() {
        const cyclist = this.cyclist;
        const scale = Math.min(this.scaleX, this.scaleY);
        
        // Bike frame
        this.ctx.strokeStyle = '#FF6347';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        // Simple bike frame shape
        this.ctx.moveTo(cyclist.x - 30 * scale, cyclist.y);
        this.ctx.lineTo(cyclist.x + 30 * scale, cyclist.y);
        this.ctx.lineTo(cyclist.x, cyclist.y - 40 * scale);
        this.ctx.lineTo(cyclist.x - 30 * scale, cyclist.y);
        this.ctx.stroke();
        
        // Wheels
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.arc(cyclist.x - 30 * scale, cyclist.y, 20 * scale, 0, Math.PI * 2);
        this.ctx.arc(cyclist.x + 30 * scale, cyclist.y, 20 * scale, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Cyclist body
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(cyclist.x, cyclist.y - 60 * scale, 15 * scale, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Arms (animated with pedaling)
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(cyclist.x, cyclist.y - 45 * scale);
        this.ctx.lineTo(cyclist.x - 15 * scale + Math.sin(cyclist.armAngle) * 5, cyclist.y - 25 * scale);
        this.ctx.stroke();
        
        // Legs (animated with pedaling)
        this.ctx.beginPath();
        this.ctx.moveTo(cyclist.x, cyclist.y - 30 * scale);
        const legX = cyclist.x + Math.sin(cyclist.pedalAngle) * 15 * scale;
        const legY = cyclist.y - 10 * scale + Math.cos(cyclist.pedalAngle) * 10 * scale;
        this.ctx.lineTo(legX, legY);
        this.ctx.stroke();
        
        // Sweat drops
        this.ctx.fillStyle = '#87CEEB';
        cyclist.sweatDrops.forEach(drop => {
            this.ctx.globalAlpha = drop.life;
            this.ctx.beginPath();
            this.ctx.arc(drop.x, drop.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }

    drawUI() {
        // Progress circle (main indicator)
        this.drawProgressCircle();
        
        // Stats panel
        this.drawStatsPanel();
        
        // RPM meter
        this.drawRPMMeter();
    }

    drawProgressCircle() {
        const centerX = this.canvas.width - 120 * this.scaleX;
        const centerY = 120 * this.scaleY;
        const radius = 50 * Math.min(this.scaleX, this.scaleY);
        
        // Background circle
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Progress circle
        const progress = this.currentRevolutions / this.targetRevolutions;
        const diff = this.difficulties[this.selectedDifficulty];
        this.ctx.strokeStyle = diff.color;
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        this.ctx.stroke();
        
        // Progress text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `bold ${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${this.currentRevolutions}`, centerX, centerY - 5 * this.scaleY);
        this.ctx.font = `${Math.max(12, 14 * this.scaleY)}px Arial`;
        this.ctx.fillText(`/${this.targetRevolutions}`, centerX, centerY + 12 * this.scaleY);
        this.ctx.fillText(`${(progress * 100).toFixed(1)}%`, centerX, centerY + 28 * this.scaleY);
    }

    drawStatsPanel() {
        // Background panel
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10 * this.scaleX, 10 * this.scaleY, 200 * this.scaleX, 120 * this.scaleY);
        
        // Stats text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(14, 16 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'left';
        
        const leftMargin = 20 * this.scaleX;
        let y = 30 * this.scaleY;
        const lineHeight = 18 * this.scaleY;
        
        // Difficulty
        const diff = this.difficulties[this.selectedDifficulty];
        this.ctx.fillStyle = diff.color;
        this.ctx.fillText(`${diff.name}`, leftMargin, y);
        
        this.ctx.fillStyle = '#fff';
        y += lineHeight;
        this.ctx.fillText(`RPM: ${this.currentRPM}`, leftMargin, y);
        
        y += lineHeight;
        this.ctx.fillText(`Max RPM: ${this.maxRPM}`, leftMargin, y);
        
        y += lineHeight;
        this.ctx.fillText(`Avg RPM: ${this.averageRPM.toFixed(1)}`, leftMargin, y);
        
        // Time elapsed
        if (this.gameStarted) {
            const elapsed = (Date.now() - this.startTime) / 1000;
            y += lineHeight;
            this.ctx.fillText(`Time: ${elapsed.toFixed(1)}s`, leftMargin, y);
        }
    }

    drawRPMMeter() {
        const meterX = this.canvas.width - 120 * this.scaleX;
        const meterY = 280 * this.scaleY;
        const meterWidth = 100 * this.scaleX;
        const meterHeight = 20 * this.scaleY;
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(meterX - meterWidth/2, meterY, meterWidth, meterHeight);
        
        // RPM bar
        const rpmRatio = Math.min(this.currentRPM / 120, 1); // Max display: 120 RPM
        let barColor = '#00ff00';
        if (rpmRatio > 0.7) barColor = '#ffff00';
        if (rpmRatio > 0.9) barColor = '#ff0000';
        
        this.ctx.fillStyle = barColor;
        this.ctx.fillRect(meterX - meterWidth/2, meterY, meterWidth * rpmRatio, meterHeight);
        
        // Border
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(meterX - meterWidth/2, meterY, meterWidth, meterHeight);
        
        // Label
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(12, 14 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('RPM', meterX, meterY - 5 * this.scaleY);
    }

    drawParticles() {
        this.particles.forEach(particle => {
            const alpha = Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.fillStyle = particle.color + alpha;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawMotivationalMessage() {
        if (!this.currentMessage) return;
        
        // Background
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.messageAlpha * 0.8})`;
        this.ctx.fillRect(0, this.canvas.height * 0.3, this.canvas.width, 100 * this.scaleY);
        
        // Message text
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.messageAlpha})`;
        this.ctx.font = `bold ${Math.max(20, 28 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.currentMessage, this.canvas.width / 2, this.canvas.height * 0.35 + 30 * this.scaleY);
    }

    drawCompletionScreen() {
        // Overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Completion message
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🎉 RIDE COMPLETE! 🎉', this.canvas.width / 2, this.canvas.height / 2 - 80 * this.scaleY);
        
        // Stats
        const completionTime = (Date.now() - this.startTime) / 1000;
        const diff = this.difficulties[this.selectedDifficulty];
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(20, 24 * this.scaleY)}px Arial`;
        this.ctx.fillText(`${diff.name} Completed!`, this.canvas.width / 2, this.canvas.height / 2 - 30 * this.scaleY);
        this.ctx.fillText(`${this.targetRevolutions} revolutions in ${completionTime.toFixed(1)}s`, this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.fillText(`Max RPM: ${this.maxRPM} | Avg RPM: ${this.averageRPM.toFixed(1)}`, this.canvas.width / 2, this.canvas.height / 2 + 30 * this.scaleY);
        
        // Final motivational message
        if (this.currentMessage) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = `bold ${Math.max(16, 20 * this.scaleY)}px Arial`;
            this.ctx.fillText(this.currentMessage, this.canvas.width / 2, this.canvas.height / 2 + 70 * this.scaleY);
        }
    }

    gameLoop() {
        this.update();
        this.draw();
        
        if (this.running || this.showDifficultySelect || !this.gameStarted) {
            requestAnimationFrame(this.gameLoop);
        }
    }

    destroy() {
        this.running = false;
        // Clean up any event listeners if needed
    }
}
