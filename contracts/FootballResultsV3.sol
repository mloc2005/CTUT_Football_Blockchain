
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FootballResultsV3 {

    address public owner;
    uint256 public matchCount;

    // ========== THONG TIN TRAN DAU ==========

    struct MatchInfo {
        string teamA;
        string teamB;

        uint64 startTime;
        string venue;

        uint8 scoreA;
        uint8 scoreB;

        uint8 yellowA;
        uint8 redA;
        uint8 yellowB;
        uint8 redB;

        bool finalized;
    }

    // ========== CAU THU GHI BAN ==========

    struct GoalInfo {
        string playerName;
        uint8 team;       // 1 = Doi A, 2 = Doi B
        uint16 minute;
    }

    // ========== CHI TIET THE PHAT ==========

    struct CardInfo {
        string playerName;
        uint8 team;       // 1 = Doi A, 2 = Doi B
        uint8 cardType;   // 1 = Vang, 2 = Do
        uint16 minute;
    }

    // ========== LUU TRU BLOCKCHAIN ==========

    mapping(uint256 => MatchInfo) private matches;

    mapping(uint256 => GoalInfo[]) private goals;

    mapping(uint256 => CardInfo[]) private cards;

    // Danh dau ban ghi da bi huy
// Index bat dau tu 0
mapping(uint256 => mapping(uint256 => bool))
    public goalCancelled;

mapping(uint256 => mapping(uint256 => bool))
    public cardCancelled;

    // ========== EVENTS ==========

    event MatchCreated(
        uint256 indexed matchId,
        string teamA,
        string teamB
    );

    event MatchDetailsUpdated(
        uint256 indexed matchId,
        uint64 startTime,
        string venue
    );

    event GoalRecorded(
        uint256 indexed matchId,
        string playerName,
        uint8 team,
        uint16 minute
    );

    event CardRecorded(
        uint256 indexed matchId,
        string playerName,
        uint8 team,
        uint8 cardType,
        uint16 minute
    );

    event ScoreUpdated(
        uint256 indexed matchId,
        uint8 scoreA,
        uint8 scoreB
    );

    event CardsUpdated(
        uint256 indexed matchId,
        uint8 yellowA,
        uint8 redA,
        uint8 yellowB,
        uint8 redB
    );

    event MatchFinalized(
        uint256 indexed matchId
    );

event GoalCorrected(
    uint256 indexed matchId,
    uint256 indexed goalIndex,
    string oldPlayer,
    uint8 oldTeam,
    uint16 oldMinute,
    string newPlayer,
    uint8 newTeam,
    uint16 newMinute
);

event GoalCancelled(
    uint256 indexed matchId,
    uint256 indexed goalIndex,
    string playerName,
    uint8 team,
    uint16 minute
);

event CardCorrected(
    uint256 indexed matchId,
    uint256 indexed cardIndex,
    string oldPlayer,
    uint8 oldTeam,
    uint8 oldCardType,
    uint16 oldMinute,
    string newPlayer,
    uint8 newTeam,
    uint8 newCardType,
    uint16 newMinute
);

event CardCancelled(
    uint256 indexed matchId,
    uint256 indexed cardIndex,
    string playerName,
    uint8 team,
    uint8 cardType,
    uint16 minute
);

    // ========== PHAN QUYEN ==========

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier matchExists(uint256 _matchId) {
        require(
            _matchId > 0 && _matchId <= matchCount,
            "Match not found"
        );
        _;
    }

    modifier editable(uint256 _matchId) {
        require(
            _matchId > 0 && _matchId <= matchCount,
            "Match not found"
        );

        require(
            !matches[_matchId].finalized,
            "Match already finalized"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // =====================================
    // 1. TAO TRAN DAU
    // =====================================

    function createMatch(
        string calldata _teamA,
        string calldata _teamB,
        uint64 _startTime,
        string calldata _venue
    ) external onlyOwner {

        require(
            bytes(_teamA).length > 0,
            "Team A is empty"
        );

        require(
            bytes(_teamB).length > 0,
            "Team B is empty"
        );

        require(_startTime > 0, "Invalid start time");

        require(
            bytes(_venue).length > 0,
            "Venue is empty"
        );

        matchCount++;

        MatchInfo storage game = matches[matchCount];

        game.teamA = _teamA;
        game.teamB = _teamB;
        game.startTime = _startTime;
        game.venue = _venue;

        emit MatchCreated(
            matchCount,
            _teamA,
            _teamB
        );

        emit MatchDetailsUpdated(
            matchCount,
            _startTime,
            _venue
        );
    }

    // =====================================
    // 2. CAP NHAT THOI GIAN VA SAN
    // =====================================

    function updateMatchDetails(
        uint256 _matchId,
        uint64 _startTime,
        string calldata _venue
    )
        external
        onlyOwner
        editable(_matchId)
    {
        require(_startTime > 0, "Invalid start time");

        require(
            bytes(_venue).length > 0,
            "Venue is empty"
        );

        MatchInfo storage game = matches[_matchId];

        game.startTime = _startTime;
        game.venue = _venue;

        emit MatchDetailsUpdated(
            _matchId,
            _startTime,
            _venue
        );
    }

    // =====================================
    // 3. GHI NHAN CAU THU GHI BAN
    // =====================================

    function recordGoal(
        uint256 _matchId,
        string calldata _playerName,
        uint8 _team,
        uint16 _minute
    )
        external
        onlyOwner
        editable(_matchId)
    {
        require(
            bytes(_playerName).length > 0,
            "Player name is empty"
        );

        require(
            _team == 1 || _team == 2,
            "Invalid team"
        );

        require(
            _minute > 0 && _minute <= 180,
            "Invalid minute"
        );

        MatchInfo storage game = matches[_matchId];

        // Tu dong tang ty so
        if (_team == 1) {
            require(
                game.scoreA < type(uint8).max,
                "Score A limit"
            );
            game.scoreA++;
        } else {
            require(
                game.scoreB < type(uint8).max,
                "Score B limit"
            );
            game.scoreB++;
        }

        goals[_matchId].push(
            GoalInfo({
                playerName: _playerName,
                team: _team,
                minute: _minute
            })
        );

        emit GoalRecorded(
            _matchId,
            _playerName,
            _team,
            _minute
        );

        emit ScoreUpdated(
            _matchId,
            game.scoreA,
            game.scoreB
        );
    }

    // =====================================
    // 4. GHI NHAN THE PHAT CHI TIET
    // =====================================

    function recordCard(
        uint256 _matchId,
        string calldata _playerName,
        uint8 _team,
        uint8 _cardType,
        uint16 _minute
    )
        external
        onlyOwner
        editable(_matchId)
    {
        require(
            bytes(_playerName).length > 0,
            "Player name is empty"
        );

        require(
            _team == 1 || _team == 2,
            "Invalid team"
        );

        require(
            _cardType == 1 || _cardType == 2,
            "Invalid card type"
        );

        require(
            _minute > 0 && _minute <= 180,
            "Invalid minute"
        );

        MatchInfo storage game = matches[_matchId];

        // Tu dong tang tong the
        if (_team == 1) {
            if (_cardType == 1) {
                require(
                    game.yellowA < type(uint8).max,
                    "Yellow A limit"
                );
                game.yellowA++;
            } else {
                require(
                    game.redA < type(uint8).max,
                    "Red A limit"
                );
                game.redA++;
            }
        } else {
            if (_cardType == 1) {
                require(
                    game.yellowB < type(uint8).max,
                    "Yellow B limit"
                );
                game.yellowB++;
            } else {
                require(
                    game.redB < type(uint8).max,
                    "Red B limit"
                );
                game.redB++;
            }
        }

        cards[_matchId].push(
            CardInfo({
                playerName: _playerName,
                team: _team,
                cardType: _cardType,
                minute: _minute
            })
        );

        emit CardRecorded(
            _matchId,
            _playerName,
            _team,
            _cardType,
            _minute
        );

        emit CardsUpdated(
            _matchId,
            game.yellowA,
            game.redA,
            game.yellowB,
            game.redB
        );
    }

    // =====================================
    // 5. CHOT KET QUA
    // =====================================

    function finalizeMatch(
        uint256 _matchId
    )
        external
        onlyOwner
        editable(_matchId)
    {
        matches[_matchId].finalized = true;

        emit MatchFinalized(_matchId);
    }

    // =====================================
    // 6. TRA CUU KET QUA
    // GIU DINH DANG GETMATCH CUA V2
    // =====================================

    function getMatch(
        uint256 _matchId
    )
        external
        view
        matchExists(_matchId)
        returns (
            string memory teamA,
            string memory teamB,
            uint8 scoreA,
            uint8 scoreB,
            uint8 yellowA,
            uint8 redA,
            uint8 yellowB,
            uint8 redB,
            bool finalized
        )
    {
        MatchInfo storage game = matches[_matchId];

        return (
            game.teamA,
            game.teamB,
            game.scoreA,
            game.scoreB,
            game.yellowA,
            game.redA,
            game.yellowB,
            game.redB,
            game.finalized
        );
    }

    // =====================================
    // 7. TRA CUU THOI GIAN VA SAN
    // =====================================

    function getMatchDetails(
        uint256 _matchId
    )
        external
        view
        matchExists(_matchId)
        returns (
            uint64 startTime,
            string memory venue
        )
    {
        MatchInfo storage game = matches[_matchId];

        return (
            game.startTime,
            game.venue
        );
    }

    // =====================================
    // 8. DANH SACH CAU THU GHI BAN
    // =====================================

    function getGoals(
        uint256 _matchId
    )
        external
        view
        matchExists(_matchId)
        returns (GoalInfo[] memory)
    {
        return goals[_matchId];
    }

    // =====================================
    // 9. DANH SACH THE PHAT CHI TIET
    // =====================================

    function getCardDetails(
        uint256 _matchId
    )
        external
        view
        matchExists(_matchId)
        returns (CardInfo[] memory)
    {
        return cards[_matchId];
    }

    // =====================================
    // DIEU CHINH TONG BAN THANG
    // =====================================

    function _adjustScore(
        uint256 matchId,
        uint8 team,
        bool increase
    ) internal {
        MatchInfo storage m = matches[matchId];

        if (team == 1) {
            if (increase) {
                require(m.scoreA < 255, "Score limit");
                m.scoreA++;
            } else {
                require(m.scoreA > 0, "Invalid score");
                m.scoreA--;
            }
        } else if (team == 2) {
            if (increase) {
                require(m.scoreB < 255, "Score limit");
                m.scoreB++;
            } else {
                require(m.scoreB > 0, "Invalid score");
                m.scoreB--;
            }
        } else {
            revert("Invalid team");
        }
    }

    // =====================================
    // DIEU CHINH TONG THE PHAT
    // =====================================

    function _adjustCards(
        uint256 matchId,
        uint8 team,
        uint8 cardType,
        bool increase
    ) internal {
        MatchInfo storage m = matches[matchId];

        if (team == 1 && cardType == 1) {
            if (increase) {
                require(m.yellowA < 255, "Card limit");
                m.yellowA++;
            } else {
                require(m.yellowA > 0, "Invalid count");
                m.yellowA--;
            }
        } else if (team == 1 && cardType == 2) {
            if (increase) {
                require(m.redA < 255, "Card limit");
                m.redA++;
            } else {
                require(m.redA > 0, "Invalid count");
                m.redA--;
            }
        } else if (team == 2 && cardType == 1) {
            if (increase) {
                require(m.yellowB < 255, "Card limit");
                m.yellowB++;
            } else {
                require(m.yellowB > 0, "Invalid count");
                m.yellowB--;
            }
        } else if (team == 2 && cardType == 2) {
            if (increase) {
                require(m.redB < 255, "Card limit");
                m.redB++;
            } else {
                require(m.redB > 0, "Invalid count");
                m.redB--;
            }
        } else {
            revert("Invalid team or card");
        }
    }

    // =====================================
    // 10. SUA THONG TIN BAN THANG
    // =====================================

    function correctGoal(
        uint256 matchId,
        uint256 goalIndex,
        string calldata newPlayer,
        uint8 newTeam,
        uint16 newMinute
    )
        external
        onlyOwner
        editable(matchId)
    {
        require(
            goalIndex < goals[matchId].length,
            "Goal not found"
        );

        require(
            !goalCancelled[matchId][goalIndex],
            "Goal already cancelled"
        );

        require(bytes(newPlayer).length > 0, "Empty player");
        require(newTeam == 1 || newTeam == 2, "Invalid team");
        require(
            newMinute > 0 && newMinute <= 180,
            "Invalid minute"
        );

        GoalInfo storage g = goals[matchId][goalIndex];

        emit GoalCorrected(
            matchId,
            goalIndex,
            g.playerName,
            g.team,
            g.minute,
            newPlayer,
            newTeam,
            newMinute
        );

        if (g.team != newTeam) {
            _adjustScore(matchId, g.team, false);
            _adjustScore(matchId, newTeam, true);
        }

        g.playerName = newPlayer;
        g.team = newTeam;
        g.minute = newMinute;

        MatchInfo storage m = matches[matchId];

        emit ScoreUpdated(
            matchId,
            m.scoreA,
            m.scoreB
        );
    }

    // =====================================
    // 11. HUY BAN THANG SAI
    // =====================================

    function cancelGoal(
        uint256 matchId,
        uint256 goalIndex
    )
        external
        onlyOwner
        editable(matchId)
    {
        require(
            goalIndex < goals[matchId].length,
            "Goal not found"
        );

        require(
            !goalCancelled[matchId][goalIndex],
            "Goal already cancelled"
        );

        GoalInfo storage g = goals[matchId][goalIndex];

        emit GoalCancelled(
            matchId,
            goalIndex,
            g.playerName,
            g.team,
            g.minute
        );

        goalCancelled[matchId][goalIndex] = true;

        _adjustScore(matchId, g.team, false);

        MatchInfo storage m = matches[matchId];

        emit ScoreUpdated(
            matchId,
            m.scoreA,
            m.scoreB
        );
    }

    // =====================================
    // 12. SUA THONG TIN THE PHAT
    // =====================================

    function correctCard(
        uint256 matchId,
        uint256 cardIndex,
        string calldata newPlayer,
        uint8 newTeam,
        uint8 newCardType,
        uint16 newMinute
    )
        external
        onlyOwner
        editable(matchId)
    {
        require(
            cardIndex < cards[matchId].length,
            "Card not found"
        );

        require(
            !cardCancelled[matchId][cardIndex],
            "Card already cancelled"
        );

        require(bytes(newPlayer).length > 0, "Empty player");
        require(newTeam == 1 || newTeam == 2, "Invalid team");
        require(
            newCardType == 1 || newCardType == 2,
            "Invalid card"
        );
        require(
            newMinute > 0 && newMinute <= 180,
            "Invalid minute"
        );

        CardInfo storage c = cards[matchId][cardIndex];

        emit CardCorrected(
            matchId,
            cardIndex,
            c.playerName,
            c.team,
            c.cardType,
            c.minute,
            newPlayer,
            newTeam,
            newCardType,
            newMinute
        );

        if (
            c.team != newTeam ||
            c.cardType != newCardType
        ) {
            _adjustCards(
                matchId,
                c.team,
                c.cardType,
                false
            );

            _adjustCards(
                matchId,
                newTeam,
                newCardType,
                true
            );
        }

        c.playerName = newPlayer;
        c.team = newTeam;
        c.cardType = newCardType;
        c.minute = newMinute;

        MatchInfo storage m = matches[matchId];

        emit CardsUpdated(
            matchId,
            m.yellowA,
            m.redA,
            m.yellowB,
            m.redB
        );
    }

    // =====================================
    // 13. HUY THE PHAT SAI
    // =====================================

    function cancelCard(
        uint256 matchId,
        uint256 cardIndex
    )
        external
        onlyOwner
        editable(matchId)
    {
        require(
            cardIndex < cards[matchId].length,
            "Card not found"
        );

        require(
            !cardCancelled[matchId][cardIndex],
            "Card already cancelled"
        );

        CardInfo storage c = cards[matchId][cardIndex];

        emit CardCancelled(
            matchId,
            cardIndex,
            c.playerName,
            c.team,
            c.cardType,
            c.minute
        );

        cardCancelled[matchId][cardIndex] = true;

        _adjustCards(
            matchId,
            c.team,
            c.cardType,
            false
        );

        MatchInfo storage m = matches[matchId];

        emit CardsUpdated(
            matchId,
            m.yellowA,
            m.redA,
            m.yellowB,
            m.redB
        );
    }

    // =====================================
    // 14. DANH SACH BAN THANG HOP LE
    // =====================================

    function getActiveGoals(
        uint256 matchId
    )
        external
        view
        matchExists(matchId)
        returns (GoalInfo[] memory)
    {
        uint256 total = goals[matchId].length;
        uint256 count = 0;

        for (uint256 i = 0; i < total; i++) {
            if (!goalCancelled[matchId][i]) {
                count++;
            }
        }

        GoalInfo[] memory result = new GoalInfo[](count);
        uint256 j = 0;

        for (uint256 i = 0; i < total; i++) {
            if (!goalCancelled[matchId][i]) {
                result[j] = goals[matchId][i];
                j++;
            }
        }

        return result;
    }

    // =====================================
    // 15. DANH SACH THE PHAT HOP LE
    // =====================================

    function getActiveCardDetails(
        uint256 matchId
    )
        external
        view
        matchExists(matchId)
        returns (CardInfo[] memory)
    {
        uint256 total = cards[matchId].length;
        uint256 count = 0;

        for (uint256 i = 0; i < total; i++) {
            if (!cardCancelled[matchId][i]) {
                count++;
            }
        }

        CardInfo[] memory result = new CardInfo[](count);
        uint256 j = 0;

        for (uint256 i = 0; i < total; i++) {
            if (!cardCancelled[matchId][i]) {
                result[j] = cards[matchId][i];
                j++;
            }
        }

        return result;
    }

}
