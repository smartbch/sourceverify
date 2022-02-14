// Sources flattened with hardhat v2.8.0 https://hardhat.org

// File contracts/ExchangeHub.sol

// SPDX-License-Identifier: Apache
pragma solidity 0.8.10;

//import "hardhat/console.sol";

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract ExchangeHub {
	struct Donation {
		uint256 amount_dueTime80_v8;
		bytes32 r;
		bytes32 s;
	}

	address constant private BCHAddress = 0x0000000000000000000000000000000000002711;
	string private constant EIP712_DOMAIN = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)";
	bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(EIP712_DOMAIN));
	bytes32 private constant NAME_HASH = keccak256(abi.encodePacked("exchange dapp"));
	bytes32 private constant VERSION_HASH = keccak256(abi.encodePacked("v0.1.0"));
	uint256 private constant CHAINID = 10000; // smartBCH mainnet
	bytes32 private constant SALT = keccak256(abi.encodePacked("Exchange"));
	bytes32 private constant TYPE_HASH = keccak256(abi.encodePacked("Exchange(uint256 coinsToMaker,uint256 coinsToTaker,uint256 campaignID,uint256 takerAddr_dueTime80)"));
	uint256 private constant MUL = 10**12; // number of picoseconds in one second
	uint256 private constant MaxClearCount = 10;

	//A maker can delegate an agent to sign coin-exchanging messages for him
	mapping(address => address) public makerToAgent;
	//To prevent replay of coin-exchanging messages, we use dueTime to identify a coin-exchanging message uniquely
	mapping(address => mapping(uint => uint)) public makerNextRecentDueTime; //the pointers of a linked-list
	mapping(address => uint) public makerRDTHeadTail; //the head and tail of a linked-list
	
	//A maker and a taker exchange their coins
	event Exchange(address indexed maker, uint256 coinsToMaker, uint256 coinsToTaker,
		       uint256 takerAddr_dueTime80);
	//The following events are used in crowdfunding campaign
	event CampaignStart(uint256 indexed campaignID, uint256 takerAddr_startEndTime,
			    uint256 totalCoinsToTaker, bytes32 introHash, bytes intro);
	event CampaignSuccess(uint256 indexed campaignID);
	event Donate(uint256 indexed campaignID, uint256 donatorAddr_timestamp,
		     uint256 amount_dueTime80_v8, bytes32 r, bytes32 s, string words);

	function getEIP712Hash(uint256 coinsToMaker, uint256 coinsToTaker, uint256 campaignID,
			       uint256 takerAddr_dueTime80) public view returns (bytes32) {
		bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
						     EIP712_DOMAIN_TYPEHASH,
						     NAME_HASH,
						     VERSION_HASH,
						     CHAINID,
						     address(this),
						     SALT));
		return keccak256(abi.encodePacked(
			"\x19\x01",
			DOMAIN_SEPARATOR,
			keccak256(abi.encode(
				TYPE_HASH,
				coinsToMaker,
				coinsToTaker,
				campaignID,
				takerAddr_dueTime80
			))
		));
	}

	function getSigner(uint256 coinsToMaker, uint256 coinsToTaker, uint256 campaignID,
			  uint256 takerAddr_dueTime80_v8, bytes32 r, bytes32 s) public view returns (address) {
		bytes32 eip712Hash = getEIP712Hash(coinsToMaker, coinsToTaker, campaignID,
						   takerAddr_dueTime80_v8>>8);
		uint8 v = uint8(takerAddr_dueTime80_v8); //the lowest byte is v
		return ecrecover(eip712Hash, v, r, s);
	}

	//Returns recent recorded dueTimes of a maker
	function getRecentDueTimes(address makerAddr, uint maxCount) external view returns (uint[] memory) {
		uint head = makerRDTHeadTail[makerAddr]>>80;
		uint[] memory recentDueTimes = new uint[](maxCount);
		for(uint i=0; i<maxCount && head != 0; i++) {
			recentDueTimes[i] = head;
			head = makerNextRecentDueTime[makerAddr][head];
		}
		return recentDueTimes;
	}

	//By adding a new dueTime entry in the linked-list, we can revoke a coin-exchanging message
	function addNewDueTime(uint newDueTime) external {
		require(newDueTime != 0, "invalid dueTime");
		uint currTime = block.timestamp*MUL;
		clearOldDueTimesAndInsertNew(msg.sender, newDueTime, currTime);
	}

	//Delete some useless entries from the linked list
	function clearOldDueTimes(uint maxCount, address makerAddr) external {
		uint currTime = block.timestamp*MUL;
		uint headTail = makerRDTHeadTail[makerAddr];
		(uint head, uint tail) = (headTail>>80, uint(uint80(headTail)));
		(head, tail) = _clearOldDueTimes(maxCount, makerAddr, currTime, head, tail);
		makerRDTHeadTail[makerAddr] = (head<<80) | tail;
	}

	//If a message's dueTime was recorded in the linked-list before, it is a replay and can't take effect
	function isReplay(address makerAddr, uint dueTime) external view returns (bool) {
		uint tail = uint80(makerRDTHeadTail[makerAddr]);
		return tail == dueTime || makerNextRecentDueTime[makerAddr][dueTime] != 0;
	}

	//Delete some useless entries from the linked list and insert a new one
	function clearOldDueTimesAndInsertNew(address makerAddr, uint newDueTime, uint currTime) private {
		uint headTail = makerRDTHeadTail[makerAddr];
		(uint head, uint tail) = (headTail>>80, uint(uint80(headTail)));
		require(tail != newDueTime && makerNextRecentDueTime[makerAddr][newDueTime] == 0, "dueTime not new");
		(head, tail) = _clearOldDueTimes(MaxClearCount, makerAddr, currTime, head, tail);
		(head, tail) = _addNewDueTime(makerAddr, newDueTime, head, tail);
		makerRDTHeadTail[makerAddr] = (head<<80) | tail;
	}

	// The linked-list:
	// No entries in queue: head = 0, tail = 0
	// One entry in queue: head = dueTime, tail = dueTime 
	// Two entries in queue: head = A, tail = B, makerNextRecentDueTime[makerAddr][A] = B
	function _clearOldDueTimes(uint maxCount, address makerAddr, uint currTime,
				  uint head, uint tail) private returns (uint, uint) {
		for(uint i=0; i<maxCount && head<currTime && head!=0; i++) {
			uint newHead = makerNextRecentDueTime[makerAddr][head];
			makerNextRecentDueTime[makerAddr][head] = 0;
			head = newHead;
		}
		if(head == 0) {
			tail = 0;
		}
		return (head, tail);
	}

	function _addNewDueTime(address makerAddr, uint dueTime,
				  uint head, uint tail) private returns (uint, uint) {
		if(head == 0) {
			return (dueTime, dueTime);
		}
		makerNextRecentDueTime[makerAddr][tail] = dueTime;
		return (head, dueTime);
	}

	function setMakerAgent(address agent) external {
		makerToAgent[msg.sender] = agent;
	}

	// A taker exchanges with a maker, using a message signature generated by the maker's agent
	// This function is used by https://hongbao.click
	function exchangeWithAgentSig(uint256 coinsToMaker, uint256 coinsToTaker, uint256 takerAddr_dueTime80_v8,
			              address makerAddr, bytes32 r, bytes32 s) payable external {
		_exchange(coinsToMaker, coinsToTaker, takerAddr_dueTime80_v8, makerAddr, r, s);
	}

	// A taker exchanges with a maker, using a message signature generated by the maker
	// This function is used by https://orders.cash
	function exchange(uint256 coinsToMaker, uint256 coinsToTaker, uint256 takerAddr_dueTime80_v8,
			   bytes32 r, bytes32 s) payable external {
		_exchange(coinsToMaker, coinsToTaker, takerAddr_dueTime80_v8, address(0), r, s);
	}

	function _exchange(uint256 coinsToMaker, uint256 coinsToTaker, uint256 takerAddr_dueTime80_v8,
			   address makerAddr, bytes32 r, bytes32 s) private {
		uint dueTime = uint80(takerAddr_dueTime80_v8>>8);
		uint currTime = block.timestamp*MUL;
		require(currTime < dueTime, "too late");
		if(makerAddr == address(0)) { //called by "exchange"
			makerAddr = getSigner(coinsToMaker, coinsToTaker, uint(uint160(0)),
					     takerAddr_dueTime80_v8, r, s);
		} else { //called by "exchangeWithAgentSig"
			address agentAddr = getSigner(coinsToMaker, coinsToTaker, uint(uint160(makerAddr)),
					     takerAddr_dueTime80_v8, r, s);
			require(makerToAgent[makerAddr] == agentAddr, "invalid agent");
		}
		clearOldDueTimesAndInsertNew(makerAddr, dueTime, currTime);
		address takerAddr = address(bytes20(uint160(takerAddr_dueTime80_v8>>(80+8))));
		if(takerAddr == address(0)) { //if taker is not specified, anyone sending tx can be the taker
			takerAddr = msg.sender;
		}
		address coinTypeToMaker = address(bytes20(uint160(coinsToMaker>>96)));
		uint coinAmountToMaker = uint(uint96(coinsToMaker));
		address coinTypeToTaker = address(bytes20(uint160(coinsToTaker>>96)));
		uint coinAmountToTaker = uint(uint96(coinsToTaker));
		emit Exchange(makerAddr, coinsToMaker, coinsToTaker, takerAddr_dueTime80_v8>>8);
		if(coinAmountToTaker != 0) {
			(bool success, bytes memory _notUsed) = coinTypeToTaker.call(
				abi.encodeWithSignature("transferFrom(address,address,uint256)", 
				makerAddr, takerAddr, coinAmountToTaker));
			require(success, "transferFrom fail");
		}
		if(coinAmountToMaker != 0) {
			if(coinTypeToMaker == BCHAddress) {
				require(msg.value == coinAmountToMaker, "bch not enough");
				(bool success, bytes memory _notUsed) = makerAddr.call{gas: 9000, value: coinAmountToMaker}("");
				require(success, "transfer fail");
			} else {
				require(msg.value == 0, "no need for bch");
				IERC20(coinTypeToMaker).transferFrom(takerAddr, makerAddr, coinAmountToMaker);
			}
		}
	}

	// The following functions are used by https://starter.money
	// Handle the donation from a supporter(maker) for a crowdfund campaign, by transferring coins from the maker
	// to the campaign's beneficiary(taker).
	function handleDonation(Donation calldata donation, uint currTime, address coinTypeToTaker, uint campaignID,
			       address takerAddr) private returns (uint) {
		uint dueTime = uint80(donation.amount_dueTime80_v8>>8);
		require(currTime < dueTime, "too late");
		uint coinsToTaker;
		uint takerAddr_dueTime80_v8;
		{
			uint amount = donation.amount_dueTime80_v8>>88;
			coinsToTaker = (uint(uint160(coinTypeToTaker))<<96) + amount;
			uint dueTime80_v8 = uint88(donation.amount_dueTime80_v8);
			takerAddr_dueTime80_v8 = (uint(uint160(takerAddr))<<88) + dueTime80_v8;
		}
		address makerAddr = getSigner(0/*zero coinsToMaker*/, coinsToTaker, campaignID,
					      takerAddr_dueTime80_v8, donation.r, donation.s);
		clearOldDueTimesAndInsertNew(makerAddr, dueTime, currTime);

		uint amount = donation.amount_dueTime80_v8>>88;
		(bool success, bytes memory _notUsed) = coinTypeToTaker.call(
			abi.encodeWithSignature("transferFrom(address,address,uint256)", 
			makerAddr, takerAddr, amount));
		require(success, "transferFrom fail");				
		return amount;
	}

	// When the coins from "donations" are enough, the taker accepts all the donations.
	function endCampaign(uint takerAddr_startEndTime, uint totalCoinsToTaker, bytes32 introHash,
			   Donation[] calldata donations) external {
		uint currTime = block.timestamp*MUL;
		address coinTypeToTaker = address(uint160(totalCoinsToTaker>>96));
		uint campaignID = uint(keccak256(abi.encodePacked(
			takerAddr_startEndTime, totalCoinsToTaker, introHash)));
		address takerAddr = address(uint160(takerAddr_startEndTime>>96));
		require(msg.sender == takerAddr, "not taker");
		uint endTime = uint(uint48(takerAddr_startEndTime));
		require(block.timestamp < endTime, "after deadline");
		uint sumAmount = 0;
		for(uint i=0; i<donations.length; i++) {
			sumAmount += handleDonation(donations[i], currTime, coinTypeToTaker, campaignID, takerAddr);
		}
		uint totalAmount = uint(uint96(totalCoinsToTaker));
		require(sumAmount >= totalAmount, "donation not enough");
		emit CampaignSuccess(campaignID);
	}

	// Start a crowdfunding campaign by submitting its basic information onto the chain
	function startCampaign(uint48 endTime, uint totalCoinsToTaker, bytes calldata intro) external {
		uint takerAddr_startEndTime = (uint(uint160(msg.sender))<<96) + (block.timestamp<<48) + uint(endTime);
		bytes32 introHash = keccak256(intro);
		uint campaignID = uint(keccak256(abi.encodePacked(
			takerAddr_startEndTime, totalCoinsToTaker, introHash)));
		emit CampaignStart(campaignID, takerAddr_startEndTime, totalCoinsToTaker, introHash, intro);
	}

	// Offer a donation by submitting the signature of a coin-exchanging message onto the chain
	// Note that coins are not locked or transferred here.
	function donate(uint campaignID, uint256 amount_dueTime80_v8, 
			bytes32 r, bytes32 s, string calldata words) external {
		uint donatorAddr_timestamp = (uint(uint160(msg.sender))<<64)|block.timestamp;
		emit Donate(campaignID, donatorAddr_timestamp, amount_dueTime80_v8, r, s, words);
	}
}
