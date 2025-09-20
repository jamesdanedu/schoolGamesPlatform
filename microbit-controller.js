// microbit-controller.js - Updated for minimal Microbit code

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { EventEmitter } = require('events');

class MicrobitArcadeController extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.buttonStates = [false, false, false, false]; // Green1, White, Red, Green2
        this.ledStates = [false, false, false, false]; // LED states for each button
        this.buttonColors = ["GREEN", "WHITE", "RED", "GREEN"];
        this.buttonPositions = ["LEFT", "MIDDLE-LEFT", "MIDDLE-RIGHT", "RIGHT"];
        this.microbitMapping = new Map(); // Maps button ID to port
        
        this.findMicrobits();
    }

    async findMicrobits() {
        try {
            const ports = await SerialPort.list();
            const microbitPorts = ports.filter(port => 
                port.manufacturer && (
                    port.manufacturer.includes('Arm') || 
                    port.manufacturer.includes('mbed') ||
                    port.manufacturer.includes('Microbit') ||
                    port.path.includes('usbmodem')
                )
            );

            console.log(`🎮 Found ${microbitPorts.length} potential Microbits:`);
            microbitPorts.forEach(port => {
                console.log(`   - ${port.path} (${port.manufacturer})`);
            });

            // Connect to each Microbit
            for (const portInfo of microbitPorts) {
                await this.connectToMicrobit(portInfo.path);
            }

            if (microbitPorts.length === 0) {
                console.log('❌ No Microbits found. Make sure they are connected.');
            }

        } catch (error) {
            console.error('Error finding Microbits:', error);
        }
    }

    async connectToMicrobit(portPath) {
        try {
            const port = new SerialPort({
                path: portPath,
                baudRate: 115200
            });

            const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
            
            parser.on('data', (data) => {
                this.processMessage(portPath, data.trim());
            });

            port.on('error', (error) => {
                console.error(`❌ Error on ${portPath}:`, error.message);
            });

            port.on('close', () => {
                console.log(`🔌 ${portPath} disconnected`);
                this.connections.delete(portPath);
                // Remove from mapping
                for (const [buttonId, mappedPort] of this.microbitMapping) {
                    if (mappedPort === portPath) {
                        this.microbitMapping.delete(buttonId);
                        break;
                    }
                }
            });

            this.connections.set(portPath, { port, parser });
            console.log(`✅ Connected to Microbit at ${portPath}`);

        } catch (error) {
            console.error(`❌ Failed to connect to ${portPath}:`, error.message);
        }
    }

    processMessage(portPath, message) {
        if (!message) return;

        if (message.includes('_READY')) {
            console.log(`🟢 [${portPath}] ${message}`);
            
            // Extract button ID from message: "BUTTON_1_GREEN_READY"
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonId = parseInt(parts[1]);
                this.microbitMapping.set(buttonId, portPath);
                console.log(`📍 Mapped Button ${buttonId} to ${portPath}`);
            }
            
            this.emit('microbit-ready', { port: portPath, message, buttonId: parseInt(parts[1]) });
            
        } else if (message.includes('BUTTON_') && message.includes('_PRESSED')) {
            console.log(`🎯 [${portPath}] ${message}`);
            
            // Extract button number from "BUTTON_1_PRESSED"
            const buttonNum = parseInt(message.split('_')[1]) - 1; // Convert to 0-based
            
            if (buttonNum >= 0 && buttonNum < 4) {
                this.buttonStates[buttonNum] = true;
                const color = this.buttonColors[buttonNum];
                const position = this.buttonPositions[buttonNum];
                
                this.onButtonPress(buttonNum + 1, color, position);
            }
            
        } else if (message.includes('BUTTON_') && message.includes('_RELEASED')) {
            console.log(`🎯 [${portPath}] ${message}`);
            
            // Extract button number from "BUTTON_1_RELEASED"
            const buttonNum = parseInt(message.split('_')[1]) - 1;
            
            if (buttonNum >= 0 && buttonNum < 4) {
                this.buttonStates[buttonNum] = false;
                const color = this.buttonColors[buttonNum];
                const position = this.buttonPositions[buttonNum];
                
                this.onButtonRelease(buttonNum + 1, color, position);
            }
        } else if (message.includes('LED_') && message.includes('_CONFIRMED')) {
            // LED command confirmation: "LED_1_ON_CONFIRMED" or "LED_1_TOGGLE_CONFIRMED"
            console.log(`💡 [${portPath}] ${message}`);
            
            const parts = message.split('_');
            if (parts.length >= 3) {
                const buttonId = parseInt(parts[1]);
                const state = parts[2] === 'ON' || parts[2] === 'TOGGLE';
                
                // For TOGGLE, we need to flip the current state
                if (parts[2] === 'TOGGLE') {
                    this.ledStates[buttonId - 1] = !this.ledStates[buttonId - 1];
                } else {
                    this.ledStates[buttonId - 1] = state;
                }
                
                this.emit('led-confirmed', { buttonId, state: this.ledStates[buttonId - 1], port: portPath });
            }
        } else if (message.includes('PONG_')) {
            // Response to PING
            const buttonId = parseInt(message.split('_')[1]);
            console.log(`🏓 Pong received from Button ${buttonId}`);
        }
    }

    // LED Control Methods - Updated for minimal Microbit protocol
    async setLED(buttonNumber, state) {
        const portPath = this.microbitMapping.get(buttonNumber);
        
        if (!portPath) {
            console.error(`❌ No Microbit found for button ${buttonNumber}`);
            return false;
        }

        const connection = this.connections.get(portPath);
        if (!connection) {
            console.error(`❌ No connection found for ${portPath}`);
            return false;
        }

        try {
            // Send simple command that matches minimal Microbit code
            const command = `LED_${state ? 'ON' : 'OFF'}\n`;
            connection.port.write(command);
            console.log(`💡 Sent to Button ${buttonNumber} (${portPath}): ${command.trim()}`);
            
            // Update local state optimistically
            this.ledStates[buttonNumber - 1] = state;
            
            return true;
        } catch (error) {
            console.error(`❌ Error sending LED command to button ${buttonNumber}:`, error);
            return false;
        }
    }

    async setAllLEDs(state) {
        console.log(`💡 Setting ALL LEDs to ${state ? 'ON' : 'OFF'}`);
        
        const promises = [];
        for (let i = 1; i <= 4; i++) {
            promises.push(this.setLED(i, state));
        }
        
        const results = await Promise.all(promises);
        return results.every(result => result === true);
    }

    async flashLED(buttonNumber, times = 3, duration = 500) {
        console.log(`⚡ Flashing LED ${buttonNumber} ${times} times`);
        
        for (let i = 0; i < times; i++) {
            await this.setLED(buttonNumber, true);
            await this.delay(duration);
            await this.setLED(buttonNumber, false);
            if (i < times - 1) { // Don't delay after last flash
                await this.delay(duration);
            }
        }
    }

    async flashAllLEDs(times = 3, duration = 300) {
        console.log(`⚡ Flashing ALL LEDs ${times} times`);
        
        for (let i = 0; i < times; i++) {
            await this.setAllLEDs(true);
            await this.delay(duration);
            await this.setAllLEDs(false);
            if (i < times - 1) {
                await this.delay(duration);
            }
        }
    }

    async chaseLEDs(rounds = 2, speed = 200) {
        console.log(`🌈 Running LED chase pattern for ${rounds} rounds`);
        
        for (let round = 0; round < rounds; round++) {
            for (let i = 1; i <= 4; i++) {
                await this.setLED(i, true);
                await this.delay(speed);
                await this.setLED(i, false);
            }
        }
    }

    async breatheLEDs(cycles = 3) {
        console.log(`💨 Running LED breathing pattern for ${cycles} cycles`);
        
        for (let cycle = 0; cycle < cycles; cycle++) {
            // All on gradually (simulated with delays)
            await this.setAllLEDs(true);
            await this.delay(800);
            
            // All off gradually
            await this.setAllLEDs(false);
            await this.delay(800);
        }
    }

    // Random LED sequence methods - No changes needed, these work with simple LED commands
    async randomLEDSequence(count = 4, onDuration = 500, offDuration = 100, totalSequences = 1) {
        console.log(`🎲 Running random LED sequence: ${totalSequences} rounds of ${count} LEDs`);
        
        for (let sequence = 0; sequence < totalSequences; sequence++) {
            // Generate random order of LED numbers 1-4
            const ledOrder = this.generateRandomOrder(count);
            console.log(`🔀 Sequence ${sequence + 1}: ${ledOrder.join(' → ')}`);
            
            for (const ledNumber of ledOrder) {
                // Turn LED on
                await this.setLED(ledNumber, true);
                console.log(`💡 LED ${ledNumber} ON`);
                
                // Keep it on for specified duration
                await this.delay(onDuration);
                
                // Turn LED off
                await this.setLED(ledNumber, false);
                console.log(`💡 LED ${ledNumber} OFF`);
                
                // Brief pause before next LED (unless it's the last one)
                if (ledOrder.indexOf(ledNumber) < ledOrder.length - 1) {
                    await this.delay(offDuration);
                }
            }
            
            // Longer pause between sequences
            if (sequence < totalSequences - 1) {
                await this.delay(300);
            }
        }
        
        console.log('🎲 Random LED sequence complete');
    }

    generateRandomOrder(count = 4) {
        // Create array of LED numbers [1, 2, 3, 4]
        const leds = Array.from({length: count}, (_, i) => i + 1);
        
        // Fisher-Yates shuffle algorithm
        for (let i = leds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [leds[i], leds[j]] = [leds[j], leds[i]];
        }
        
        return leds;
    }

    async randomFlashSequence(sequences = 3, flashDuration = 500) {
        console.log(`⚡ Random flash sequence: ${sequences} different orders`);
        
        for (let i = 0; i < sequences; i++) {
            await this.randomLEDSequence(4, flashDuration, 50, 1);
            
            // Pause between sequences
            if (i < sequences - 1) {
                await this.delay(800);
            }
        }
    }

    async randomLEDGame(rounds = 5, speed = 600) {
        console.log(`🎮 Random LED Game: ${rounds} rounds, speed ${speed}ms`);
        
        for (let round = 1; round <= rounds; round++) {
            console.log(`🔄 Round ${round}/${rounds}`);
            
            // Get faster each round
            const currentSpeed = Math.max(200, speed - (round * 80));
            
            await this.randomLEDSequence(4, currentSpeed, 50, 1);
            
            // Brief pause between rounds
            if (round < rounds) {
                await this.delay(400);
            }
        }
        
        // Finish with all LEDs flash
        await this.flashAllLEDs(2, 200);
        console.log('🎮 Random LED Game complete!');
    }

    async simonSaysPattern(patternLength = 4, playbackSpeed = 800) {
        console.log(`🧠 Simon Says pattern: ${patternLength} steps`);
        
        // Generate random pattern
        const pattern = [];
        for (let i = 0; i < patternLength; i++) {
            pattern.push(Math.floor(Math.random() * 4) + 1);
        }
        
        console.log(`🎯 Pattern to remember: ${pattern.join(' → ')}`);
        
        // Play back the pattern
        for (let i = 0; i < pattern.length; i++) {
            const ledNumber = pattern[i];
            
            console.log(`🔹 Step ${i + 1}: LED ${ledNumber}`);
            
            await this.setLED(ledNumber, true);
            await this.delay(playbackSpeed);
            await this.setLED(ledNumber, false);
            
            // Pause between steps
            if (i < pattern.length - 1) {
                await this.delay(300);
            }
        }
        
        console.log('🧠 Pattern playback complete - can you remember it?');
        return pattern; // Return pattern so game can check player input
    }

    async randomCascade(waves = 3, waveSpeed = 200) {
        console.log(`🌊 Random cascade: ${waves} waves`);
        
        for (let wave = 0; wave < waves; wave++) {
            const order = this.generateRandomOrder(4);
            
            // Turn on LEDs in random order with cascade effect
            for (const ledNumber of order) {
                await this.setLED(ledNumber, true);
                await this.delay(waveSpeed);
            }
            
            // Brief pause with all on
            await this.delay(300);
            
            // Turn off LEDs in reverse order
            for (let i = order.length - 1; i >= 0; i--) {
                await this.setLED(order[i], false);
                await this.delay(waveSpeed);
            }
            
            // Pause between waves
            if (wave < waves - 1) {
                await this.delay(400);
            }
        }
        
        console.log('🌊 Random cascade complete');
    }

    async rhythmicRandomPattern(beats = 8, tempo = 600) {
        console.log(`🎵 Rhythmic random pattern: ${beats} beats at ${tempo}ms`);
        
        for (let beat = 0; beat < beats; beat++) {
            // Random LED or sometimes multiple LEDs
            const numLeds = Math.random() < 0.7 ? 1 : Math.random() < 0.9 ? 2 : 4;
            
            if (numLeds === 4) {
                // All LEDs
                await this.setAllLEDs(true);
                await this.delay(tempo * 0.6);
                await this.setAllLEDs(false);
            } else {
                // Random selection
                const selectedLeds = this.generateRandomOrder(4).slice(0, numLeds);
                
                // Turn on selected LEDs
                for (const led of selectedLeds) {
                    await this.setLED(led, true);
                }
                
                await this.delay(tempo * 0.6);
                
                // Turn off selected LEDs
                for (const led of selectedLeds) {
                    await this.setLED(led, false);
                }
            }
            
            // Rest between beats
            await this.delay(tempo * 0.4);
        }
        
        console.log('🎵 Rhythmic pattern complete');
    }

    // Game-specific LED patterns
    async gameStartPattern() {
        console.log('🎮 Game start LED pattern');
        await this.chaseLEDs(2, 150);
        await this.flashAllLEDs(2, 200);
    }

    async gameOverPattern() {
        console.log('🎮 Game over LED pattern');
        await this.setAllLEDs(true);
        await this.delay(1000);
        await this.flashAllLEDs(5, 100);
        await this.setAllLEDs(false);
    }

    async gameWinPattern() {
        console.log('🎮 Game win LED pattern');
        await this.chaseLEDs(3, 100);
        await this.breatheLEDs(2);
        await this.setAllLEDs(false);
    }

    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getLEDStates() {
        return [...this.ledStates];
    }

    getLEDState(buttonNumber) {
        return this.ledStates[buttonNumber - 1];
    }

    // Button event methods
    onButtonPress(buttonNumber, color, position) {
        console.log(`🎮 GAME EVENT: ${color} Button ${buttonNumber} (${position}) PRESSED!`);
        
        this.emit('button-press', {
            button: buttonNumber,
            color: color,
            position: position,
            state: 'pressed'
        });
    }

    onButtonRelease(buttonNumber, color, position) {
        console.log(`🎮 GAME EVENT: ${color} Button ${buttonNumber} (${position}) RELEASED!`);
        
        this.emit('button-release', {
            button: buttonNumber,
            color: color,
            position: position,
            state: 'released'
        });
    }

    getButtonStates() {
        return [...this.buttonStates];
    }

    getButtonState(buttonNumber) {
        return this.buttonStates[buttonNumber - 1];
    }

    // Add PING functionality for testing connections
    async pingMicrobit(buttonNumber) {
        const portPath = this.microbitMapping.get(buttonNumber);
        
        if (!portPath) {
            console.error(`❌ No Microbit found for button ${buttonNumber}`);
            return false;
        }

        const connection = this.connections.get(portPath);
        if (!connection) {
            console.error(`❌ No connection found for ${portPath}`);
            return false;
        }

        try {
            connection.port.write('PING\n');
            console.log(`🏓 Ping sent to Button ${buttonNumber}`);
            return true;
        } catch (error) {
            console.error(`❌ Error pinging button ${buttonNumber}:`, error);
            return false;
        }
    }

    async pingAllMicrobits() {
        console.log('🏓 Pinging all Microbits...');
        for (let i = 1; i <= 4; i++) {
            await this.pingMicrobit(i);
            await this.delay(100); // Small delay between pings
        }
    }

    disconnect() {
        console.log('🔌 Disconnecting all Microbits...');
        
        for (const [portPath, connection] of this.connections) {
            try {
                connection.port.close();
                console.log(`✅ Disconnected from ${portPath}`);
            } catch (error) {
                console.error(`Error disconnecting from ${portPath}:`, error);
            }
        }
        
        this.connections.clear();
        this.microbitMapping.clear();
    }

    startTestMode() {
        console.log('\n🧪 BUTTON & LED TEST MODE ACTIVE');
        console.log('Button layout: Green(L) → White → Red → Green(R)');
        console.log('Using minimal Microbit protocol for memory efficiency');
        console.log('All LED patterns generated by JavaScript controller');
        console.log('Listening for events...\n');

        this.on('button-press', (data) => {
            console.log(`✅ TEST: ${data.color} button ${data.button} pressed`);
        });

        this.on('button-release', (data) => {
            console.log(`⬆️ TEST: ${data.color} button ${data.button} released`);
        });

        this.on('led-confirmed', (data) => {
            console.log(`💡 TEST: LED ${data.buttonId} confirmed ${data.state ? 'ON' : 'OFF'}`);
        });
    }
}

module.exports = MicrobitArcadeController;