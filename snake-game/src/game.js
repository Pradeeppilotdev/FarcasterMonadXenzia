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
const GRID_SIZE = 20;
let moveTime = 0;
const MOVE_DELAY = 100;
let moveInterpolation = 1;
const MOVE_SPEED = 0.15;

// Add audio variables at the top
let backgroundMusic = null;
let eatSound = null;
let chogSound = null;

// Add these constants at the top with other global variables
const BASE_SCALE = 0.25;
const MIN_SCALE = 0.08;
const SCALE_THRESHOLD = 500; // Points at which scaling starts
const SCALE_FACTOR = 0.03; // How much to reduce scale per threshold
const BASE_MOVE_DELAY = 100;    // Starting speed (higher = slower)
const MIN_MOVE_DELAY = 40;      // Maximum speed (lower = faster)
const SPEED_THRESHOLD = 200;    // Points at which speed increases

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

// Add contract constants at the top
const CONTRACT_ADDRESS = '0x2dE8C67B2010a141d245E3a128F9b90bFdfDDDf8';
const CONTRACT_ABI = [
    // Events
    "event ScoreSubmitted(address indexed player, uint256 score)",
    // Functions
    "function submitScore(uint256 score) external",
    "function getHighScore(address player) external view returns (uint256)",
    "function getHighScoreTimestamp(address player) external view returns (uint256)",
    "function getLatestScore(address player) external view returns (uint256)",
    "function getTotalPlayers() external view returns (uint256)",
    "function getTotalScores() external view returns (uint256)",
    "function getTopScores(uint256 n) external view returns (tuple(address player, uint256 score, uint256 timestamp)[])",
    "function getPlayerScores(address player) external view returns (tuple(address player, uint256 score, uint256 timestamp)[])"
];

async function initializeFarcaster() {
    try {
        // Check if we're in a Farcaster mini app
        const isMiniApp = await window.farcasterSDK.isInMiniApp();
        if (isMiniApp) {
            sdk = window.farcasterSDK;
            
            // Hide splash screen when game is ready
            await sdk.actions.ready();
            
            // Get Farcaster context
            const context = await sdk.context;
            console.log('Farcaster context:', context);
            
            // Use Farcaster's wallet provider
            if (sdk.wallet.ethProvider) {
                window.ethereum = sdk.wallet.ethProvider;
                walletConnected = true;
                if (pauseText) {
                    pauseText.setText('Press SPACE to Start');
                }
            }
        }
    } catch (error) {
        console.error('Error initializing Farcaster:', error);
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
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = 'Disabled';
            connectBtn.style.background = '#ffb3b3';
            connectBtn.style.color = '#fff';
            connectBtn.style.opacity = '0.7';
            connectBtn.style.cursor = 'none';
        }
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
            sprite.setScale(Math.max(0.18, Math.min(0.28, this.scale.width / 1200)));
            const radius = (sprite.width * sprite.scaleX) / 2;
            sprite.setInteractive(new Phaser.Geom.Circle(sprite.width / 2, sprite.height / 2, radius), Phaser.Geom.Circle.Contains);
            this.add.text(sprite.x, sprite.y + 0.18 * this.scale.height, char.label, {
                fontSize: Math.max(16, Math.floor(this.scale.width / 32)) + 'px', fill: '#64ffda', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', align: 'center'
            }).setOrigin(0.5);
            sprite.on('pointerdown', () => {
                selectedCharacter = char.key;
                if (connectBtn) {
                    connectBtn.disabled = false;
                    connectBtn.textContent = 'Connect Wallet';
                    connectBtn.style.background = '';
                    connectBtn.style.color = '';
                    connectBtn.style.opacity = '';
                    connectBtn.style.cursor = '';
                    connectBtn.onclick = async () => {
                        try {
                            // Check if wallet is already connected
                            if (window.walletConnected) {
                                console.log('Wallet already connected');
                                walletConnected = true;
                                startGame.call(scene);
                                return;
                            }
                            
                            const connected = await setWalletConnected();
                            if (connected) {
                                startGame.call(scene);
                            } else {
                                console.error('Failed to connect wallet');
                                if (pauseText) {
                                    pauseText.setText('Failed to connect wallet');
                                    pauseText.setVisible(true);
                                }
                            }
                        } catch (error) {
                            console.error('Error connecting wallet:', error);
                            if (pauseText) {
                                pauseText.setText('Error connecting wallet');
                                pauseText.setVisible(true);
                            }
                        }
                    };
                }
                selectText.destroy();
                charSprites.forEach(s => s.destroy());
                scene.children.list.filter(obj => obj.type === 'Text' && obj.y > centerY).forEach(obj => obj.destroy());
                if (typeof pauseText !== 'undefined' && pauseText) pauseText.destroy();
                pauseText = scene.add.text(this.scale.width / 2, this.scale.height / 2, 'Connect Wallet to Play', {
                    fontSize: Math.max(18, Math.floor(this.scale.width / 20)) + 'px',
                    fill: '#64ffda',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    align: 'center'
                }).setOrigin(0.5);
                pauseText.setVisible(true);
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
    
    // Check both local and global wallet state
    if (!walletConnected && !window.walletConnected) {
        console.log('Wallet not connected, cannot start game');
        if (pauseText) {
            pauseText.setText('Connect Wallet to Play');
            pauseText.setVisible(true);
        }
        return;
    }

    console.log('Starting game with wallet connected');
    
    // Initialize game elements
    snake = this.add.sprite(400, 300, selectedCharacter || 'molandak');
    snake.setScale(0.25);
    snakeSegments = [snake];

    // Initialize food
    moyaki = this.add.sprite(200, 200, 'moyaki');
    moyaki.setScale(0.25);

    // Add score text
    scoreText = this.add.text(16, 16, 'Score: 0', { 
        fontSize: '32px', 
        fill: '#fff' 
    });

    // Setup keyboard controls
    cursors = this.input.keyboard.createCursorKeys();

    // Initialize direction
    snake.direction = { x: 1, y: 0 };

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
        if (walletConnected) {
            togglePause(this.scene);
            if (!isPaused && backgroundMusic && !backgroundMusic.isPlaying) {
                backgroundMusic.play();
            }
        } else {
            if (pauseText) {
                pauseText.setText('Connect Wallet to Play');
                pauseText.setVisible(true);
            }
        }
    }, this);

    // Listen for wallet connection event
    window.addEventListener('walletConnected', async () => {
        console.log('Wallet connected event received');
        walletConnected = true;
        window.walletConnected = true;
        if (pauseText) {
            pauseText.setText('Press SPACE to Start');
            pauseText.setVisible(true);
        }
    });
}

