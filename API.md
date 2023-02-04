
# Smart Contracts API
This API is intended to be used in back-end development of platform which contains:
+ Compliance Registry
    - User Registration
    - Check Validation
    - Change User Address
+ Token
    - Mint
    - Transfer
    - Redemption
    - Get Balance
    - Check transfarability
+ Price Oracle
    - Set Exchange Rate
    - Get Exchange Rate
+ Sale
    - Invest Reference Currency
    - Invest Stable Coin

## Compliance Registry
### User Registration
Tokens use `ValidRule` which enforces that only registered users can transfer their token. ***Tokens can still be minted for or burned/seized from unregistered users***.
For registration, each user can be assigned multiple attributes which are introduced in form of key/value pairs. Currently only `USER_VALID_UNTIL_KEY` attribute is used, which has value of zero and its value determine the time (in UTC timestamp) after which the user is considered invalid. In order to register a user, this method should be used:
> `ComplianceRegistry.registerUser(address _user, uint256[] _attributeKeys, uint256[] _attributeValues) external`

as mentioned above, currently the only attribute used is valid date of the user, so the usage will be:
> `ComplianceRegistry.registerUser(u, [0], [timestamp])`

#### Notes:
1. Anyone can do the registration, but since each token has a list of `Trusted Intermediaries` and considers users registered by them as valid, users should be registered by accounts that is listed as trusted in a token, otherwise it would be a waste of gas.
1. Registration can be done in bulk, i.e. registering multiple users with one method call. **It is recommended to do so if possible**. Following snippet shows registering multiple users with different valid periods.
    > `ComplianceRegistry.registerUsers([u1, ..., un], [0, ..., 0], [t1, ..., tn])`
1. If user is already registered, using `registerUser` method will lead to an error while `registerUsers` will ignore the registered users.
#### Error messages
 * UR02: Address is already attached
 * UR05: Attribute keys length does not match with attribute values length
 
### Check Validation
It's possible to check if a user is valid without paying gas. In order to do that we need list of registrants, known as `Trusted Intermediaries`, and the address of user to be validated.
> `ComplianceRegistry.isAddressValid(address[] _trustedIntermediaries, address _address) external`

#### Notes:
1. This method **SHOULD NOT** be used to check a token can be transferred or not. Each token exposes a dedicated method to do that and that method can be used before initiating a token transfer to avoid encountering error after sending transaction(this will cause gas being wasted)
1. It can be handy for external users to check if their address is considered valid by the platform, so a public API could be exposed too; although the address of trusted intermediaries should be known, which can be fetched from token contract.

### Change User Address
If a user, after being registered, wants to change its address (for example it wants to use non-custodial wallet), it can be done using the current `userId` and the new address. Each user has an ID which is the index of it in the list of registered users by a trusted intermediary. In order to get the ID of a user with address `userAddress` against a list of trusted intermediaries, one should use:
> `ComplianceRegistry.userId(trustedIntermediaries, userAddress) external`

Using the ID, the address an be changed by first detaching it from previous address and then attaching it to the new one:
> `ComplianceRegistry.detachAddress(userAddress) public`
> 
> `ComplianceRegistry.attachAddress(userId, newUserAddress) public`

#### Notes:
1. There are bulk versions for mentioned methods, i.e. `attachAddresses` and `detachAddresses`.
1. The user should be registered before attaching new address.
1. Only trusted intermediary detach or attach addresses.
1. If an address is registered by multiple trusted intermediaries, the ID of firs one found in the list will be returned.
1. Detaching a user can be considered as un-registering it. another way is changing the valid time by setting user attribute.

#### Error messages
 * UR01: UserId is invalid
 * UR02: Address is already attached
 * UR03: Users length does not match with addresses length
 * UR04: Address is not attached
 
## Token
### Mint
Minting a token can only be done by `Supplier` role. The receiver of minted token doesn't need to be registered.
> `MetrinaToken.mint(address _to, uint256 _amount)`

### Transfer
Since Metrina token is an ERC20 token, it can be transferred directly by the owner or by some other address which is given allowance by the owner to transfer token up to a specified limit. It also suuports EIP-2612, allowing approving tokens without owner of tokens paying for gas. 
#### Transfer Directly
> `MetrinaToken.transfer(address _to, uint256 _value) public`

#### Transfer using allowance
> `MetrinaToken.transferFrom(address _from, address _to, uint256 _value) public`

#### Transfer without paying gas
refer [here](./test/token.js#L180) for complete usage example.
> `MetrinaToken.permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external`

#### Bulk transfer
> `MetrinaToken.bulkTransfer(address[] _to, uint256[] _values) external`

### Redemption
Tokens can be redeemed for unregistered users. Only admin of token contract can redeem tokens.
> `MetrinaToken.redeem(address[] calldata owners) onlyAdministrator`

### Get Balance
Balance of an address can be retrieved with:
> `MetrinaToken.balanceOf(address _owner) public returns (uint256)`

### Check transfarability
To check if a tranfer can be done (check cpmliance with rules and enough balance), this method can be used:
> `MetrinaToken.canTransfer(address _from, address _to, uint256 _amount) public returns (bool, uint256, uint256)`

#### Notes:
1. The return value consists of:
    * isValid: True if the transfer is valid, false otherwise
    * ruleId: The ruleId that first rejected the transfer
    * reason: The reason code for the transfer rejection

## Price Oracle
### Set Price
Set exchage rate between currency with symbol `_currency1` and `_currency2` with arbitrary decimals.
> `PriceOracle.setPrice(bytes32 _currency1, bytes32 _currency2, uint256 _price, uint8 _decimals) public onlyOperator`

#### Notes:
1. Only operator or owner of contract can call this method.
1. not the datatype used for currencies is `byte32` which is a fixed length string.
1. There's bulk version of this method named `setPrices`.

## Get Price
Get exchange rate between two currencys, that is how much each unit of `_currency1` is in `_currency2`. It returns the rate with its deimal points.
> `PriceOracle.getPrice(bytes32 _currency1, bytes32 _currency2) public returns (uint256, uint8)`

#### Notes:
1. There's an overloaded version of this method with `string` datatype for input arguments.
1. If no exchange rate is set for the pair, zero is returned.

## Sale
In both investing methods, both the vault and the investor should be registered.

### Invest Reference Currency
This can be done only by operator of sale and doesn't need the sale to be open. Basically it's the same as transferring token from vault to the investor by calculated price, which can be done off-chain if vault is accessible.
> `MetrinaTokenSale.investRefCurrency(address _investor, uint256 _amount)`

### Notes
1. Reference currency is currenctly defined as **TMN** (representing Toman) which can be set for each token.
1. Each sale has start and end time during which exchange is allowed.

#### Error messages
 * TS01: Sale is currently closed
 * TS04: Transfer rejected by token rules
 * TS07: Token transfer error
 * TS09: Token to ref currency rate is 0
 * TS10: Computed token amount is 0
 * TS12: Stable transfer error
 

### Invest Stable Coin
But token using stable coin. One should make sure to have given enough allowance to the contract before calling this method.
> `MetrinaTokenSale.investStable(uint256 _amount)`

#### Error messages
 * TS01: Sale is currently closed
 * TS04: Transfer rejected by token rules
 * TS06: Token to Coin rate is 0
 * TS07: Token transfer error
 * TS10: Computed token amount is 0
 * TS12: Stable transfer error