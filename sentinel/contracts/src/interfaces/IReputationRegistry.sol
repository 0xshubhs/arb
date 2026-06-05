// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReputationRegistry — ERC-8004 Reputation Registry (read surface)
/// @notice Matches the live-on-Arbitrum ERC-8004 ReputationRegistry. Agents are identified by
///         `agentId` (an ERC-721 tokenId in the IdentityRegistry), and reputation is read as an
///         aggregate "summary" of client feedback. Feedback is signed fixed-point:
///         `summaryValue` scaled by `10**summaryValueDecimals` (e.g. 87/100 => value 87, dec 0).
/// @dev    Live testnet addresses (Arbitrum Sepolia):
///         ReputationRegistry 0x8004B663056A597Dffe9eCcC1965A193B7388713
///         IdentityRegistry   0x8004A818BFB912233c491871b3d84c89A494BD9e
interface IReputationRegistry {
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}
