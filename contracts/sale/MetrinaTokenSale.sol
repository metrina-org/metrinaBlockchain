/*
    Copyright (c) 2019 Mt Pelerin Group Ltd

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License version 3
    as published by the Free Software Foundation with the addition of the
    following permission added to Section 15 as permitted in Section 7(a):
    FOR ANY PART OF THE COVERED WORK IN WHICH THE COPYRIGHT IS OWNED BY
    MT PELERIN GROUP LTD. MT PELERIN GROUP LTD DISCLAIMS THE WARRANTY OF NON INFRINGEMENT
    OF THIRD PARTY RIGHTS

    This program is distributed in the hope that it will be useful, but
    WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE.
    See the GNU Affero General Public License for more details.
    You should have received a copy of the GNU Affero General Public License
    along with this program; if not, see http://www.gnu.org/licenses or write to
    the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
    Boston, MA, 02110-1301 USA, or download the license from the following URL:
    https://www.gnu.org/licenses/agpl-3.0.fr.html

    The interactive user interfaces in modified source and object code versions
    of this program must display Appropriate Legal Notices, as required under
    Section 5 of the GNU Affero General Public License.

    You can be released from the requirements of the license by purchasing
    a commercial license. Buying such a license is mandatory as soon as you
    develop commercial activities involving Mt Pelerin Group Ltd software without
    disclosing the source code of your own applications.
    These activities include: offering paid services based/using this product to customers,
    using this product in any application, distributing this product with a closed
    source product.

    For more information, please contact Mt Pelerin Group Ltd at this
    address: hello@mtpelerin.com
*/

pragma solidity 0.6.2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";
import "../interfaces/IERC20Detailed.sol";
import "../interfaces/IPriceable.sol";
import "../access/Operator.sol";


/**
 * @title TokenSale
 * @dev TokenSale contract
 *
 * Error messages
 * TS01: Sale is currently closed
 * TS02: Start date must be lower than end date
 * TS03: Ether withdrawal error
 * TS04: Transfer rejected by token rules
 * TS05: Ether and refCurrency amount must be mutually exclusive
 * TS06: Token to Ether rate is 0
 * TS07: Token transfer error
 * TS08: Call to default function with data forbidden
 * TS09: Token to ref currency rate is 0
 * TS10: Computed token amount is 0
 * TS11: Sale has already started
 * TS12: Stable transfer error
 */
contract MetrinaTokenSale is Initializable, PausableUpgradeSafe, Operator {
  using SafeMath for uint256;

  uint256 public constant VERSION = 1;

  address public token;
  address public stableToken;
  address public stableVault;
  address public tokenVault;
  string public refCurrency;
  uint8 public refCurrencyDecimals;
  uint256 public startAt;
  uint256 public endAt;

  uint8 internal constant MAX_DECIMALS = 20;

  function initialize(
    address _owner,
    address _token,
    address _stableToken,
    address _stableVault,
    address _tokenVault,
    string memory _refCurrency,
    uint8 _refCurrencyDecimals
  ) 
    public initializer 
  {
    Operator.initialize(_owner);
    __Pausable_init();
    token = _token;
    stableToken = _stableToken;
    stableVault = _stableVault;
    tokenVault = _tokenVault;
    refCurrency = _refCurrency;
    refCurrencyDecimals = _refCurrencyDecimals;
  }

  modifier isOpen {
    require(_currentTime() >= startAt && _currentTime() <= endAt, "TS01");
    _;
  }

  modifier beforeOpen {
    require(startAt == 0 || _currentTime() < startAt, "TS11");
    _;
  }

  function pause() public onlyOperator {
    _pause();
  }

  function unpause() public onlyOperator {
    _unpause();
  }

  function setSchedule(uint256 _startAt, uint256 _endAt) public onlyOperator beforeOpen {
    require(_startAt < _endAt, "TS02");
    startAt = _startAt;
    endAt = _endAt;
  }

  function investRefCurrency(address _investor, uint256 _amount) public onlyOperator {
    _investRefCurrency(_investor, _amount);
  }

  function investStable(uint256 _amount) public isOpen whenNotPaused {
    _investStable(_msgSender(), _amount);
  }

  function _investStable(address _investor, uint256 stableAmount) internal {
    require(stableAmount != 0, "TS05");
    uint256 rate;
    uint256 tokenAmount;
    rate = IPriceable(token).convertTo(10 ** uint256(IERC20Detailed(token).decimals()), IERC20Detailed(stableToken).symbol(), MAX_DECIMALS);
    require(rate != 0, "TS06");
    tokenAmount = stableAmount.mul(10**(uint256(2*MAX_DECIMALS) - uint256(IERC20Detailed(stableToken).decimals()))).div(rate);
    require(tokenAmount > 0, "TS10");
    require(IERC20Detailed(stableToken).transferFrom(_investor, stableVault, stableAmount), "TS12");
    require(IERC20Detailed(token).transferFrom(tokenVault, _investor, tokenAmount), "TS07");
  }

  function _investRefCurrency(address _investor, uint256 refCurrencyAmount) internal {
    require(refCurrencyAmount != 0, "TS05");
    uint256 rate;
    uint256 tokenAmount;
    rate = IPriceable(token).convertTo(10 ** uint256(IERC20Detailed(token).decimals()), refCurrency, MAX_DECIMALS);
    require(rate != 0, "TS09");
    tokenAmount = refCurrencyAmount.mul(10**(uint256(2*MAX_DECIMALS) - uint256(refCurrencyDecimals))).div(rate);
    require(tokenAmount > 0, "TS10");
    require(IERC20Detailed(token).transferFrom(tokenVault, _investor, tokenAmount), "TS07");
  }

  function _currentTime() private view returns (uint256) {
    // solium-disable-next-line security/no-block-members
    return now;
  }
}
