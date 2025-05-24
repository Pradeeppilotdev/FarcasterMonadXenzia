// Global variables
let snake, moyaki, cursors, score = 0, scoreText;
let snakeSegments = [];
let lastDirection = 'right';
let gameOver = false;
let gameOverText;
let isPaused = true;
let walletConnected = false;

// Add Farcaster SDK reference
let sdk;

// Grid settings
const GRID_SIZE = 10;
let moveTime = 0;
const MOVE_DELAY = 100;
let moveInterpolation = 1;
const MOVE_SPEED = 0.15;

// Add audio variables at the top
let backgroundMusic = null;
let eatSound = null;
let chogSound = null;

// Add these constants at the top with other global variables
const BASE_SCALE = 0.15;
const MIN_SCALE = 0.05;
const SCALE_THRESHOLD = 500;
const SCALE_FACTOR = 0.02;
const BASE_MOVE_DELAY = 100;
const MIN_MOVE_DELAY = 40;
const SPEED_THRESHOLD = 200;
const SPEED_INCREASE = 10;

// Add a global for selected character
let selectedCharacter = null;

// Add globals for fatnadsjohn logic
let fatnadsjohn = null;
let fatnadsjohnActive = false;
let fatnadsjohnTimer = 0;
let fatnadsjohnAppearTime = 0;
let fatnadsjohnMoveDir = { x: 0, y: 0 };
let fatnadsjohnVanishTimeout = null;
let fatnadsjohnNextAppear = 0;

async function initializeFarcaster() {
    try {
        console.log('Initializing Farcaster...');
        const isMiniApp = await window.farcasterSDK?.isInMiniApp();
        console.log('Is Mini App:', isMiniApp);

        if (isMiniApp) {
            const sdk = window.farcasterSDK;
            await sdk.actions.ready();
            
            if (sdk.wallet.ethProvider) {
                console.log('Setting up Farcaster wallet provider');
                window.ethereum = sdk.wallet.ethProvider;
                return await initializeContract(sdk.wallet.ethProvider);
            }
        }
        return false;
    } catch (error) {
        console.error('Error initializing Farcaster:', error);
        return false;
    }
}

// Initialize Farcaster and contract
async function initializeFarcasterAndContract() {
    try {
        console.log('Initializing Farcaster and contract...');
        const success = await window.initializeFarcaster();
        if (success) {
            console.log('Farcaster and contract initialized successfully');
            return true;
        } else {
            console.error('Failed to initialize Farcaster and contract');
            return false;
        }
    } catch (error) {
        console.error('Error initializing Farcaster and contract:', error);
        return false;
    }
}

function preload() {
    this.load.image('keonehon', 'snake-game/assets/keonehon.png');
    this.load.image('mouch', 'snake-game/assets/mouch.png');
    this.load.image('vans', 'snake-game/assets/vans.png');
    this.load.image('molandak', 'snake-game/assets/molandak3.png'); // default
    this.load.image('moyaki', 'snake-game/assets/moyaki3.png');
    this.load.image('chog', 'snake-game/assets/chog.png');
    this.load.image('salmonad', 'snake-game/assets/salmonad.png'); // new special food
    this.load.image('fatnadsjohn', 'snake-game/assets/fatnadsjohn.png');

    // Load audio files
    this.load.audio('bgMusic', 'snake-game/assets/background-music.mp3');
    this.load.audio('eat', 'snake-game/assets/eat.mp3');
    this.load.audio('chog-eat', 'snake-game/assets/chog-eat.mp3');
}

