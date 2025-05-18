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
let signer;
let contract;
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

        // Initialize contract
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
                return await initializeContract(sdk.wallet.ethProvider);
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
    account = null;
    isConnected = false;
    window.contract = null;
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
        // Manually specify gas in hex to avoid eth_estimateGas
        const tx = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: account, // The connected account from wallet
                to: CONTRACT_ADDRESS,
                data: data,
                value: '0x0', // 0 ETH
                gas: '0x30d40' // 200,000 in hexadecimal, manual gas limit
                // gasPrice or maxFeePerGas/maxPriorityFeePerGas might be needed depending on EIP-1559 support
                // For simplicity, let's start without them, but keep in mind they might be required.
            }]
        });
        
        console.log('Transaction sent:', tx);


        return true;
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score. Please try again.');
        return false;
    }
}

// Export functions for use in other files
window.initializeFarcaster = initializeFarcaster;
window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;
window.submitScore = submitScore;
window.initializeContract = initializeContract;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    initializeFarcaster();
});

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

