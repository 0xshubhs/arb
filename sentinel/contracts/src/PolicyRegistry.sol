// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title PolicyRegistry
/// @notice Each user mints a transferable, ownable **Policy NFT** that encodes the spend
///         rules SENTINEL enforces for their agent. The policy lives on-chain; the off-chain
///         Claude "mandate compiler" only authors it — it never enforces.
contract PolicyRegistry is ERC721 {
    struct PolicyConfig {
        uint256 velocityCapPerTx; // max single spend (USDC, 6dp)
        uint256 dailyCapUSDC; // rolling-24h cap
        uint16 drawdownBps; // halt if value drops this much from high-water
        uint16 minCounterpartyReputation; // 0..100 gate
        bool killSwitched; // per-policy kill switch
    }

    uint256 public nextId = 1;

    mapping(uint256 tokenId => PolicyConfig) private _policies;
    mapping(uint256 tokenId => mapping(address counterparty => bool)) private _denylist;

    event PolicyCreated(uint256 indexed tokenId, address indexed owner);
    event PolicyUpdated(uint256 indexed tokenId, bytes32 configHash);
    event KillSwitchFlipped(uint256 indexed tokenId, bool on);
    event DenylistUpdated(uint256 indexed tokenId, address indexed counterparty, bool denied);

    error NotPolicyOwner();
    error InvalidConfig();

    constructor() ERC721("SENTINEL Policy", "SENTINEL") {}

    modifier onlyPolicyOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) revert NotPolicyOwner();
        _;
    }

    /// @notice Mint a Policy NFT to the caller with the given config.
    function mint(PolicyConfig calldata cfg) external returns (uint256 tokenId) {
        _validate(cfg);
        tokenId = nextId++;
        _policies[tokenId] = cfg;
        _mint(msg.sender, tokenId);
        emit PolicyCreated(tokenId, msg.sender);
        emit PolicyUpdated(tokenId, keccak256(abi.encode(cfg)));
    }

    /// @notice Replace a policy's config (owner only).
    function update(uint256 tokenId, PolicyConfig calldata cfg) external onlyPolicyOwner(tokenId) {
        _validate(cfg);
        _policies[tokenId] = cfg;
        emit PolicyUpdated(tokenId, keccak256(abi.encode(cfg)));
    }

    /// @notice Flip the per-policy kill switch — every `checkSpend` for it then reverts.
    function killSwitch(uint256 tokenId, bool on) external onlyPolicyOwner(tokenId) {
        _policies[tokenId].killSwitched = on;
        emit KillSwitchFlipped(tokenId, on);
    }

    /// @notice Add/remove a local counterparty denylist entry (fallback for ERC-8004).
    function setDenied(uint256 tokenId, address counterparty, bool denied) external onlyPolicyOwner(tokenId) {
        _denylist[tokenId][counterparty] = denied;
        emit DenylistUpdated(tokenId, counterparty, denied);
    }

    function getConfig(uint256 tokenId) external view returns (PolicyConfig memory) {
        ownerOf(tokenId); // reverts if the policy does not exist
        return _policies[tokenId];
    }

    function isDenied(uint256 tokenId, address counterparty) external view returns (bool) {
        return _denylist[tokenId][counterparty];
    }

    function _validate(PolicyConfig calldata cfg) internal pure {
        if (cfg.velocityCapPerTx == 0 || cfg.dailyCapUSDC == 0) revert InvalidConfig();
        if (cfg.drawdownBps > 10_000) revert InvalidConfig();
        if (cfg.minCounterpartyReputation > 100) revert InvalidConfig();
    }
}