function create() {
    const scene = this;
    // Always reset character selection on scene start
    selectedCharacter = null;
    console.log('Phaser create() called, showing character selection UI');
    // Create a clean, modern background
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0a192f, 1);
    graphics.fillRect(0, 0, this.scale.width, this.scale.height);
    graphics.lineStyle(1, 0x64ffda, 0.15);
    for (let x = 0; x <= this.scale.width; x += GRID_SIZE) {
        graphics.moveTo(x, 0);
        graphics.lineTo(x, this.scale.height);
    }
    for (let y = 0; y <= this.scale.height; y += GRID_SIZE) {
        graphics.moveTo(0, y);
        graphics.lineTo(this.scale.width, y);
    }
    graphics.strokePath();
    // Character selection UI
    if (!selectedCharacter) {
        console.log('Rendering character selection UI');
        const connectBtn = document.getElementById('connectButton');
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        const spacing = Math.min(this.scale.width / 5, 140);
        const charKeys = [
            { key: 'keonehon', label: 'Keonehon' },
            { key: 'mouch', label: 'Mouch' },
            { key: 'vans', label: 'Vans' },
            { key: 'molandak', label: 'molandak' }
        ];
        const charSprites = [];
        // Add label
        const selectText = this.add.text(centerX, centerY - spacing, 'Choose Your Character', {
            fontSize: Math.max(22, Math.floor(this.scale.width / 16)) + 'px',
            fill: '#fff',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        // Add character sprites
        charKeys.forEach((char, i) => {
            const sprite = this.add.sprite(centerX + (i - 1.5) * spacing, centerY, char.key);
            sprite.setScale(Math.max(0.12, Math.min(0.18, this.scale.width / 1200)));
            const radius = (sprite.width * sprite.scaleX) / 2;
            sprite.setInteractive(new Phaser.Geom.Circle(sprite.width / 2, sprite.height / 2, radius), Phaser.Geom.Circle.Contains);
            this.add.text(sprite.x, sprite.y + 0.15 * this.scale.height, char.label, {
                fontSize: Math.max(14, Math.floor(this.scale.width / 40)) + 'px',
                fill: '#64ffda',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                align: 'center'
            }).setOrigin(0.5);
            sprite.on('pointerdown', () => {
                selectedCharacter = char.key;
                selectText.destroy();
                charSprites.forEach(s => s.destroy());
                scene.children.list.filter(obj => obj.type === 'Text' && obj.y > centerY).forEach(obj => obj.destroy());
                if (typeof pauseText !== 'undefined' && pauseText) pauseText.destroy();
                pauseText = scene.add.text(this.scale.width / 2, this.scale.height / 2, 'Press SPACE to Start', {
                    fontSize: Math.max(18, Math.floor(this.scale.width / 20)) + 'px',
                    fill: '#64ffda',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    align: 'center'
                }).setOrigin(0.5);
                pauseText.setVisible(true);
                startGame.call(scene);
            });
            charSprites.push(sprite);
        });
        return;
    }
    // If already selected, start game
    startGame.call(this);

    fatnadsjohn = null;
    fatnadsjohnActive = false;
    fatnadsjohnTimer = 0;
    fatnadsjohnAppearTime = 0;
    fatnadsjohnMoveDir = { x: 0, y: 0 };
    fatnadsjohnVanishTimeout = null;
    fatnadsjohnNextAppear = this.time.now + Phaser.Math.Between(120000, 180000); // 2-3 min
}

function startGame() {
    const centerX = this.scale.width / 2;
    
    console.log('Starting game');
    
    // Initialize game elements
    snake = this.add.sprite(200, 150, selectedCharacter || 'molandak');
    snake.setScale(BASE_SCALE);
    snakeSegments = [snake];

    // Initialize food
    moyaki = this.add.sprite(100, 100, 'moyaki');
    moyaki.setScale(BASE_SCALE);

    // Add score text with smaller font
    scoreText = this.add.text(8, 8, 'Score: 0', { 
        fontSize: '20px',
        fill: '#fff' 
    });

    // Setup keyboard controls
    cursors = this.input.keyboard.createCursorKeys();

    // Initialize direction
    snake.direction = { x: 1, y: 0 };
    lastDirection = 'right';

    // Initialize audio
    if (!backgroundMusic) {
        backgroundMusic = this.sound.add('bgMusic', {
            volume: 0.45,
            loop: true
        });
    }
    if (!eatSound) {
        eatSound = this.sound.add('eat', {
            volume: 1.5,
            rate: 1.95
        });
    }
    if (!chogSound) {
        chogSound = this.sound.add('chog-eat', {
            volume: 3.5,
            rate: 1.25
        });
    }

    // Add pause/start text
    if (pauseText) {
        pauseText.setText('Press SPACE to Start');
        pauseText.setVisible(true);
    }

    // Add space key for pause/resume
    this.input.keyboard.on('keydown-SPACE', function() {
        togglePause(this.scene);
        if (!isPaused && backgroundMusic && !backgroundMusic.isPlaying) {
            backgroundMusic.play();
        }
    }, this);

    // Set initial game state
    isPaused = true;
    gameOver = false;
    score = 0;
    moveTime = 0;
    moveInterpolation = 1;
}

function togglePause(scene) {
    // Only allow toggling if game is not over
    if (gameOver) return;
    
    isPaused = !isPaused;
    
    if (isPaused) {
        // Show pause text
        pauseText.setText('PAUSED\nPress SPACE to Resume');
        pauseText.setVisible(true);
        // Pause the music
        if (backgroundMusic && backgroundMusic.isPlaying) {
            backgroundMusic.pause();
        }
    } else {
        // Hide pause text when game is running
        pauseText.setVisible(false);
        // Resume the music
        if (backgroundMusic && !backgroundMusic.isPlaying) {
            backgroundMusic.resume();
        }
    }
}

function update(time) {
    // Store scene context
    const scene = this;

    // Don't update if game is over or paused
    if (gameOver || isPaused) return;

    // Handle keyboard input
    if (cursors.left.isDown && lastDirection !== 'right') {
        snake.direction = { x: -1, y: 0 };
        lastDirection = 'left';
    }
    else if (cursors.right.isDown && lastDirection !== 'left') {
        snake.direction = { x: 1, y: 0 };
        lastDirection = 'right';
    }
    else if (cursors.up.isDown && lastDirection !== 'down') {
        snake.direction = { x: 0, y: -1 };
        lastDirection = 'up';
    }
    else if (cursors.down.isDown && lastDirection !== 'up') {
        snake.direction = { x: 0, y: 1 };
        lastDirection = 'down';
    }

    // Smooth movement between grid positions
    if (moveInterpolation < 1) {
        moveInterpolation += MOVE_SPEED;
        
        // Apply smooth movement to all segments
        for (let i = 0; i < snakeSegments.length; i++) {
            const segment = snakeSegments[i];
            if (segment.targetX !== undefined && segment.targetY !== undefined) {
                segment.x = segment.startX + (segment.targetX - segment.startX) * moveInterpolation;
                segment.y = segment.startY + (segment.targetY - segment.startY) * moveInterpolation;
            }
        }
        
        // If we've reached the target position, complete the movement
        if (moveInterpolation >= 1) {
            moveInterpolation = 1;
            for (let i = 0; i < snakeSegments.length; i++) {
                const segment = snakeSegments[i];
                if (segment.targetX !== undefined) {
                    segment.x = segment.targetX;
                    segment.y = segment.targetY;
                }
            }
        }
    }

    // Calculate current move delay based on score
    const currentMoveDelay = calculateMoveDelay(score);

    // Move snake on grid when interpolation is complete
    if (time >= moveTime && moveInterpolation >= 1) {
        moveTime = time + currentMoveDelay;  // Use the calculated delay
        moveInterpolation = 0;

        // Store previous positions
        let prevX = snake.x;
        let prevY = snake.y;
        
        // Set start positions for interpolation
        for (let i = 0; i < snakeSegments.length; i++) {
            snakeSegments[i].startX = snakeSegments[i].x;
            snakeSegments[i].startY = snakeSegments[i].y;
        }

        // Calculate target position for head
        snake.targetX = prevX + snake.direction.x * GRID_SIZE;
        snake.targetY = prevY + snake.direction.y * GRID_SIZE;

        // Calculate target positions for body segments
        for (let i = 1; i < snakeSegments.length; i++) {
            const tempX = snakeSegments[i].x;
            const tempY = snakeSegments[i].y;
            snakeSegments[i].targetX = prevX;
            snakeSegments[i].targetY = prevY;
            prevX = tempX;
            prevY = tempY;
        }

        // Check wall collision using target position
        if (snake.targetX < 0 || snake.targetX >= 345 || snake.targetY < 0 || snake.targetY >= 295) {
            endGame(scene);
            return;
        }

        // Check self collision using target position
        for (let i = 1; i < snakeSegments.length; i++) {
            if (snake.targetX === snakeSegments[i].targetX && snake.targetY === snakeSegments[i].targetY) {
                endGame(scene);
                return;
            }
        }

        // Check food collision using target position
        if (Math.abs(snake.targetX - moyaki.x) < GRID_SIZE && Math.abs(snake.targetY - moyaki.y) < GRID_SIZE) {
            // Add new segment
            const lastSegment = snakeSegments[snakeSegments.length - 1];
            const newSegment = scene.add.sprite(lastSegment.x, lastSegment.y, selectedCharacter || 'molandak');
            
            // Calculate new scale based on current score
            const currentScale = calculateScale(score);
            newSegment.setScale(currentScale);
            
            // Update scale of all existing segments and food
            snakeSegments.forEach(segment => segment.setScale(currentScale));
            moyaki.setScale(currentScale);
            
            newSegment.startX = lastSegment.x;
            newSegment.startY = lastSegment.y;
            newSegment.targetX = lastSegment.x;
            newSegment.targetY = lastSegment.y;
            snakeSegments.push(newSegment);

            // Move food to new grid position
            moyaki.x = Phaser.Math.Between(2, 26) * GRID_SIZE;
            moyaki.y = Phaser.Math.Between(2, 21) * GRID_SIZE;

            // Update score and handle special food
            if (moyaki.texture.key === 'chog') {
                chogSound.play();
                score += 20;
                moyaki.setTexture('moyaki');
            } else if (moyaki.texture.key === 'salmonad') {
                eatSound.play();
                score += 30;
                moyaki.setTexture('moyaki');
            } else {
                eatSound.play();
                score += 10;
                // Check if next food should be chog (at score multiples of 100)
                if (score % 100 === 0) {
                    moyaki.setTexture('chog');
                }
                // Check if next food should be salmonad (at score multiples of 530)
                if (score % 530 === 0) {
                    moyaki.setTexture('salmonad');
                }
            }
            
            scoreText.setText('Score: ' + score);
        }
    }

    // --- FATNADSJOHN LOGIC ---
    if (!fatnadsjohnActive && time > fatnadsjohnNextAppear) {
        // Spawn at random edge
        const edges = ['top', 'bottom', 'left', 'right'];
        const edge = Phaser.Utils.Array.GetRandom(edges);
        let x, y, dir;
        if (edge === 'top') {
            x = Phaser.Math.Between(0, 345);
            y = 0;
            dir = { x: 0, y: 1 };
        } else if (edge === 'bottom') {
            x = Phaser.Math.Between(0, 345);
            y = 295;
            dir = { x: 0, y: -1 };
        } else if (edge === 'left') {
            x = 0;
            y = Phaser.Math.Between(0, 295);
            dir = { x: 1, y: 0 };
        } else {
            x = 345;
            y = Phaser.Math.Between(0, 295);
            dir = { x: -1, y: 0 };
        }
        fatnadsjohn = this.add.sprite(x, y, 'fatnadsjohn');
        fatnadsjohn.setScale(0.22);
        fatnadsjohnActive = true;
        fatnadsjohnAppearTime = time;
        fatnadsjohnMoveDir = dir;
        // Vanish after 5 seconds
        fatnadsjohnVanishTimeout = setTimeout(() => {
            if (fatnadsjohn) fatnadsjohn.destroy();
            fatnadsjohn = null;
            fatnadsjohnActive = false;
            fatnadsjohnNextAppear = time + Phaser.Math.Between(120000, 180000); // 2-3 min
        },  10000);
    }
    if (fatnadsjohnActive && fatnadsjohn) {
        // Move more slowly
        fatnadsjohn.x += fatnadsjohnMoveDir.x * 1; // reduced speed
        fatnadsjohn.y += fatnadsjohnMoveDir.y * 1;
        // Check collision with snake head
        if (Math.abs((snake.x || 0) - fatnadsjohn.x) < GRID_SIZE && Math.abs((snake.y || 0) - fatnadsjohn.y) < GRID_SIZE) {
            if (fatnadsjohnVanishTimeout) clearTimeout(fatnadsjohnVanishTimeout);
            if (fatnadsjohn) fatnadsjohn.destroy();
            fatnadsjohn = null;
            fatnadsjohnActive = false;
            endGame(this);
            return;
        }
    }
}

// End game function
async function endGame(scene) {
    if (gameOver) return;
    gameOver = true;
    isPaused = true;

    // Stop all game elements
    if (snake) {
        snake.destroy();
        snake = null;
    }
    if (moyaki) {
        moyaki.destroy();
        moyaki = null;
    }
    if (scoreText) {
        scoreText.destroy();
        scoreText = null;
    }
    
    // Stop all sounds
    if (eatSound) eatSound.stop();
    if (chogSound) chogSound.stop();
    if (backgroundMusic) backgroundMusic.stop();
    
    // Create game over container
    const gameOverContainer = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
    
    // Show game over text
    gameOverText = scene.add.text(0, -60, 'Game Over!', {
        fontSize: Math.max(20, Math.floor(scene.scale.width / 20)) + 'px',
        fill: '#fff',
        align: 'center'
    }).setOrigin(0.5);
    
    // Add score text
    const finalScoreText = scene.add.text(0, -20, `Score: ${score}`, {
        fontSize: Math.max(16, Math.floor(scene.scale.width / 25)) + 'px',
        fill: '#64ffda',
        align: 'center'
    }).setOrigin(0.5);

    // Add Share Score button
    const shareButton = scene.add.text(0, 40, 'Share Score', {
        fontSize: Math.max(14, Math.floor(scene.scale.width / 30)) + 'px',
        fill: '#64ffda',
        backgroundColor: '#1a1a1a',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Add hover effect for Share button
    shareButton.on('pointerover', () => {
        shareButton.setStyle({ fill: '#64ffda' });
    });
    shareButton.on('pointerout', () => {
        shareButton.setStyle({ fill: '#fff' });
    });

    // Add click handler for Share button
    shareButton.on('pointerup', async () => {
        const currentScore = score; // Use the final score
        const shareText = `🐍 Just scored ${currentScore} on Monad Xenzia! Can you beat my score? Play now and join the fun! 🎮`;
        const gameUrl = 'https://farcaster.xyz/miniapps/FIoBBJFztuQl/monad-xenzia'; // Replace with your game URL

        if (window.farcasterSDK && window.farcasterSDK.composeCast) {
            // Use Farcaster SDK composeCast in mini-app
            try {
                await window.farcasterSDK.composeCast({
                    text: shareText,
                    embeds: [{ url: gameUrl }],
                    close: true // Close the compose window after casting
                });
                console.log('Score shared via Farcaster SDK');
            } catch (error) {
                console.error('Error sharing via Farcaster SDK:', error);
                // Fallback to opening URL if SDK fails
                const fallbackUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(gameUrl)}`;
                window.open(fallbackUrl, '_blank');
            }
        } else {
            // Fallback to opening Warpcast URL in a new tab
            const fallbackUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(gameUrl)}`;
            window.open(fallbackUrl, '_blank');
        }
    });

    // Add restart button
    const restartButton = scene.add.text(0, 90, 'Play Again', {
        fontSize: Math.max(14, Math.floor(scene.scale.width / 30)) + 'px',
        fill: '#64ffda',
        backgroundColor: '#1a1a1a',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive();

    // Add hover effect for Restart button
    restartButton.on('pointerover', () => {
        restartButton.setStyle({ fill: '#fff' });
    });
    restartButton.on('pointerout', () => {
        restartButton.setStyle({ fill: '#64ffda' });
    });

    // Add click handler for restart
    restartButton.on('pointerdown', () => {
        restartGame(scene);
    });

    // Add all elements to container
    gameOverContainer.add([gameOverText, finalScoreText, shareButton, restartButton]);

    if (pauseText) {
        pauseText.setVisible(false);
    }

    // Submit score if wallet is connected
    if (window.walletConnected && window.contract) {
        try {
            console.log('Attempting to submit score:', score);
            
            // Check if we're in a Farcaster mini app
            const isMiniApp = await window.farcasterSDK?.isInMiniApp();
            console.log('Is Farcaster Mini App:', isMiniApp);

            // Ensure we have a valid ethereum provider
            if (!window.ethereum) {
                throw new Error('No Ethereum provider found');
            }

            // Get the current account
            let accounts;
            try {
                if (isMiniApp && window.farcasterSDK?.wallet?.ethProvider) {
                    // Use Farcaster wallet
                    accounts = await window.farcasterSDK.wallet.ethProvider.request({ method: 'eth_accounts' });
                } else {
                    // Use regular wallet
                    accounts = await window.ethereum.request({ method: 'eth_accounts' });
                }
            } catch (error) {
                console.error('Error getting accounts:', error);
                throw new Error('Failed to get wallet accounts');
            }

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }

            const currentAccount = accounts[0];
            console.log('Current account:', currentAccount);
            
            // Verify contract is initialized
            if (!window.contract || !window.contract.interface) {
                throw new Error('Contract not properly initialized');
            }

            // Create the transaction data
            const data = window.contract.interface.encodeFunctionData('submitScore', [score]);
            
            // Send the transaction using the appropriate provider
            const txHash = await (isMiniApp ? 
                window.farcasterSDK.wallet.ethProvider.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: currentAccount,
                        to: window.contract.address,
                        data: data,
                        value: '0x0',
                        gas: '0x30d40'
                    }]
                }) :
                window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: currentAccount,
                        to: window.contract.address,
                        data: data,
                        value: '0x0',
                        gas: '0x30d40'
                    }]
                })
            );
            
            console.log('Transaction sent:', txHash);
            finalScoreText.setText(`Score: ${score}\nSubmitted!`);
            
            // Try to update leaderboard
            if (typeof updateLeaderboard === 'function') {
                try {
                    await updateLeaderboard();
                } catch (error) {
                    console.error('Error updating leaderboard:', error);
                }
            }
        } catch (error) {
            console.error('Error submitting score:', error);
            if (error.message.includes('user rejected')) {
                finalScoreText.setText(`Score: ${score}\nTransaction rejected`);
            } else if (error.message.includes('No accounts found')) {
                finalScoreText.setText(`Score: ${score}\nPlease reconnect wallet`);
                // Try to reconnect wallet
                try {
                    await setWalletConnected();
                } catch (reconnectError) {
                    console.error('Error reconnecting wallet:', reconnectError);
                }
            } else {
                finalScoreText.setText(`Score: ${score}\nError submitting`);
            }
        }
    } else {
        finalScoreText.setText(`Score: ${score}\nConnect wallet to submit`);
    }
}

