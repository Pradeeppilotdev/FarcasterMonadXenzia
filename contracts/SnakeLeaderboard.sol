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
        uint256 len = allScores.length;
        require(len > 0, "No scores yet");
        if (n > len) n = len;

        ScoreEntry[] memory scores = new ScoreEntry[](len);
        for (uint256 i = 0; i < len; i++) {
            scores[i] = allScores[i];
        }

        for (uint256 i = 0; i < n; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < len; j++) {
                if (scores[j].score > scores[maxIdx].score) {
                    maxIdx = j;
                }
            }
            if (maxIdx != i) {
                ScoreEntry memory temp = scores[i];
                scores[i] = scores[maxIdx];
                scores[maxIdx] = temp;
            }
        }

        ScoreEntry[] memory topScores = new ScoreEntry[](n);
        for (uint256 i = 0; i < n; i++) {
            topScores[i] = scores[i];
        }
        return topScores;
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