// Contract configuration
// function showDebug(message) {
//     const el = document.getElementById('debugOutput');
//     if (el) {
//         el.innerText += `\\n${message}`;
//     }
// }

const CONTRACT_ADDRESS = '0x2dE8C67B2010a141d245E3a128F9b90bFdfDDDf8'; // Replace with your contract address
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
    {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "n",
            "type": "uint256"
          }
        ],
        "name": "getTopScores",
        "outputs": [
          {
            "components": [
              {
                "internalType": "address",
                "name": "player",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "score",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              }
            ],
            "internalType": "struct SnakeLeaderboard.ScoreEntry[]",
            "name": "",
            "type": "tuple[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
    "function getPlayerScores(address player) external view returns (tuple(address player, uint256 score, uint256 timestamp)[])"
];

// Monad Testnet network parameters
const MONAD_TESTNET = {
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

// Global state
let provider;
let readProvider;
let signer;
let contract;
let readContract;
let account;
let isConnected = false;

// Handle account changes
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected their wallet
        await disconnectWallet();
    } else {
        // User switched accounts
        account = accounts[0];
        await initializeContract(window.ethereum);
    }
}

// Handle chain changes
async function handleChainChanged(chainId) {
    const decimal = parseInt(chainId, 16);
    if (decimal !== 10143) { // Check against decimal chain ID
        await disconnectWallet();
        alert('Please connect to Monad Testnet to play the game.');
    } else {
        await initializeContract(window.ethereum);
    }
}

// Update connection status in UI
function updateConnectionStatus() {
    const walletInfo = document.getElementById('walletInfo');
    if (walletInfo) {
        if (isConnected && account) {
            walletInfo.textContent = `Connected: ${account.slice(0, 6)}...${account.slice(-4)}`;
        } else {
            walletInfo.textContent = 'Not Connected';
        }
    }
}

// Initialize read-only provider
function initializeReadProvider() {
    try {
        // Create a read-only provider using the public RPC URL
        readProvider = new ethers.providers.JsonRpcProvider(MONAD_TESTNET.rpcUrls[0]);
        // Create a read-only contract instance
        readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
        // Make readContract available globally
        window.readContract = readContract;
        console.log('Read-only provider initialized successfully');
        
        // Initial leaderboard load
        updateLeaderboard().catch(error => {
            console.error('Error in initial leaderboard load:', error);
        });
        
        // Set up periodic leaderboard refresh
        setInterval(async () => {
            try {
                await updateLeaderboard();
            } catch (error) {
                console.error('Error in periodic leaderboard update:', error);
            }
        }, 10000); // Refresh every 10 seconds
        
        return true;
    } catch (error) {
        console.error('Error initializing read-only provider:', error);
        return false;
    }
}

// Initialize contract with error handling
async function initializeContract(ethereumProvider) {
    try {
        console.log('Initializing contract...');
        
        // Check if provider exists
        if (!ethereumProvider) {
            console.error('No Ethereum provider found');
            return false;
        }

        // Initialize provider and signer
        provider = new ethers.providers.Web3Provider(ethereumProvider);
        signer = provider.getSigner();
        
        // Get current network
        const network = await provider.getNetwork();
        console.log('Current network:', network);
        
        // Check if we're on the correct network
        if (network.chainId !== 10143) {
            console.log('Switching to Monad Testnet...');
            try {
                await ethereumProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: MONAD_TESTNET.chainId }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await ethereumProvider.request({
                            method: 'wallet_addEthereumChain',
                            params: [MONAD_TESTNET],
                        });
                    } catch (addError) {
                        console.error('Error adding Monad Testnet:', addError);
                        return false;
                    }
                } else {
                    console.error('Error switching to Monad Testnet:', switchError);
                    return false;
                }
            }
        }

        // Initialize contract for writing only
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        // Try to get the current account
        try {
            account = await signer.getAddress();
            isConnected = true;
            console.log('Connected account:', account);
        } catch (error) {
            console.log('No account connected yet');
            isConnected = false;
        }

        // Set up event listeners
        ethereumProvider.on('accountsChanged', handleAccountsChanged);
        ethereumProvider.on('chainChanged', handleChainChanged);

        // Update UI
        updateConnectionStatus();
        
        // Set global variables
        window.contract = contract;
        window.walletConnected = isConnected;
        
        return true;
    } catch (error) {
        console.error('Error initializing contract:', error);
        return false;
    }
}

