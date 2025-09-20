// js/games/pong.js - Pong Game Implementation

class PongGame {
    constructor(canvas, ctx, platform) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        
        // Scale factors based on canvas size
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        this.paddle1Y = canvas.height / 2 - (50 * this.scaleY);
        this.paddle2Y = canvas.height / 2 - (50 * this.scaleY);
        this.paddleSpeed = 8 * this.scaleY;
        this.paddleHeight = 100 * this.scaleY;
        this.paddleWidth = 15 * this.scaleX;
        
        this.ballX = canvas.width / 2;
        this.ballY = canvas.height / 2;
        this.ballSpeedX = 5 * this.scaleX;
        this.ballSpeedY = 3 * this.scaleY;
        this.ballSize = 8 * Math.min(this.scaleX, this.scaleY);
        
        this.score1 = 0;
        this.score2 = 0;
        this.maxScore = 5;
        
        this.keys = {};
        
        this.gameLoop = this.gameLoop.bind(this);
        this.running = true;
        this.gameLoop();
    }

    handleKeyDown(e) {
        this.keys[e.key] = true;
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
    }

    // Handle Microbit button presses
    handleMicrobitButtonPress(buttonNumber) {
        switch(buttonNumber) {
            case 1: // Button 1 - Left paddle up
                this.keys['leftUp'] = true;
                break;
            case 2: // Button 2 - Left paddle down
                this.keys['leftDown'] = true;
                break;
            case 3: // Button 3 - Right paddle up
                this.keys['rightUp'] = true;
                break;
            case 4: // Button 4 - Right paddle down
                this.keys['rightDown'] = true;
                break;
        }
    }

    // Handle Microbit button releases
    handleMicrobitButtonRelease(buttonNumber) {
        switch(buttonNumber) {
            case 1: // Button 1 - Left paddle up
                this.keys['leftUp'] = false;
                break;
            case 2: // Button 2 - Left paddle down
                this.keys['leftDown'] = false;
                break;
            case 3: // Button 3 - Right paddle up
                this.keys['rightUp'] = false;
                break;
            case 4: // Button 4 - Right paddle down
                this.keys['rightDown'] = false;
                break;
        }
    }

    // Complete update() method for PongGame class
// Replace your existing update() method with this:

update() {
        // Left paddle controls (Button 1 = Up, Button 2 = Down, or keyboard W/S/Arrow Keys)
        if (this.keys['leftUp'] || this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) {
            this.paddle1Y = Math.max(0, this.paddle1Y - this.paddleSpeed);
        }
        if (this.keys['leftDown'] || this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) {
            this.paddle1Y = Math.min(this.canvas.height - this.paddleHeight, this.paddle1Y + this.paddleSpeed);
        }

        // Right paddle controls (Button 3 = Up, Button 4 = Down, or AI)
        if (this.keys['rightUp']) {
            this.paddle2Y = Math.max(0, this.paddle2Y - this.paddleSpeed);
        } else if (this.keys['rightDown']) {
            this.paddle2Y = Math.min(this.canvas.height - this.paddleHeight, this.paddle2Y + this.paddleSpeed);
        } else {
            // AI for right paddle when buttons 3&4 aren't pressed
            const paddle2Center = this.paddle2Y + this.paddleHeight / 2;
            const aiSpeed = this.paddleSpeed * 0.75;
            if (paddle2Center < this.ballY - 35 * this.scaleY) {
                this.paddle2Y = Math.min(this.canvas.height - this.paddleHeight, this.paddle2Y + aiSpeed);
            } else if (paddle2Center > this.ballY + 35 * this.scaleY) {
                this.paddle2Y = Math.max(0, this.paddle2Y - aiSpeed);
            }
        }

        // Ball movement
        this.ballX += this.ballSpeedX;
        this.ballY += this.ballSpeedY;

        // Ball collision with top/bottom walls
        if (this.ballY <= this.ballSize || this.ballY >= this.canvas.height - this.ballSize) {
            this.ballSpeedY = -this.ballSpeedY;
        }

        // Ball collision with paddles
        if (this.ballX <= this.paddleWidth + this.ballSize && 
            this.ballY >= this.paddle1Y && 
            this.ballY <= this.paddle1Y + this.paddleHeight) {
            this.ballSpeedX = Math.abs(this.ballSpeedX);
            this.ballSpeedY += (Math.random() - 0.5) * 4 * this.scaleY;
        }

        if (this.ballX >= this.canvas.width - this.paddleWidth - this.ballSize && 
            this.ballY >= this.paddle2Y && 
            this.ballY <= this.paddle2Y + this.paddleHeight) {
            this.ballSpeedX = -Math.abs(this.ballSpeedX);
            this.ballSpeedY += (Math.random() - 0.5) * 4 * this.scaleY;
        }

        // Score points
        if (this.ballX < 0) {
            this.score2++;
            this.resetBall();
        }
        if (this.ballX > this.canvas.width) {
            this.score1++;
            this.resetBall();
        }

        // Update platform score display
        this.platform.updateScore(this.score1);

        // Check for game end
        if (this.score1 >= this.maxScore) {
            this.running = false;
            this.platform.gameOver(this.score1 * 10); // Score multiplier for high scores
        } else if (this.score2 >= this.maxScore) {
            this.running = false;
            this.platform.gameOver(0); // Lost to AI
        }
    }

    resetBall() {
        this.ballX = this.canvas.width / 2;
        this.ballY = this.canvas.height / 2;
        this.ballSpeedX = -this.ballSpeedX;
        this.ballSpeedY = (Math.random() - 0.5) * 6 * this.scaleY;
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw center line
        this.ctx.setLineDash([5 * this.scaleY, 15 * this.scaleY]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw paddles
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(0, this.paddle1Y, this.paddleWidth, this.paddleHeight);
        this.ctx.fillRect(this.canvas.width - this.paddleWidth, this.paddle2Y, this.paddleWidth, this.paddleHeight);

        // Draw ball
        this.ctx.beginPath();
        this.ctx.arc(this.ballX, this.ballY, this.ballSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw scores
        const fontSize = Math.max(24, 48 * this.scaleY);
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.score1, this.canvas.width / 4, fontSize + 20);
        this.ctx.fillText(this.score2, 3 * this.canvas.width / 4, fontSize + 20);

        // Draw instructions
        const instructionSize = Math.max(12, 16 * this.scaleY);
        this.ctx.font = `${instructionSize}px Arial`;
        this.ctx.fillText('W/S or ↑/↓ to move paddle • First to 5 wins', this.canvas.width / 2, this.canvas.height - 20);
    }

    gameLoop() {
        if (this.running) {
            this.update();
            this.draw();
            requestAnimationFrame(this.gameLoop);
        }
    }

    destroy() {
        this.running = false;
    }
}
