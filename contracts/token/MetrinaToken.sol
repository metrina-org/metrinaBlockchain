pragma solidity 0.6.2;

import "../access/Roles.sol";
import "./abstract/BridgeERC20.sol";
import "../interfaces/IRulable.sol";
import "../interfaces/ISuppliable.sol";
import "../interfaces/IMintable.sol";
import "../interfaces/IProcessor.sol";
import "./utils/EIP712.sol";
import "../interfaces/IERC2612.sol";

/**
 * @title MetrinaToken
 * @dev Metrina(Local)Token contract
 *
 * Error messages
 * SU01: Caller is not supplier
 * RU01: Rules and rules params don't have the same length
 * RE01: Rule id overflow
 * EX01: Authorization is expired
 * EX02: Authorization is not valid yet
 * EX03: Authorization is already used or cancelled
 * SI01: Invalid signature
 * BK01: To array is not the same size as values array
 * RD01: Redemtion time hasn't come yet
 * RD02: Not enough stable coin to redeem
 * RD03: Failed while transfering stable coin
 * RD04: zero token to stable coin rate
 **/

contract MetrinaToken is
    Initializable,
    IRulable,
    ISuppliable,
    IMintable,
    BridgeERC20,
    IERC2612
{
    using Roles for Roles.Role;
    using SafeMath for uint256;

    bytes32 public constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9; // = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")

    Roles.Role internal _suppliers;
    uint256 public redemptionTime;
    uint256[] internal _rules;
    uint256[] internal _rulesParams;
    /* EIP2612 Permit nonces */
    mapping(address => uint256) public nonces;
    /* EIP712 Domain Separator */
    bytes32 public DOMAIN_SEPARATOR;

    uint8 internal constant MAX_DECIMALS = 20;
    uint8 internal constant ETH_DECIMALS = 18;

    address public stableToken;
    address public stableTokenVault;

    function initialize(
        address owner,
        IProcessor processor,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address[] memory trustedIntermediaries,
        uint256 _redemptionTime,
        address _stableToken,
        address _stableTokenVault
    ) public virtual initializer {
        BridgeERC20.initialize(owner, processor);
        processor.register(name, symbol, decimals);
        _trustedIntermediaries = trustedIntermediaries;
        emit TrustedIntermediariesChanged(trustedIntermediaries);
        DOMAIN_SEPARATOR = EIP712.makeDomainSeparator(_processor.name(), "2");
        redemptionTime = _redemptionTime;
        stableToken = _stableToken;
        stableTokenVault = _stableTokenVault;
    }

    modifier onlySupplier() {
        require(isSupplier(_msgSender()), "SU01");
        _;
    }

    /*
     * todo: needed?
     */
    function setStableToken(address _stableToken, address _stableTokenVault)
        external
        onlyAdministrator
    {
        stableToken = _stableToken;
        stableTokenVault = _stableTokenVault;
    }

    /**
     * @notice redemotion of token after deadline
     * @param owners The accounts to redeem tokens from
     */
    function redeem(address[] calldata owners) external onlyAdministrator {
        // solium-disable-next-line security/no-block-members
        require(now >= redemptionTime, "RD01");
        uint256 rate = this.convertTo(
            10**uint256(decimals()),
            IERC20Detailed(stableToken).symbol(),
            MAX_DECIMALS
        );
        uint256 decimals = IERC20Detailed(stableToken).decimals();
        require(rate != 0, "RD04");
        uint256 stableAmount;
        uint256 balance;
        for (uint256 i = 0; i < owners.length; i++) {
            balance = balanceOf(owners[i]);
            if (balance != 0) {
                stableAmount = balance.mul(rate).div(
                    10**(uint256(2 * MAX_DECIMALS) - decimals)
                );
                require(stableAmount > 0, "RD02");
                _processor.seize(_msgSender(), owners[i], balance);
                // solium-disable-next-line security/no-send
                require(
                    IERC20Detailed(stableToken).transferFrom(
                        stableTokenVault,
                        owners[i],
                        stableAmount
                    ),
                    "RD03"
                );
            }
        }
    }

    function isSeizer(address _seizer) public view returns (bool) {
        return owner() == _seizer;
    }

    /* Mintable */
    function isSupplier(address _supplier) public view override returns (bool) {
        return _suppliers.has(_supplier);
    }

    function addSupplier(address _supplier) public override onlyAdministrator {
        _suppliers.add(_supplier);
        emit SupplierAdded(_supplier);
    }

    function removeSupplier(address _supplier)
        public
        override
        onlyAdministrator
    {
        _suppliers.remove(_supplier);
        emit SupplierRemoved(_supplier);
    }

    function mint(address _to, uint256 _amount)
        public
        override
        onlySupplier
        hasProcessor
    {
        _processor.mint(_msgSender(), _to, _amount);
        emit Mint(_to, _amount);
        emit Transfer(address(0), _to, _amount);
    }

    /* Rulable */
    function rules()
        public
        view
        override
        returns (uint256[] memory, uint256[] memory)
    {
        return (_rules, _rulesParams);
    }

    function rule(uint256 ruleId)
        public
        view
        override
        returns (uint256, uint256)
    {
        require(ruleId < _rules.length, "RE01");
        return (_rules[ruleId], _rulesParams[ruleId]);
    }

    function canTransfer(
        address _from,
        address _to,
        uint256 _amount
    )
        public
        view
        override
        hasProcessor
        returns (
            bool,
            uint256,
            uint256
        )
    {
        return _processor.canTransfer(_from, _to, _amount);
    }

    /**
     * @dev bulk transfer tokens to specified addresses
     * @param _to The array of addresses to transfer to.
     * @param _values The array of amounts to be transferred.
     */
    function bulkTransfer(address[] calldata _to, uint256[] calldata _values)
        external
        hasProcessor
    {
        require(_to.length == _values.length, "BK01");
        for (uint256 i = 0; i < _to.length; i++) {
            _transferFrom(_msgSender(), _to[i], _values[i]);
        }
    }

    function setRules(
        uint256[] calldata newRules,
        uint256[] calldata newRulesParams
    ) external override onlyAdministrator {
        require(newRules.length == newRulesParams.length, "RU01");
        _rules = newRules;
        _rulesParams = newRulesParams;
        emit RulesChanged(_rules, _rulesParams);
    }

    /* EIP2612 - Initial code from https://github.com/centrehq/centre-tokens/blob/master/contracts/v2/Permit.sol */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override hasProcessor {
        require(deadline >= block.timestamp, "EX01");

        bytes memory data = abi.encode(
            PERMIT_TYPEHASH,
            owner,
            spender,
            value,
            nonces[owner]++,
            deadline
        );
        require(
            EIP712.recover(DOMAIN_SEPARATOR, v, r, s, data) == owner,
            "SI01"
        );

        _approve(owner, spender, value);
    }

    /* Reserved slots for future use: https://docs.openzeppelin.com/sdk/2.5/writing-contracts.html#modifying-your-contracts */
    uint256[50] private ______gap;
}
