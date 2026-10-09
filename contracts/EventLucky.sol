// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract EventLucky is ReentrancyGuard {
    struct Prize {
        uint256 amount;
        uint8 rank;
    }

    struct Registration {
        address player;
        uint16 chosenNumber;
        uint256 timestamp;
    }

    struct EventData {
        address host;
        string name;
        uint16 minNumber;
        uint16 maxNumber;
        uint256 registrationDeadline;
        uint256 revealDeadline;
        uint256 maxRegistrations;
        Prize[] prizes;
        Registration[] registrations;
        bool drawn;
        bytes32 secretHash;
        uint16 winningNumber;
        uint256 claimDeadline;
        bool exists;
        uint256 totalPrize;
        uint256 escrowRemaining;
    }

    IERC20 public immutable usdc;
    uint256 public nextEventId;

    mapping(uint256 => EventData) private eventsById;
    mapping(uint256 => mapping(address => bool)) public hasRegistered;
    mapping(uint256 => mapping(address => uint256)) public winnerAmount;
    mapping(uint256 => address[]) private eventWinners;
    mapping(uint256 => uint256) public unclaimedEscrow;

    event EventCreated(uint256 indexed eventId, address indexed host, string name, uint256 totalPrize);
    event PlayerRegistered(uint256 indexed eventId, address indexed player, uint16 chosenNumber, uint256 timestamp);
    event CommitDraw(uint256 indexed eventId, bytes32 secretHash);
    event DrawCompleted(uint256 indexed eventId, uint16 winningNumber, address[] winners, uint256[] amounts);
    event EventCancelled(uint256 indexed eventId);
    event PrizeClaimed(uint256 indexed eventId, address indexed winner, uint256 amount);
    event UnclaimedReclaimed(uint256 indexed eventId, address indexed host, uint256 amount);

    constructor(address _usdc) {
        require(_usdc != address(0), "invalid usdc");
        usdc = IERC20(_usdc);
    }

    function createEvent(
        string calldata name,
        uint16 minNumber,
        uint16 maxNumber,
        uint256 registrationDeadline,
        uint256[] calldata prizeAmounts,
        uint256 maxRegistrations
    ) external returns (uint256 eventId) {
        require(minNumber < maxNumber, "invalid range");
        require(registrationDeadline > block.timestamp, "invalid deadline");
        require(prizeAmounts.length >= 1, "no prizes");
        require(maxRegistrations > 0 && maxRegistrations <= 500, "invalid max registrations");

        uint256 totalPrize;
        for (uint256 i = 0; i < prizeAmounts.length; i++) {
            uint256 amount = prizeAmounts[i];
            require(amount > 0, "zero prize");
            totalPrize += amount;
        }

        eventId = nextEventId;
        nextEventId++;

        EventData storage ev = eventsById[eventId];
        ev.host = msg.sender;
        ev.name = name;
        ev.minNumber = minNumber;
        ev.maxNumber = maxNumber;
        ev.registrationDeadline = registrationDeadline;
        ev.maxRegistrations = maxRegistrations;
        ev.exists = true;
        ev.totalPrize = totalPrize;
        ev.escrowRemaining = totalPrize;

        for (uint256 i = 0; i < prizeAmounts.length; i++) {
            ev.prizes.push(Prize({amount: prizeAmounts[i], rank: uint8(i + 1)}));
        }

        require(usdc.transferFrom(msg.sender, address(this), totalPrize), "transferFrom failed");

        emit EventCreated(eventId, msg.sender, name, totalPrize);
    }

    function register(uint256 eventId, uint16 chosenNumber) external {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        require(!ev.drawn, "already drawn");
        require(block.timestamp <= ev.registrationDeadline, "registration closed");
        require(chosenNumber >= ev.minNumber && chosenNumber <= ev.maxNumber, "number out of range");
        require(!hasRegistered[eventId][msg.sender], "already registered");
        require(ev.registrations.length < ev.maxRegistrations, "registration limit reached");

        hasRegistered[eventId][msg.sender] = true;
        ev.registrations.push(
            Registration({player: msg.sender, chosenNumber: chosenNumber, timestamp: block.timestamp})
        );

        emit PlayerRegistered(eventId, msg.sender, chosenNumber, block.timestamp);
    }

    function commitDraw(uint256 eventId, bytes32 secretHash) external {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        require(msg.sender == ev.host, "not host");
        require(!ev.drawn, "already drawn");
        require(block.timestamp <= ev.registrationDeadline, "registration closed");

        ev.secretHash = secretHash;
        ev.revealDeadline = block.timestamp + 72 hours;

        emit CommitDraw(eventId, secretHash);
    }

    function draw(uint256 eventId, bytes32 secret) external {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        require(msg.sender == ev.host, "not host");
        require(!ev.drawn, "already drawn");
        require(block.timestamp > ev.registrationDeadline, "registration not ended");
        require(ev.secretHash != bytes32(0), "draw not committed");
        require(block.timestamp <= ev.revealDeadline, "reveal deadline passed");
        require(keccak256(abi.encodePacked(secret)) == ev.secretHash, "invalid secret");

        ev.drawn = true;
        ev.winningNumber =
            uint16(
                uint256(keccak256(abi.encodePacked(secret, blockhash(block.number - 1), eventId)))
                    % (ev.maxNumber - ev.minNumber + 1)
            ) + ev.minNumber;
        ev.claimDeadline = block.timestamp + 48 hours;

        uint256 prizeLen = ev.prizes.length;
        address[] memory matchedPlayers = new address[](prizeLen);
        uint256[] memory matchedTimestamps = new uint256[](prizeLen);
        uint256 matchedCount;

        uint256 regLen = ev.registrations.length;
        for (uint256 i = 0; i < regLen; i++) {
            Registration storage reg = ev.registrations[i];
            if (reg.chosenNumber != ev.winningNumber) {
                continue;
            }

            if (matchedCount < prizeLen) {
                matchedPlayers[matchedCount] = reg.player;
                matchedTimestamps[matchedCount] = reg.timestamp;
                matchedCount++;
            }
        }

        delete eventWinners[eventId];

        uint256 assignedCount;

        if (matchedCount == 0) {
            assignedCount = 0;
        } else if (matchedCount == 1) {
            assignedCount = 1;
        } else {
            assignedCount = 2 + _min(matchedCount - 2, prizeLen - 1);
        }

        address[] memory winners = new address[](assignedCount);
        uint256[] memory amounts = new uint256[](assignedCount);
        uint256 totalAssigned;
        uint256 outIndex;

        if (matchedCount == 1) {
            address winner = matchedPlayers[0];
            uint256 amount = ev.prizes[0].amount;

            winners[outIndex] = winner;
            amounts[outIndex] = amount;
            winnerAmount[eventId][winner] = amount;
            eventWinners[eventId].push(winner);

            totalAssigned += amount;
            outIndex++;
        } else if (matchedCount >= 2) {
            uint256 firstPrize = ev.prizes[0].amount;
            uint256 firstShare = (firstPrize * 60) / 100;
            uint256 secondShare = firstPrize - firstShare;

            address firstWinner = matchedPlayers[0];
            address secondWinner = matchedPlayers[1];

            winners[outIndex] = firstWinner;
            amounts[outIndex] = firstShare;
            winnerAmount[eventId][firstWinner] = firstShare;
            eventWinners[eventId].push(firstWinner);
            totalAssigned += firstShare;
            outIndex++;

            winners[outIndex] = secondWinner;
            amounts[outIndex] = secondShare;
            winnerAmount[eventId][secondWinner] = secondShare;
            eventWinners[eventId].push(secondWinner);
            totalAssigned += secondShare;
            outIndex++;

            uint256 extraAssignments = _min(matchedCount - 2, prizeLen - 1);
            for (uint256 i = 0; i < extraAssignments; i++) {
                address winner = matchedPlayers[i + 2];
                uint256 amount = ev.prizes[i + 1].amount;

                winners[outIndex] = winner;
                amounts[outIndex] = amount;
                winnerAmount[eventId][winner] = amount;
                eventWinners[eventId].push(winner);

                totalAssigned += amount;
                outIndex++;
            }
        }

        ev.escrowRemaining = totalAssigned;
        unclaimedEscrow[eventId] = ev.totalPrize - totalAssigned;

        emit DrawCompleted(eventId, ev.winningNumber, winners, amounts);
    }

    function cancelDraw(uint256 eventId) external {
        // Intentionally permissionless: anyone may cancel after deadline to prevent funds being locked if host is unresponsive.
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        require(!ev.drawn, "already drawn");
        require(block.timestamp > ev.registrationDeadline, "registration not ended");

        if (ev.secretHash == bytes32(0)) {
            require(block.timestamp > ev.registrationDeadline + 72 hours, "commit grace active");
        } else {
            require(block.timestamp > ev.revealDeadline, "reveal deadline not passed");
        }

        ev.drawn = true;
        delete eventWinners[eventId];
        unclaimedEscrow[eventId] = ev.escrowRemaining;
        ev.escrowRemaining = 0;

        emit EventCancelled(eventId);
    }

    /// @notice Host cancels an event that has no registrations yet and has not been drawn.
    ///         The locked USDC prize pool is returned to the host immediately.
    function cancelEvent(uint256 eventId) external nonReentrant {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        require(msg.sender == ev.host, "not host");
        require(!ev.drawn, "already drawn");
        require(ev.registrations.length == 0, "registrations exist");

        uint256 refund = ev.escrowRemaining;
        ev.escrowRemaining = 0;
        ev.drawn = true;

        if (refund > 0) {
            require(usdc.transfer(ev.host, refund), "cancel transfer failed");
        }

        emit EventCancelled(eventId);
    }

    function claim(uint256 eventId) external nonReentrant {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        require(ev.drawn, "not drawn");
        require(block.timestamp <= ev.claimDeadline, "claim period over");

        uint256 amount = winnerAmount[eventId][msg.sender];
        require(amount > 0, "nothing to claim");

        winnerAmount[eventId][msg.sender] = 0;
        ev.escrowRemaining -= amount;

        require(usdc.transfer(msg.sender, amount), "claim transfer failed");

        emit PrizeClaimed(eventId, msg.sender, amount);
    }

    function reclaimUnclaimed(uint256 eventId) external nonReentrant {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        require(ev.drawn, "not drawn");
        require(msg.sender == ev.host, "not host");

        bool noWinners = eventWinners[eventId].length == 0;
        if (!noWinners) {
            require(block.timestamp > ev.claimDeadline, "claim period active");
        }

        uint256 amount = ev.escrowRemaining + unclaimedEscrow[eventId];
        require(amount > 0, "nothing to reclaim");

        if (!noWinners) {
            address[] storage winners = eventWinners[eventId];
            for (uint256 i = 0; i < winners.length; i++) {
                winnerAmount[eventId][winners[i]] = 0;
            }
        }

        ev.escrowRemaining = 0;
        unclaimedEscrow[eventId] = 0;

        require(usdc.transfer(ev.host, amount), "reclaim transfer failed");

        emit UnclaimedReclaimed(eventId, ev.host, amount);
    }

    function getEvent(uint256 eventId)
        external
        view
        returns (
            address host,
            string memory name,
            uint16 minNumber,
            uint16 maxNumber,
            uint256 registrationDeadline,
            Prize[] memory prizes,
            bool drawn,
            uint16 winningNumber,
            uint256 claimDeadline,
            bool exists,
            uint256 totalPrize,
            uint256 escrowRemaining
        )
    {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");

        return (
            ev.host,
            ev.name,
            ev.minNumber,
            ev.maxNumber,
            ev.registrationDeadline,
            ev.prizes,
            ev.drawn,
            ev.winningNumber,
            ev.claimDeadline,
            ev.exists,
            ev.totalPrize,
            ev.escrowRemaining
        );
    }

    function getRegistrations(uint256 eventId) external view returns (Registration[] memory) {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");
        return ev.registrations;
    }

    function getWinners(uint256 eventId) external view returns (address[] memory winners, uint256[] memory amounts) {
        EventData storage ev = eventsById[eventId];
        require(ev.exists, "event not found");

        winners = eventWinners[eventId];
        amounts = new uint256[](winners.length);

        for (uint256 i = 0; i < winners.length; i++) {
            amounts[i] = winnerAmount[eventId][winners[i]];
        }
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
