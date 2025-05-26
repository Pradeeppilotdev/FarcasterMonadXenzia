// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SnakeLeaderboard {
    struct ScoreEntry {
        address player;
        uint256 score;
        uint256 timestamp;
    }

    ScoreEntry[] public allScores;
    mapping(address => uint256) public highScores;
    mapping(address => uint256) public highScoreTimestamp;
    mapping(address => bool) public hasPlayed;
    mapping(address => uint256) public latestScore;
    uint256 public totalPlayers;

    event ScoreSubmitted(address indexed player, uint256 score);

    function submitScore(uint256 score) external {
        require(score > 0, "Score must be positive");
        allScores.push(ScoreEntry(msg.sender, score, block.timestamp));
        latestScore[msg.sender] = score;
        if (score > highScores[msg.sender]) {
            highScores[msg.sender] = score;
            highScoreTimestamp[msg.sender] = block.timestamp;
        }
        if (!hasPlayed[msg.sender]) {
            hasPlayed[msg.sender] = true;
            totalPlayers += 1;
        }
        emit ScoreSubmitted(msg.sender, score);
    }

    function getHighScore(address player) external view returns (uint256) {
        return highScores[player];
    }

    function getHighScoreTimestamp(address player) external view returns (uint256) {
        return highScoreTimestamp[player];
    }

    function getLatestScore(address player) external view returns (uint256) {
        return latestScore[player];
    }

    function getTotalPlayers() external view returns (uint256) {
        return totalPlayers;
    }

    function getTotalScores() external view returns (uint256) {
        return allScores.length;
    }

    function getTopScores(uint256 n) external view returns (ScoreEntry[] memory) {
        // Create a mapping to store highest score per player
        mapping(address => ScoreEntry) memory playerHighScores;
        
        // First pass: find highest score for each player
        for (uint256 i = 0; i < allScores.length; i++) {
            ScoreEntry memory currentScore = allScores[i];
            ScoreEntry memory existingScore = playerHighScores[currentScore.player];
            
            if (existingScore.score == 0 || currentScore.score > existingScore.score) {
                playerHighScores[currentScore.player] = currentScore;
            }
        }
        
        // Convert mapping to array
        ScoreEntry[] memory uniqueScores = new ScoreEntry[](totalPlayers);
        uint256 uniqueCount = 0;
        
        for (uint256 i = 0; i < allScores.length; i++) {
            address player = allScores[i].player;
            ScoreEntry memory highScore = playerHighScores[player];
            
            // Check if we've already added this player's score
            bool alreadyAdded = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueScores[j].player == player) {
                    alreadyAdded = true;
                    break;
                }
            }
            
            if (!alreadyAdded) {
                uniqueScores[uniqueCount++] = highScore;
            }
        }
        
        // Sort the unique scores
        for (uint256 i = 0; i < uniqueCount - 1; i++) {
            for (uint256 j = 0; j < uniqueCount - i - 1; j++) {
                if (uniqueScores[j].score < uniqueScores[j + 1].score) {
                    ScoreEntry memory temp = uniqueScores[j];
                    uniqueScores[j] = uniqueScores[j + 1];
                    uniqueScores[j + 1] = temp;
                }
            }
        }
        
        // Create result array with top n scores
        uint256 resultLength = n < uniqueCount ? n : uniqueCount;
        ScoreEntry[] memory result = new ScoreEntry[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = uniqueScores[i];
        }
        
        return result;
    }

    function getPlayerScores(address player) external view returns (ScoreEntry[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allScores.length; i++) {
            if (allScores[i].player == player) {
                count++;
            }
        }
        ScoreEntry[] memory playerScores = new ScoreEntry[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allScores.length; i++) {
            if (allScores[i].player == player) {
                playerScores[idx++] = allScores[i];
            }
        }
        return playerScores;
    }
}