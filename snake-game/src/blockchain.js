// Replace with your deployed contract address
const contractAddress = "0x2dE8C67B2010a141d245E3a128F9b90bFdfDDDf8";

const contractABI = [
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

// Monad Testnet network parameters
const monadTestnet = {
    chainId: '0x279F', // 10143 in hex
    chainName: 'Monad Testnet',
    nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18
    },
    rpcUrls: ['https://testnet-rpc.monad.xyz/'],
    blockExplorerUrls: ['https://testnet.monadexplorer.com/']
};

let provider, signer, contract, account;
let isConnected = false;

async function connectWallet() {
    try {
        if (typeof window.ethereum !== 'undefined') {
            // Check if we're on the correct network first
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await provider.getNetwork();
            
            // Check if we're on Monad Testnet (chainId: 10143)
            if (network.chainId !== 10143) {
                console.log('Wrong network, attempting to switch to Monad Testnet...');
                const switched = await switchToMonadTestnet();
                if (!switched) {
                    return false;
                }
            }

            // Now proceed with connection
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            account = await signer.getAddress();
            
            // Connect to the contract
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            // Update UI
            document.getElementById('connectButton').style.display = 'none';
            document.getElementById('disconnectButton').style.display = 'block';
            document.getElementById('walletInfo').textContent = 
                `${account.slice(0, 6)}...${account.slice(-4)}`;
            
            // Call setWalletConnected to update game state
            if (window.setWalletConnected) {
                window.setWalletConnected();
            }
            
            // Initialize leaderboard
            await initializeLeaderboard();
            
            return true;
        } else {
            alert('Please install MetaMask!');
            return false;
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        return false;
    }
}

async function switchToMonadTestnet() {
    try {
        // Try to switch to Monad Testnet
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: monadTestnet.chainId }],
        });
        return true;
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
            try {
                // Add Monad Testnet to MetaMask
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [monadTestnet],
                });
                
                // Try switching again
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: monadTestnet.chainId }],
                });
                
                alert("Monad Testnet has been added to your wallet and selected.");
                return true;
            } catch (addError) {
                console.error("Error adding Monad Testnet:", addError);
                alert("Failed to add Monad Testnet to your wallet. Please add it manually.");
                
                // Show manual instructions
                showNetworkInstructions();
                return false;
            }
        } else {
            console.error("Error switching to Monad Testnet:", switchError);
            alert("Failed to switch to Monad Testnet. Please switch manually.");
            
            // Show manual instructions
            showNetworkInstructions();
            return false;
        }
    }
}

function showNetworkInstructions() {
    const instructions = `
        Please add Monad Testnet to your wallet with these details:
        
        Network Name: Monad Testnet
        Chain ID: 10143
        RPC URL: https://testnet-rpc.monad.xyz/
        Currency Symbol: MON
        Block Explorer URL: https://testnet.monadexplorer.com/
    `;
    
    alert(instructions);
}

async function updateHighScore(score) {
    if (!isConnected) {
        alert("Please connect your wallet first!");
        return Promise.reject("Wallet not connected");
    }
    
    try {
        // Check network again before transaction
        const network = await provider.getNetwork();
        if (network.chainId !== 10143) {
            alert("Please switch to Monad Testnet to submit your score.");
            await switchToMonadTestnet();
            return Promise.reject("Wrong network");
        }
        
        // Show a message to the user
        alert(`Submitting your score of ${score} to the blockchain. Please confirm the transaction in MetaMask.`);
        
        const tx = await contract.updateScore(score);
        await tx.wait();
        console.log(`High score updated: ${score}`);
        alert("Score successfully recorded on the blockchain!");
        return Promise.resolve();
    } catch (error) {
        console.error("Error updating high score:", error);
        alert("Failed to record score. Please try again.");
        return Promise.reject(error);
    }
}

async function displayScoreHistory() {
    if (!isConnected) return;
    
    try {
        const address = await signer.getAddress();
        const score = await contract.getHighScore(address);
        
        const scoresDiv = document.getElementById('scores');
        scoresDiv.innerHTML = `<p>High Score: ${score}</p>`;
        
    } catch (error) {
        console.error("Error fetching score history:", error);
    }
}