// Update the restartGame function
function restartGame(scene) {
    console.log('restartGame called');
    // Reset game state
    gameOver = false;
    isPaused = true;
    score = 0;
    lastDirection = 'right';
    moveTime = 0;
    moveInterpolation = 1;

    // Update score display only if scoreText object exists
    if (scoreText) {
        scoreText.setText('Score: 0');
    }

    // Clear snake segments
    // Ensure snake object exists before accessing snakeSegments
    if (snake) {
        for (let i = 1; i < snakeSegments.length; i++) {
            if (snakeSegments[i]) {
                 snakeSegments[i].destroy();
            }
        }
        snakeSegments = [snake];

        // Reset snake position
        const centerX = scene.scale.width / 2;
        const centerY = scene.scale.height / 2;
        snake.x = centerX;
        snake.y = centerY;
        snake.startX = centerX;
        snake.startY = centerY;
        snake.targetX = centerX;
        snake.targetY = centerY;
        snake.direction = { x: 1, y: 0 };
         // Reset snake texture to selectedCharacter
        snake.setTexture(selectedCharacter || 'molandak');
    } else {
        // If snake object doesn't exist, we might need to re-create it
        // This case should ideally not happen if endGame properly destroys
        // and create is called on scene restart, but adding a log just in case.
        console.warn('Snake object is null in restartGame. Scene might need full restart.');
        // Consider a full scene restart here if this becomes an issue
        scene.scene.restart();
        return;
    }

    // Reset food position
    if (moyaki) {
        moyaki.x = centerX - 100;
        moyaki.y = centerY - 100;
        moyaki.setTexture('moyaki');
    } else {
         console.warn('Moyaki object is null in restartGame.');
    }


    // Clear game over text
    if (gameOverText) {
        gameOverText.destroy();
        gameOverText = null;
    }

    // Show start message
    // Check if wallet is connected to show the correct start message
    // Use the global walletConnected flag from blockchain.js
    const walletInfo = document.getElementById('walletInfo');
    const isConnected = walletInfo && walletInfo.textContent.startsWith('Connected:');

    if (pauseText) {
        if (isConnected) {
             pauseText.setText('Press SPACE to Start');
        } else {
             pauseText.setText('Connect wallet to submit score\nPress SPACE to Start');
        }
        pauseText.setVisible(true);
    } else {
        // If pauseText is null, it might mean the scene was fully reset or there's an issue
        console.warn('pauseText object is null in restartGame.');
        // This might require re-creating the pause text here or ensuring full scene restart.
        // For now, just logging.
    }


    // Stop any playing music
    if (backgroundMusic && backgroundMusic.isPlaying) {
        backgroundMusic.stop();
    }

    // Make sure the game is ready for new input
    // This was already added in the previous step, ensuring it remains.
    scene.input.enabled = true;

    // Reset all scales to base scale
    // Ensure snakeSegments and moyaki exist before scaling
    if (snakeSegments) {
        snakeSegments.forEach(segment => {
             if (segment) segment.setScale(BASE_SCALE);
        });
    }
    if (moyaki) {
        moyaki.setScale(BASE_SCALE);
    }


    // Reset fatnadsjohn state
    if (fatnadsjohnVanishTimeout) clearTimeout(fatnadsjohnVanishTimeout);
    if (fatnadsjohn) fatnadsjohn.destroy();
    fatnadsjohn = null;
    fatnadsjohnActive = false;
    fatnadsjohnTimer = 0;
    fatnadsjohnAppearTime = 0;
    fatnadsjohnMoveDir = { x: 0, y: 0 };
    fatnadsjohnVanishTimeout = null;
    // Re-schedule the next appearance
    if (scene.time) {
        fatnadsjohnNextAppear = scene.time.now + Phaser.Math.Between(120000, 180000);
    } else {
        console.warn('Phaser scene time object is null in restartGame. Cannot reschedule fatnadsjohn.');
        fatnadsjohnNextAppear = Infinity; // Prevent future appearances if time is not available
    }


    // Add listener for spacebar to start the game
    // Remove existing SPACE listener first to avoid duplicates
    scene.input.keyboard.off('keydown-SPACE');
    scene.input.keyboard.once('keydown-SPACE', startGame, scene);

    console.log('Game state reset, ready to start.');

}