// Initialize Farcaster and contract
async function initializeFarcaster() {
    try {
        console.log('Initializing Farcaster...');
        const isMiniApp = await window.farcasterSDK.isInMiniApp();
        console.log('Is Mini App:', isMiniApp);

        if (isMiniApp) {
            const sdk = window.farcasterSDK;
            await sdk.actions.ready();
            
            if (sdk.wallet.ethProvider) {
                window.ethereum = sdk.wallet.ethProvider;
                const success = await initializeContract(sdk.wallet.ethProvider);
                if (success) {
                    // Update leaderboard after wallet connection
                    updateLeaderboard().catch(error => {
                        console.error('Error updating leaderboard after wallet connection:', error);
                    });
                }
                return success;
            }
        }
        return false;
    } catch (error) {
        console.error('Error initializing Farcaster:', error);
        return false;
    }
}

// Connect wallet function
async function connectWallet() {
    try {
        if (typeof window.ethereum !== 'undefined') {
            return await initializeContract(window.ethereum);
        } else {
            console.error('No ethereum provider found');
            return false;
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        return false;
    }
}

  
// Disconnect wallet function
async function disconnectWallet() {
    provider = null;
    signer = null;
    contract = null;
    readContract = null;
    account = null;
    isConnected = false;
    window.contract = null;
    window.readContract = null;
    window.walletConnected = false;

    // Update UI
    if (document.getElementById('walletInfo')) {
        document.getElementById('walletInfo').textContent = 'Not Connected';
    }
}

// Submit score function
async function submitScore(score) {
    if (!contract || !isConnected) {
        console.error('Contract not initialized or wallet not connected');
        return false;
    }

    try {
        console.log('Submitting score:', score);
        
        // Create the transaction data
        const data = contract.interface.encodeFunctionData('submitScore', [score]);
        
        // Send the transaction using window.ethereum.request and eth_sendTransaction
        const tx = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: account,
                to: CONTRACT_ADDRESS,
                data: data,
                value: '0x0',
                gas: '0x30d40'
            }]
        });
        
        console.log('Transaction sent:', tx);

        // Wait for transaction to be mined
        const receipt = await provider.waitForTransaction(tx);
        console.log('Transaction mined:', receipt);

        // Update leaderboard immediately after score submission
        try {
            await updateLeaderboard();
        } catch (error) {
            console.error('Error updating leaderboard after score submission:', error);
        }

        return true;
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score. Please try again.');
        return false;
    }
}