async function updateLeaderboard() {
    if (!contract) {
        console.error('Contract is not initialized');
        return;
    }
    const leaderboardBody = document.getElementById('leaderboardBody');
    if (!leaderboardBody) {
        console.error('Leaderboard body element not found');
        return;
    }
    leaderboardBody.innerHTML = '';
    try {
        // Debug: Log provider, signer, account, contract, and network
        console.log('--- updateLeaderboard DEBUG ---');
        console.log('contract:', contract);
        if (typeof provider !== 'undefined') {
            console.log('provider:', provider);
            const network = await provider.getNetwork();
            console.log('network:', network);
            if (network.chainId !== 10143) {
                leaderboardBody.innerHTML = '<tr><td colspan="3">Not on Monad Testnet (chainId: ' + network.chainId + ')</td></tr>';
                return;
            }
        } else {
            console.warn('provider is undefined');
        }
        if (typeof signer !== 'undefined') {
            console.log('signer:', signer);
            try {
                const debugAccount = await signer.getAddress();
                console.log('signer.getAddress():', debugAccount);
            } catch (e) {
                console.warn('Could not get signer address:', e);
            }
        } else {
            console.warn('signer is undefined');
        }
        if (typeof account !== 'undefined') {
            console.log('account:', account);
        } else {
            console.warn('account is undefined');
        }
        // Get top 100 scores
        let topScores;
        try {
            topScores = await contract.getTopScores(100);
        } catch (err) {
            console.error('getTopScores(100) call failed:', err);
            leaderboardBody.innerHTML = '<tr><td colspan="3">Leaderboard unavailable (getTopScores failed)</td></tr>';
            return;
        }
        console.log('topScores:', topScores);
        if (topScores && topScores.length > 0) {
            // Populate leaderboard table
            topScores.forEach((score, index) => {
                if (score.score.toString() === '0') return; // Skip zero scores
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${score.player.slice(0, 6)}...${score.player.slice(-4)}</td>
                    <td>${score.score.toString()}</td>
                `;
                leaderboardBody.appendChild(row);
            });
        } else {
            // No scores
            leaderboardBody.innerHTML = '<tr><td colspan="3">No scores yet.</td></tr>';
        }
        // Update user's rank if they're not in top 100
        if (typeof account !== 'undefined' && account) {
            try {
                const userRank = await contract.getUserRank(account);
                const userRankElement = document.getElementById('userRank');
                if (userRankElement && userRank > 100) {
                    userRankElement.textContent = `Your Current Rank: ${userRank}`;
                } else if (userRankElement) {
                    userRankElement.textContent = '';
                }
            } catch (rankError) {
                console.error('Error getting user rank:', rankError);
            }
        }
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        leaderboardBody.innerHTML = '<tr><td colspan="3">Leaderboard unavailable</td></tr>';
        const userRankElement = document.getElementById('userRank');
        if (userRankElement) userRankElement.textContent = '';
    }
}

async function initializeLeaderboard() {
    try {
        await updateHighScore();
        await updateLeaderboard();
        // Update every 30 seconds
        setInterval(updateLeaderboard, 30000);
    } catch (error) {
        console.error('Error initializing leaderboard:', error);
    }
}

// Add disconnect wallet function
async function disconnectWallet() {
    // Reset all states
    provider = null;
    signer = null;
    contract = null;
    account = null;
    
    // Update UI
    document.getElementById('connectButton').style.display = 'block';
    document.getElementById('disconnectButton').style.display = 'none';
    document.getElementById('walletInfo').textContent = 'Not Connected';
    document.getElementById('highScore').textContent = 'High Score: 0';
    
    // Reset game state
    if (window.game && window.game.scene.scenes[0]) {
        const gameScene = window.game.scene.scenes[0];
        if (gameScene.pauseText) {
            gameScene.pauseText.setText('Connect Wallet to Play');
        }
    }
    
    // Dispatch wallet disconnected event
    window.dispatchEvent(new CustomEvent('walletDisconnected'));
}

// Add these event listeners at the bottom of the file
document.addEventListener('DOMContentLoaded', function() {
    // Existing connect button listener
    document.getElementById('connectButton').addEventListener('click', connectWallet);
    
    // Add disconnect button listener
    document.getElementById('disconnectButton').addEventListener('click', disconnectWallet);
});

// Update the account change listener
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length > 0) {
            if (window.setWalletConnected) {
                window.setWalletConnected();
            }
        } else {
            // Handle disconnect
            await disconnectWallet();
        }
    });
}

// Initially disable game until wallet is connected
document.getElementById('game').style.opacity = '0.76';

// Listen for network changes
if (window.ethereum) {
    window.ethereum.on('chainChanged', async (chainId) => {
        // Convert chainId to decimal for comparison
        const decimal = parseInt(chainId, 16);
        if (decimal !== 10143) {
            // If not on Monad Testnet, disconnect
            await disconnectWallet();
            alert('Please connect to Monad Testnet to play the game.');
        } else {
            // If switched to Monad Testnet, try to reconnect
            connectWallet();
        }
    });
}

async function submitScore(score) {
    if (!contract) return;
    
    try {
        const tx = await contract.submitScore(score);
        await tx.wait();
        console.log('Score submitted successfully');
        
        // Update the displays
        await updateLeaderboard();
        await updateHighScore();
    } catch (error) {
        console.error('Error submitting score:', error);
    }
}

async function updateHighScore() {
    if (!contract || !account) return;
    
    try {
        const highScore = await contract.getHighScore(account);
        document.getElementById('highScore').textContent = `High Score: ${highScore}`;
    } catch (error) {
        console.error('Error getting high score:', error);
    }
}

// Make sure to call initializeLeaderboard after wallet connection
// and submitScore when the game ends 