function togglePause(scene) {
    // Only allow toggling if wallet is connected and game is not over
    if (!walletConnected || gameOver) return;
    
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

    // Don't update if game is over, paused, or wallet not connected
    if (gameOver || isPaused || !walletConnected) return;

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
        if (snake.targetX < 0 || snake.targetX > 800 || snake.targetY < 0 || snake.targetY > 600) {
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
            moyaki.x = Phaser.Math.Between(2, 38) * GRID_SIZE;
            moyaki.y = Phaser.Math.Between(2, 28) * GRID_SIZE;

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
            x = Phaser.Math.Between(0, 800);
            y = 0;
            dir = { x: 0, y: 1 };
        } else if (edge === 'bottom') {
            x = Phaser.Math.Between(0, 800);
            y = 600;
            dir = { x: 0, y: -1 };
        } else if (edge === 'left') {
            x = 0;
            y = Phaser.Math.Between(0, 600);
            dir = { x: 1, y: 0 };
        } else {
            x = 800;
            y = Phaser.Math.Between(0, 600);
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

// All your other functions (togglePause, endGame, restartGame, etc.)...

// Helper to get container size
function getGameContainerSize() {
    const container = document.getElementById('game');
    if (!container) return { width: 360, height: 480 };
    const rect = container.getBoundingClientRect();
    // Fallback to minimum size if not rendered yet
    return {
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(400, Math.floor(rect.height))
    };
}

// Phaser config (responsive)
let config = {
    type: Phaser.AUTO,
    ...getGameContainerSize(),
    backgroundColor: '#2d2d2d',
    parent: 'game',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Initialize Phaser after DOM loads, and on resize
function launchPhaserGame() {
    if (window.game && typeof window.game.destroy === 'function') {
        window.game.destroy(true);
    }
    config = {
        ...config,
        ...getGameContainerSize()
    };
    window.game = new Phaser.Game(config);
}

document.addEventListener('DOMContentLoaded', launchPhaserGame);
window.addEventListener('resize', () => {
    // Resize Phaser game to fit container
    if (window.game && window.game.scale && typeof window.game.scale.resize === 'function') {
        const { width, height } = getGameContainerSize();
        window.game.scale.resize(width, height);
    }
});

// Update the endGame function
function endGame(scene) {
    gameOver = true;
    isPaused = true;

    // Stop background music if playing
    if (backgroundMusic && backgroundMusic.isPlaying) {
        backgroundMusic.stop();
    }

    if (gameOverText) {
        gameOverText.destroy();
    }
    gameOverText = scene.add.text(scene.scale.width / 2, scene.scale.height / 2, 'Game Over!\nClick to submit score', {
        fontSize: Math.max(18, Math.floor(scene.scale.width / 20)) + 'px',
        fill: '#fff',
        align: 'center'
    }).setOrigin(0.5);

    if (pauseText) {
        pauseText.setVisible(false);
    }

    // Make the page scrollable again when game ends
    document.body.classList.remove('game-active');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = 'auto';

    scene.input.once('pointerdown', async () => {
        if (!window.ethereum || !window.ethereum.selectedAddress) {
            gameOverText.setText('Wallet not connected!\nPlease connect wallet');
            return;
        }

        if (!window.contract) {
            try {
                // Try to reinitialize contract
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                window.contract = new ethers.Contract(
                    CONTRACT_ADDRESS,
                    CONTRACT_ABI,
                    signer
                );
            } catch (error) {
                console.error('Error reinitializing contract:', error);
                gameOverText.setText('Contract initialization failed!\nPlease refresh page');
                return;
            }
        }

        if (score > 0) {
            try {
                gameOverText.setText('Submitting score...').setFontSize(Math.max(14, Math.floor(scene.scale.width / 32)));
                const tx = await window.contract.submitScore(score);
                gameOverText.setText('Waiting confirmation...').setFontSize(Math.max(14, Math.floor(scene.scale.width / 32)));
                await tx.wait();
                // Show success message briefly before restart
                gameOverText.setText('Score submitted!\nRestarting...').setFontSize(Math.max(14, Math.floor(scene.scale.width / 32)));
                // Try to update leaderboard, but always restart game after
                if (typeof updateLeaderboard === 'function') {
                    try {
                        await updateLeaderboard();
                    } catch (error) {
                        console.error('Error updating leaderboard:', error);
                        gameOverText.setText('Score submitted! (Leaderboard error)\nRestarting...').setFontSize(Math.max(14, Math.floor(scene.scale.width / 32)));
                    }
                }
                setTimeout(() => {
                    restartGame(scene);
                }, 800);
            } catch (error) {
                console.error('Error submitting score:', error);
                gameOverText.setText('Error submitting score!\nClick to try again').setFontSize(Math.max(14, Math.floor(scene.scale.width / 32)));
                scene.input.once('pointerdown', () => endGame(scene));
            }
        } else {
            restartGame(scene);
        }
    });
}

// Update the restartGame function
function restartGame(scene) {
    // Reset game state
    gameOver = false;
    isPaused = true;
    score = 0;
    lastDirection = 'right';
    moveTime = 0;
    moveInterpolation = 1;

    // Update score display
    scoreText.setText('Score: 0');

    // Clear snake segments
    for (let i = 1; i < snakeSegments.length; i++) {
        snakeSegments[i].destroy();
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

    // Reset food position
    moyaki.x = centerX - 100;
    moyaki.y = centerY - 100;
    moyaki.setTexture('moyaki');

    // Clear game over text
    if (gameOverText) {
        gameOverText.destroy();
        gameOverText = null;
    }

    // Show start message
    pauseText.setText('Press SPACE to Start');
    pauseText.setVisible(true);

    // Stop any playing music
    if (backgroundMusic.isPlaying) {
        backgroundMusic.stop();
    }

    // Make sure the game is ready for new input
    scene.input.keyboard.enabled = true;

    // Reset all scales to base scale
    snakeSegments.forEach(segment => segment.setScale(BASE_SCALE));
    moyaki.setScale(BASE_SCALE);

    // Reset snake texture to selectedCharacter
    snake.setTexture(selectedCharacter || 'molandak');

    // Reset fatnadsjohn state
    if (fatnadsjohn) fatnadsjohn.destroy();
    fatnadsjohn = null;
    fatnadsjohnActive = false;
    fatnadsjohnTimer = 0;
    fatnadsjohnAppearTime = 0;
    fatnadsjohnMoveDir = { x: 0, y: 0 };
    fatnadsjohnVanishTimeout = null;
    fatnadsjohnNextAppear = scene.time.now + Phaser.Math.Between(120000, 180000);
}

// Make sure restartGame is available globally
window.restartGame = restartGame;

// Update the setWalletConnected function
async function setWalletConnected() {
    if (window.farcasterSDK && window.farcasterSDK.wallet.ethProvider) {
        try {
            window.ethereum = window.farcasterSDK.wallet.ethProvider;
            walletConnected = true;
            window.walletConnected = true;
            
            // Initialize contract
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            window.contract = new ethers.Contract(
                CONTRACT_ADDRESS,
                CONTRACT_ABI,
                signer
            );
            
            console.log('Contract initialized successfully:', window.contract);
            
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
            console.error('Error initializing contract:', error);
            if (pauseText) {
                pauseText.setText('Error initializing contract');
                pauseText.setVisible(true);
            }
            return false;
        }
    }
    return false;
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