// Make sure restartGame is available globally
window.restartGame = restartGame;

// Update the setWalletConnected function
async function setWalletConnected() {
    try {
        // First check if we're in a Farcaster mini app
        const isMiniApp = await window.farcasterSDK?.isInMiniApp();
        console.log('Is Farcaster Mini App:', isMiniApp);

        if (isMiniApp && window.farcasterSDK?.wallet?.ethProvider) {
            console.log('Using Farcaster wallet provider');
            window.ethereum = window.farcasterSDK.wallet.ethProvider;
        } else if (window.ethereum) {
            console.log('Using browser wallet provider');
            window.ethereum = window.ethereum;
        } else {
            throw new Error('No Ethereum provider found');
        }

        // Request accounts if not already connected
        let accounts;
        try {
            accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (!accounts || accounts.length === 0) {
                accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            }
        } catch (error) {
            console.error('Error requesting accounts:', error);
            throw new Error('Failed to get wallet accounts');
        }

        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found');
        }

        // Store the current account
        const currentAccount = accounts[0];
        console.log('Connected account:', currentAccount);

        // Set up account change listener only if not in Farcaster
        if (!isMiniApp) {
            window.ethereum.on('accountsChanged', async (newAccounts) => {
                if (newAccounts.length === 0) {
                    // User disconnected their wallet
                    walletConnected = false;
                    window.walletConnected = false;
                    if (pauseText) {
                        pauseText.setText('Connect wallet to submit score\nPress SPACE to Start');
                    }
                } else {
                    // User switched accounts
                    await initializeContract(window.ethereum);
                }
            });

            // Set up chain change listener only if not in Farcaster
            window.ethereum.on('chainChanged', async (chainId) => {
                const decimal = parseInt(chainId, 16);
                if (decimal !== 10143) { // Monad Testnet
                    walletConnected = false;
                    window.walletConnected = false;
                    if (pauseText) {
                        pauseText.setText('Please switch to Monad Testnet\nPress SPACE to Start');
                    }
                } else {
                    await initializeContract(window.ethereum);
                }
            });
        }

        walletConnected = true;
        window.walletConnected = true;
        
        // Initialize contract using blockchain.js
        const success = await window.initializeContract(window.ethereum);
        if (!success) {
            throw new Error('Failed to initialize contract');
        }
        
        // Update pause text if it exists
        if (pauseText) {
            pauseText.setText('Press SPACE to Start');
            pauseText.setVisible(true);
        }
        
        // Reset game state
        isPaused = true;
        gameOver = false;
        
        return true;
    } catch (error) {
        console.error('Error initializing wallet:', error);
        walletConnected = false;
        window.walletConnected = false;
        if (pauseText) {
            pauseText.setText('Error connecting wallet\nPress SPACE to Start');
            pauseText.setVisible(true);
        }
        return false;
    }
}