// Update the updateLeaderboard function to use readContract
async function updateLeaderboard() {
    try {
        if (!window.readContract) {
            console.error('Read contract not initialized');
            return;
        }

        // Get current account from window.ethereum if available
        let currentAccount = null;
        try {
            if (window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                currentAccount = accounts[0];
                console.log('Current account for leaderboard:', currentAccount);
            }
        } catch (error) {
            console.log('Could not get current account:', error);
        }

        // Get top 100 scores using readContract
        const topScores = await window.readContract.getTopScores(100);
        console.log('Raw top scores from contract:', topScores);
        
        // Create a map to store unique player scores (keeping only highest score per player)
        const uniquePlayerScores = new Map();
        
        // Process scores to keep only highest score per player
        topScores.forEach(score => {
            const player = score.player.toLowerCase(); // Normalize address case
            const scoreValue = parseInt(score.score);
            const existingScore = uniquePlayerScores.get(player);
            
            console.log('Processing score:', {
                player: player,
                score: scoreValue,
                timestamp: score.timestamp.toString()
            });
            
            if (!existingScore || scoreValue > parseInt(existingScore.score)) {
                console.log('Updating score for player:', player, 'New score:', scoreValue);
                uniquePlayerScores.set(player, {
                    player: score.player, // Keep original case for display
                    score: scoreValue,
                    timestamp: score.timestamp
                });
            }
        });
        
        // Convert map to array and sort by score
        const sortedScores = Array.from(uniquePlayerScores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 100); // Take top 100
        
        console.log('Final sorted scores:', sortedScores.map(s => ({
            player: s.player,
            score: s.score,
            timestamp: s.timestamp.toString()
        })));
        
        // Update leaderboard table
        const leaderboardBody = document.getElementById('leaderboardBody');
        if (leaderboardBody) {
            leaderboardBody.innerHTML = '';
            
            sortedScores.forEach((score, index) => {
                const row = document.createElement('tr');
                
                // Format address to show only first 6 and last 4 characters
                const shortAddress = `${score.player.slice(0, 6)}...${score.player.slice(-4)}`;
                
                // Format timestamp to readable date
                const date = new Date(score.timestamp * 1000);
                const formattedDate = date.toLocaleDateString();
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${shortAddress}</td>
                    <td>${score.score}</td>
                    <td>${formattedDate}</td>
                `;
                
                // Highlight user's score if account is connected
                if (currentAccount && score.player.toLowerCase() === currentAccount.toLowerCase()) {
                    console.log('Found user score in leaderboard:', {
                        player: score.player,
                        score: score.score
                    });
                    row.style.backgroundColor = '#64ffda20';
                }
                
                leaderboardBody.appendChild(row);
            });
        }

        // Update user's rank section only if account is connected
        const userRankDiv = document.getElementById('userRank');
        if (userRankDiv) {
            if (currentAccount) {
                try {
                    const userHighScore = await window.readContract.getHighScore(currentAccount);
                    const userHighScoreTimestamp = await window.readContract.getHighScoreTimestamp(currentAccount);
                    
                    console.log('User high score details:', {
                        account: currentAccount,
                        highScore: userHighScore.toString(),
                        timestamp: userHighScoreTimestamp.toString()
                    });
                    
                    if (userHighScore > 0) {
                        const date = new Date(userHighScoreTimestamp * 1000);
                        const formattedDate = date.toLocaleDateString();
                        
                        // Find user's rank in the sorted scores
                        const userRank = sortedScores.findIndex(score => 
                            score.player.toLowerCase() === currentAccount.toLowerCase()
                        ) + 1;
                        
                        console.log('User rank in leaderboard:', userRank);
                        
                        userRankDiv.innerHTML = `
                            <h4>Your High Score</h4>
                            <p>Score: ${userHighScore}</p>
                            <p>Rank: ${userRank > 0 ? userRank : 'Not in top 100'}</p>
                            <p>Achieved on: ${formattedDate}</p>
                        `;
                    } else {
                        userRankDiv.innerHTML = '<p>Play a game to get on the leaderboard!</p>';
                    }
                } catch (error) {
                    console.error('Error fetching user high score:', error);
                    userRankDiv.innerHTML = '<p>Error loading your high score</p>';
                }
            } else {
                userRankDiv.innerHTML = '<p></p>';
            }
        }
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        const leaderboardBody = document.getElementById('leaderboardBody');
        if (leaderboardBody) {
            leaderboardBody.innerHTML = '<tr><td colspan="4">Error loading leaderboard</td></tr>';
        }
        const userRankDiv = document.getElementById('userRank');
        if (userRankDiv) {
            userRankDiv.innerHTML = '<p></p>';
        }
    }
}

// Initialize read provider on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    // Initialize read provider first
    initializeReadProvider();
    // Then initialize Farcaster
    initializeFarcaster();
    
    // Add refresh button to leaderboard
    const leaderboardDiv = document.getElementById('leaderboard');
    if (leaderboardDiv) {
        const refreshButton = document.createElement('button');
        refreshButton.textContent = '🔄 Refresh Leaderboard';
        refreshButton.style.cssText = `
            margin: 10px 0;
            padding: 5px 10px;
            background-color: #64ffda;
            color: #0a192f;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        refreshButton.onclick = () => {
            refreshButton.textContent = '🔄 Refreshing...';
            updateLeaderboard().finally(() => {
                refreshButton.textContent = '🔄 Refresh Leaderboard';
            });
        };
        leaderboardDiv.insertBefore(refreshButton, leaderboardDiv.firstChild);
    }
});

// Export functions for use in other files
window.initializeFarcaster = initializeFarcaster;
window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;
window.submitScore = submitScore;
window.initializeContract = initializeContract;
window.updateLeaderboard = updateLeaderboard;

// Handle account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length > 0) {
            await initializeContract(window.ethereum);
        } else {
            await disconnectWallet();
        }
    });

    window.ethereum.on('chainChanged', async (chainId) => {
        const decimal = parseInt(chainId, 16);
        if (decimal !== 10143) {
            await disconnectWallet();
            alert('Please connect to Monad Testnet to play the game.');
        } else {
            await initializeContract(window.ethereum);
        }
    });
}

async function switchToMonadTestnet() {
    try {
        // Try to switch to Monad Testnet
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_TESTNET.chainId }],
        });
        return true;
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
            try {
                // Add Monad Testnet to MetaMask
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [MONAD_TESTNET],
                });
                
                // Try switching again
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: MONAD_TESTNET.chainId }],
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

// Update high score function
// async function updateHighScore(score) {
//     if (!isConnected) {
//         alert("Please connect your wallet first!");
//         return Promise.reject("Wallet not connected");
//     }
    
//     try {
//         // Check network again before transaction
//         const network = await provider.getNetwork();
//         if (network.chainId !== 10143) {
//             alert("Please switch to Monad Testnet to submit your score.");
//             await switchToMonadTestnet();
//             return Promise.reject("Wrong network");
//         }
        
//         // Show a message to the user
//         alert(`Submitting your score of ${score} to the blockchain. Please confirm the transaction in your wallet.`);
        
//         // Create the transaction data
//         const data = contract.interface.encodeFunctionData('updateScore', [score]);
        
