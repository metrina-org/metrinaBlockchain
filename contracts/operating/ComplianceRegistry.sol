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
import "../interfaces/IComplianceRegistry.sol";
import "../interfaces/IPriceable.sol";
import "../interfaces/IGovernable.sol";
import "../interfaces/IERC20Detailed.sol";
import "../access/Operator.sol";


/**
 * @title ComplianceRegistry
 * @dev The Compliance Registry stores user related attributes for multiple compliance authorities (named trusted intermediaries)
 *
 * Error messages
 * UR01: UserId is invalid
 * UR02: Address is already attached
 * UR03: Users length does not match with addresses length
 * UR04: Address is not attached
 * UR05: Attribute keys length does not match with attribute values length
 * UR06: Transfer and transfer decisions must have the same length
 * UR07: Only originator can cancel transfer
 * UR08: Unsuccessful transfer
 * UR09: Only on hold transfers can be canceled
*/
contract ComplianceRegistry is Initializable, Operator, IComplianceRegistry {
  using SafeMath for uint256;

  uint256 public constant VERSION = 2;

  mapping(address => uint256) public userCount;
  mapping(address => mapping(uint256 => mapping(uint256 => uint256))) internal userAttributes;
  mapping(address => mapping(uint256 => address[])) internal userAddresses;
  mapping(address => mapping(address => uint256)) internal addressUsers;

  uint256 internal constant USER_VALID_UNTIL_KEY = 0;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  */
  function initialize(address owner) public override initializer {
    Operator.initialize(owner);
  }

  /**
   * @dev fetch the userId associated to the provided address registered by trusted intermediaries
   * @dev The algorithm loops through each trusted intermediary and returns the first userId found 
   * @dev even if the user exists for next trusted intermediaries
   * @param _trustedIntermediaries array of trusted intermediaries to look the address for
   * @param _address address to look for
   * @return userId the user id found, 0 if not found
   * @return the address of the first trusted intermediary for which the user was found, 0x0 if no user was found
   */
  function userId(
    address[] calldata _trustedIntermediaries, 
    address _address
  ) 
    external override view returns (uint256, address) 
  {
    return _getUser(_trustedIntermediaries, _address);
  }

  /**
   * @dev returns the date at which user validity ends (UNIX timestamp)
   * @param _trustedIntermediary the reference trusted intermediary of the user
   * @param _userId the userId for which the validity date has to be returned
   * @return the date at which user validity ends (UNIX timestamp)
   */
  function validUntil(address _trustedIntermediary, uint256 _userId) public override view returns (uint256) {
    return userAttributes[_trustedIntermediary][_userId][USER_VALID_UNTIL_KEY];
  }

  /**
   * @dev get one user attribute
   * @param _trustedIntermediary the reference trusted intermediary of the user
   * @param _userId the userId for which the attribute has to be returned
   * @param _key the key of the attribute to return
   * @return the attribute value for the pair (_userId, _key), defaults to 0 if _key or _userId not found
   */
  function attribute(address _trustedIntermediary, uint256 _userId, uint256 _key)
    public override view returns (uint256)
  {
    return userAttributes[_trustedIntermediary][_userId][_key];
  }
  
  /**
  * @dev access to multiple user attributes at once
  * @param _trustedIntermediary the reference trusted intermediary of the user
  * @param _userId the userId for which attributes have to be returned
  * @param _keys array of keys of attributes to return
  * @return the attribute values for each pair (_userId, _key), defaults to 0 if _key or _userId not found
  **/
  function attributes(address _trustedIntermediary, uint256 _userId, uint256[] calldata _keys) 
    external override view returns (uint256[] memory)
  {
    uint256[] memory values = new uint256[](_keys.length);
    for (uint256 i = 0; i < _keys.length; i++) {
      values[i] = userAttributes[_trustedIntermediary][_userId][_keys[i]];
    }
    return values;
  }

  /**
   * @dev Get the validaty of an address for trusted intermediaries
   * @param _trustedIntermediaries array of trusted intermediaries to look the address for
   * @param _address address to look for
   * @return true if a user corresponding to the address was found for a trusted intermediary and is not expired, false otherwise
   */
  function isAddressValid(address[] calldata _trustedIntermediaries, address _address) external override view returns (bool) {
    uint256 _userId;
    address _trustedIntermediary;
    (_userId, _trustedIntermediary) = _getUser(_trustedIntermediaries, _address);
    return _isValid(_trustedIntermediary, _userId);
  }

  /**
   * @dev checks if the user id passed in parameter is not expired
   * @param _trustedIntermediary the reference trusted intermediary of the user
   * @param _userId the userId to be checked
   * @return true if a user was found for the trusted intermediary and is not expired, false otherwise
   */
  function isValid(address _trustedIntermediary, uint256 _userId) public override view returns (bool) {
    return _isValid(_trustedIntermediary, _userId);
  }

  /**
   * @dev Registers a new user corresponding to an address and sets its initial attributes
   * @dev Intended to be called from a trusted intermediary key
   * @dev Throws UR05 if _attributeKeys length is not the same as _attributeValues length
   * @dev Throws UR02 if address is already registered to a user
   * @dev Emits AddressAttached event
   * @param _address the address to register
   * @param _attributeKeys array of keys of attributes to set
   * @param _attributeValues array of values of attributes to set
   */
  function registerUser(address _address, uint256[] calldata _attributeKeys, uint256[] calldata _attributeValues)
    external override
  {
    require(_attributeKeys.length == _attributeValues.length, "UR05");
    require(addressUsers[_msgSender()][_address] == 0, "UR02");
    _registerUser(_address, _attributeKeys, _attributeValues);
  }

  /**
   * @dev Registers multiple users corresponding to addresses and sets their initial attributes
   * @dev Intended to be called from a trusted intermediary key
   * @dev Ignores already registered addresses
   * @dev Throws UR05 if _attributeKeys length is not the same as _attributeValues length
   * @dev Emits multiple AddressAttached events
   * @param _addresses the array of addresses to register
   * @param _attributeKeys array of keys of attributes to set
   * @param _attributeValues array of values of attributes to set
   */
  function registerUsers(
    address[] calldata _addresses, 
    uint256[] calldata _attributeKeys, 
    uint256[] calldata _attributeValues
  ) 
    external override
  {
    require(_attributeKeys.length == _attributeValues.length, "UR05");
    for (uint256 i = 0; i < _addresses.length; i++) {
      if (addressUsers[_msgSender()][_addresses[i]] == 0) {
        _registerUser(_addresses[i], _attributeKeys, _attributeValues);
      }
    }
  }

  /**
   * @dev Attach an address to an existing user
   * @dev Intended to be called from a trusted intermediary key
   * @dev Throws UR01 if user does not exist
   * @dev Throws UR02 if address is already attached
   * @dev Emits AddressAttached event
   * @param _userId the user id to which the address will be attached
   * @param _address the address to attach
   */
  function attachAddress(uint256 _userId, address _address)
    public override
  {
    require(_userId > 0 && _userId <= userCount[_msgSender()], "UR01");
    _attachAddress(_userId, _address);
  }

  /**
   * @dev Attach addresses to existing users
   * @dev Intended to be called from a trusted intermediary key
   * @dev Throws UR03 if _addresses length does not match _userIds length
   * @dev Throws UR02 if an address is already attached
   * @dev Throws UR01 if user does not exist
   * @dev Emits multiple AddressAttached events
   * @param _userIds array of user ids to which an address will be attached
   * @param _addresses array of addresses to attach
   */
  function attachAddresses(uint256[] calldata _userIds, address[] calldata _addresses)
    external override
  {
    require(_addresses.length == _userIds.length, "UR03");
    uint256 _userCount = userCount[_msgSender()];
    for (uint256 i = 0; i < _addresses.length; i++) {
      require(_userIds[i] > 0 && _userIds[i] <= _userCount, "UR01");
      _attachAddress(_userIds[i], _addresses[i]);
    }
  }

  /**
   * @dev Detach an address from a user
   * @dev Intended to be called from a trusted intermediary key
   * @dev Throws UR04 if the address is not attached
   * @dev Emits AddressDetached event
   * @param _address address to detach
   */
  function detachAddress(address _address) public override {
    _detachAddress(_address);
  }

  /**
   * @dev Detach addresses from their respective user
   * @dev Intended to be called from a trusted intermediary key
   * @dev Throws UR04 if an address is not attached
   * @dev Emits multiple AddressDetached events
   * @param _addresses array of addresses to detach
   */
  function detachAddresses(address[] calldata _addresses) external override {
    for (uint256 i = 0; i < _addresses.length; i++) {
      _detachAddress(_addresses[i]);
    }
  }

  /**
   * @dev Updates attributes for a user
   * @dev Intended to be called from a trusted intermediary key
   * @dev Throws UR05 if _attributeKeys length is not the same as _attributeValues length
   * @dev Throws UR01 user is not found
   * @param _userId the user id for which the attributes are updated
   * @param _attributeKeys array of keys of attributes to set
   * @param _attributeValues array of values of attributes to set
   */
  function updateUserAttributes(
    uint256 _userId, 
    uint256[] calldata _attributeKeys, 
    uint256[] calldata _attributeValues
  )
    external override
  {
    require(_attributeKeys.length == _attributeValues.length, "UR05");
    require(_userId > 0 && _userId <= userCount[_msgSender()], "UR01");
    _updateUserAttributes(_userId, _attributeKeys, _attributeValues);
  }

  /**
   * @dev Updates attributes for many users
   * @dev Intended to be called from a trusted intermediary key
   * @dev Throws UR05 if _attributeKeys length is not the same as _attributeValues length
   * @dev Ignores not found users
   * @param _userIds the user ids for which the attributes are updated
   * @param _attributeKeys array of keys of attributes to set
   * @param _attributeValues array of values of attributes to set
   */
  function updateUsersAttributes(
    uint256[] calldata _userIds,
    uint256[] calldata _attributeKeys, 
    uint256[] calldata _attributeValues
  ) external override
  {
    require(_attributeKeys.length == _attributeValues.length, "UR05");
    uint256 _userCount = userCount[_msgSender()];
    for (uint256 i = 0; i < _userIds.length; i++) {
      if (_userIds[i] > 0 && _userIds[i] <= _userCount) {
        _updateUserAttributes(_userIds[i], _attributeKeys, _attributeValues);
      }
    }
  }

  /**
   * @dev Registers a new user corresponding to an address and sets its initial attributes
   * @param _address the address to register
   * @param _attributeKeys array of keys of attributes to set
   * @param _attributeValues array of values of attributes to set
   */
  function _registerUser(address _address, uint256[] memory _attributeKeys, uint256[] memory _attributeValues)
    internal
  {
    uint256 _userCount = userCount[_msgSender()];
    _updateUserAttributes(++_userCount, _attributeKeys, _attributeValues);
    addressUsers[_msgSender()][_address] = _userCount;
    userAddresses[_msgSender()][_userCount].push(_address);

    emit AddressAttached(_msgSender(), _userCount, _address);
    userCount[_msgSender()] = _userCount;
  }

  /**
   * @dev Updates attributes for a user
   * @param _userId the user id for which the attributes are updated
   * @param _attributeKeys array of keys of attributes to set
   * @param _attributeValues array of values of attributes to set
   */
  function _updateUserAttributes(uint256 _userId, uint256[] memory _attributeKeys, uint256[] memory _attributeValues) 
    internal 
  {
    for (uint256 i = 0; i < _attributeKeys.length; i++) {
      userAttributes[_msgSender()][_userId][_attributeKeys[i]] = _attributeValues[i];
    }
  }

  /**
   * @dev Attach an address to an existing user
   * @param _userId the user id to which the address will be attached
   * @param _address the address to attach
   */
  function _attachAddress(uint256 _userId, address _address) internal {
    require(addressUsers[_msgSender()][_address] == 0, "UR02");
    addressUsers[_msgSender()][_address] = _userId;
    userAddresses[_msgSender()][_userId].push(_address);

    emit AddressAttached(_msgSender(), _userId, _address);
  }

  /**
   * @dev Detach an address from a user
   * @param _address address to detach
   */
  function _detachAddress(address _address) internal {
    uint256 addressUserId = addressUsers[_msgSender()][_address];
    require(addressUserId != 0, "UR04");
    delete addressUsers[_msgSender()][_address];
    uint256 userAddressesLength = userAddresses[_msgSender()][addressUserId].length;
    for (uint256 i = 0; i < userAddressesLength; i++) {
      if (userAddresses[_msgSender()][addressUserId][i] == _address) {
        /* For gas efficiency, we only delete the slot and accept that address 0x0 can be present */
        delete userAddresses[_msgSender()][addressUserId][i];
        break;
      }
    }
    emit AddressDetached(_msgSender(), addressUserId, _address);
  }

  /**
   * @dev Checks if the user id passed in parameter is not expired
   * @param _trustedIntermediary the reference trusted intermediary of the user
   * @param _userId the userId to be checked
   * @return true if a user was found for the trusted intermediary and is not expired, false otherwise
   */
  function _isValid(address _trustedIntermediary, uint256 _userId) internal view returns (bool) {
    // solium-disable-next-line security/no-block-members
    return userAttributes[_trustedIntermediary][_userId][USER_VALID_UNTIL_KEY] > now;
  }

  /**
   * @dev fetch the userId associated to the provided address registered by trusted intermediaries
   * @dev The algorithm loops through each trusted intermediary and returns the first userId found 
   * @dev even if the user exists for next trusted intermediaries
   * @param _trustedIntermediaries array of trusted intermediaries to look the address for
   * @param _address address to look for
   * @return userId the user id found, 0 if not found
   * @return the address of the first trusted intermediary for which the user was found, 0x0 if no user was found
   */
  function _getUser(address[] memory _trustedIntermediaries, address _address) 
    internal view returns (uint256, address) 
  {
    uint256 _userId;
    for (uint256 i = 0; i < _trustedIntermediaries.length; i++) {
      _userId = addressUsers[_trustedIntermediaries[i]][_address];
      if (_userId != 0) {
        return (_userId, _trustedIntermediaries[i]);
      }
    }
    return (0, address(0));
  }

}