// Add this function to check wallet connection status
function checkWalletConnection() {
    if (window.ethereum && window.ethereum.selectedAddress) {
        setWalletConnected();
    }
}

// Add this function to calculate current scale based on score
function calculateScale(currentScore) {
    if (currentScore < SCALE_THRESHOLD) return BASE_SCALE;
    
    const reduction = Math.floor(currentScore / SCALE_THRESHOLD) * SCALE_FACTOR;
    const newScale = BASE_SCALE - reduction;
    return Math.max(newScale, MIN_SCALE); // Don't go smaller than MIN_SCALE
}

// Add this function to calculate move delay based on score
function calculateMoveDelay(currentScore) {
    if (currentScore < SPEED_THRESHOLD) return BASE_MOVE_DELAY;
    
    const reduction = Math.floor(currentScore / SPEED_THRESHOLD) * SPEED_INCREASE;
    return Math.max(BASE_MOVE_DELAY - reduction, MIN_MOVE_DELAY);
}

// Set Phaser config to fixed 320x295
let config = {
    type: Phaser.WEBGL,
    width: 345,
    height: 295,
    backgroundColor: '#2d2d2d',
    parent: 'game',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Initialize Phaser after DOM loads (no resize handler needed)
document.addEventListener('DOMContentLoaded', function() {
    if (window.game && typeof window.game.destroy === 'function') {
        window.game.destroy(true);
    }
    window.game = new Phaser.Game(config);
});