//         // Send the transaction using basic eth_sendTransaction
//         const tx = await window.ethereum.request({
//             method: 'eth_sendTransaction',
//             params: [{
//                 from: account,
//                 to: CONTRACT_ADDRESS,
//                 data: data,
//                 value: '0x0'
//             }]
//         });
        
//         console.log(`High score updated: ${score}`);
//         alert("Score successfully recorded on the blockchain!");
//         return Promise.resolve();
//     } catch (error) {
//         console.error("Error updating high score:", error);
//         alert("Failed to record score. Please try again.");
//         return Promise.reject(error);
//     }
// }

  



// async function updateLeaderboard() {
//     if (!contract) {
//         console.error('Contract is not initialized');
//         return;
//     }
//     const leaderboardBody = document.getElementById('leaderboardBody');
//     if (!leaderboardBody) {
//         console.error('Leaderboard body element not found');
//         return;
//     }
//     leaderboardBody.innerHTML = '';
//     try {
//         topScores = await contract.getTopScores(100);
//         showDebug(`Fetched ${topScores.length} top scores`);
//     } catch (err) {
//         console.error('getTopScores(100) call failed:', err);
//         showDebug(`getTopScores failed: ${err.message || err}`);
//         leaderboardBody.innerHTML = '<tr><td colspan="3">Leaderboard unavailable (getTopScores failed)</td></tr>';
//         return;
//     }
    
//     try {
//         // Debug: Log provider, signer, account, contract, and network
//         console.log('--- updateLeaderboard DEBUG ---');
//         console.log('contract:', contract);
//         if (typeof provider !== 'undefined') {
//             console.log('provider:', provider);
//             const network = await provider.getNetwork();
//             console.log('network:', network);
//             if (network.chainId !== 10143) {
//                 leaderboardBody.innerHTML = '<tr><td colspan="3">Not on Monad Testnet (chainId: ' + network.chainId + ')</td></tr>';
//                 return;
//             }
//         } else {
//             console.warn('provider is undefined');
//         }
//         if (typeof signer !== 'undefined') {
//             console.log('signer:', signer);
//             try {
//                 const debugAccount = await signer.getAddress();
//                 console.log('signer.getAddress():', debugAccount);
//             } catch (e) {
//                 console.warn('Could not get signer address:', e);
//             }
//         } else {
//             console.warn('signer is undefined');
//         }
//         if (typeof account !== 'undefined') {
//             console.log('account:', account);
//         } else {
//             console.warn('account is undefined');
//         }
//         // Get top 100 scores
//         let topScores;
//         try {
//             topScores = await contract.getTopScores(100);
//         } catch (err) {
//             console.error('getTopScores(100) call failed:', err);
//             leaderboardBody.innerHTML = '<tr><td colspan="3">Leaderboard unavailable (getTopScores failed)</td></tr>';
//             return;
//         }
//         console.log('topScores:', topScores);
//         if (topScores && topScores.length > 0) {
//             // Filter to only highest score per unique address
//             const uniqueScores = {};
//             topScores.forEach((entry) => {
//                 const addr = entry.player.toLowerCase();
//                 const score = Number(entry.score);
//                 if (!uniqueScores[addr] || score > uniqueScores[addr].score) {
//                     uniqueScores[addr] = { ...entry, score };
//                 }
//             });
//             // Convert to array and sort by score descending
//             const uniqueSorted = Object.values(uniqueScores).sort((a, b) => b.score - a.score).slice(0, 100);

//             uniqueSorted.forEach((score, index) => {
//                 if (score.score === 0) return;
//                 const row = document.createElement('tr');
//                 row.innerHTML = `
//                     <td>${index + 1}</td>
//                     <td>${score.player.slice(0, 6)}...${score.player.slice(-4)}</td>
//                     <td>${score.score}</td>
//                 `;
//                 leaderboardBody.appendChild(row);
//             });
//         } else {
//             // No scores
//             leaderboardBody.innerHTML = '<tr><td colspan="3">No scores yet.</td></tr>';
//         }
//         // Update user's rank if they're not in top 100
//         if (typeof account !== 'undefined' && account) {
//             try {
//                 const userRank = await contract.getUserRank(account);
//                 const userRankElement = document.getElementById('userRank');
//                 if (userRankElement && userRank > 100) {
//                     userRankElement.textContent = `Your Current Rank: ${userRank}`;
//                 } else if (userRankElement) {
//                     userRankElement.textContent = '';
//                 }
//             } catch (rankError) {
//                 console.error('Error getting user rank:', rankError);
//             }
//         }
//     } catch (error) {
//         console.error('Error updating leaderboard:', error);
//         leaderboardBody.innerHTML = '<tr><td colspan="3">Leaderboard unavailable</td></tr>';
//         const userRankElement = document.getElementById('userRank');
//         if (userRankElement) userRankElement.textContent = '';
//     }
// }

