/*
The file verify contract consistency between contract on chain and deployed code out of chain with source file.
all information need is in object context:
context = {
		flattenedSource: fs.readFileSync("flatten.sol", {encoding: "utf8"}),
		optimizationUsed: bool,
		runs: 200,
		compilerVersion: "v0.8.10+commit.fc410830",
		contractAddress: "0x351264f24820C91317024B7748C98CA63d6a2781",
		contractName: "ExchangeHub",
		constructor: "constructor() public",
		constructorArguments: [],
		firstVerifiedTime: 123000000,
}

context not contain licenceType, which has types below:
1.  No License (None)
2.  The Unlicense (Unlicense)
3.  MIT License (MIT)
4.  GNU General Public License v2.0 (GNU GPLv2)
5.  GNU General Public License v3.0 (GNU GPLv3)
6.  GNU Lesser General Public License v2.1 (GNU LGPLv2.1)
7.  GNU Lesser General Public License v3.0 (GNU LGPLv3)
8.  BSD 2-clause "Simplified" license (BSD-2-Clause)
9.  BSD 3-clause "New" Or "Revised" license* (BSD-3-Clause)
10. Mozilla Public License 2.0 (MPL-2.0)
11. Open Software License 3.0 (OSL-3.0)
12. Apache 2.0 (Apache-2.0)
13. GNU Affero General Public License (GNU AGPLv3)
14. Business Source License (BSL 1.1)
* */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {chunksToLinesAsync, streamEnd, streamWrite} from '@rauschma/stringio';
import {spawn} from 'child_process'
import {ethers} from "ethers";
import abi2solidity from "abi2solidity";
import level from 'level'

const serverErr = "ServerError: ";
const clientErr = "ClientError: "

const contractDB = level('contract-db', { valueEncoding: 'json' });
const provider = new ethers.providers.JsonRpcProvider("https://smartbch.fountainhead.cash/mainnet");

async function writeToWritable(writable, str) {
	await streamWrite(writable, str);
	await streamEnd(writable);
}

async function getFromReadable(readable) {
	let res = ""
	for await (const line of chunksToLinesAsync(readable)) {
		res += line
	}
	return res
}

async function runCommand(cmd, args, inputStr) {
	const sub = spawn(cmd, args, {
		stdio: ['pipe', 'pipe', 'pipe'/*process.stderr*/],
		env: {...process.env, LD_LIBRARY_PATH: '.'},
	});

	if(inputStr) {
		await writeToWritable(sub.stdin, inputStr);
	}

	const errMsg = await getFromReadable(sub.stderr);
	console.log('runCommand err: ----------\n', errMsg, '\n----------');

	const output = await getFromReadable(sub.stdout);
	return [output, errMsg];
}

// async function test_runCommand() {
// 	let [out, ] = await runCommand("/bin/cat", ["-n"], "i\nlove\nyou\n")
// 	console.log(out)
// 	out = await runCommand("/bin/cat", ["verifier.js"])
// 	console.log(out)
// }

const SolVersions = new Set([
	"v0.4.10+commit.9e8cc01b",
	"v0.4.11+commit.68ef5810",
	"v0.4.12+commit.194ff033",
	"v0.4.13+commit.0fb4cb1a",
	"v0.4.14+commit.c2215d46",
	"v0.4.15+commit.8b45bddb",
	"v0.4.16+commit.d7661dd9",
	"v0.4.17+commit.bdeb9e52",
	"v0.4.18+commit.9cf6e910",
	"v0.4.19+commit.c4cbbb05",
	"v0.4.20+commit.3155dd80",
	"v0.4.21+commit.dfe3193c",
	"v0.4.22+commit.4cb486ee",
	"v0.4.23+commit.124ca40d",
	"v0.4.24+commit.e67f0147",
	"v0.4.25+commit.59dbf8f1",
	"v0.4.26+commit.4563c3fc",
	"v0.5.0+commit.1d4f565a",
	"v0.5.1+commit.c8a2cb62",
	"v0.5.2+commit.1df8f40c",
	"v0.5.3+commit.10d17f24",
	"v0.5.4+commit.9549d8ff",
	"v0.5.5+commit.47a71e8f",
	"v0.5.6+commit.b259423e",
	"v0.5.7+commit.6da8b019",
	"v0.5.8+commit.23d335f2",
	"v0.5.9+commit.c68bc34e",
	"v0.5.10+commit.5a6ea5b1",
	"v0.5.11+commit.22be8592",
	"v0.5.12+commit.7709ece9",
	"v0.5.13+commit.5b0b510c",
	"v0.5.14+commit.01f1aaa4",
	"v0.5.15+commit.6a57276f",
	"v0.5.16+commit.9c3226ce",
	"v0.5.17+commit.d19bba13",
	"v0.6.0+commit.26b70077",
	"v0.6.1+commit.e6f7d5a4",
	"v0.6.2+commit.bacdbe57",
	"v0.6.3+commit.8dda9521",
	"v0.6.4+commit.1dca32f3",
	"v0.6.5+commit.f956cc89",
	"v0.6.6+commit.6c089d02",
	"v0.6.7+commit.b8d736ae",
	"v0.6.8+commit.0bbfe453",
	"v0.6.9+commit.3e3065ac",
	"v0.6.10+commit.00c0fcaf",
	"v0.6.11+commit.5ef660b1",
	"v0.6.12+commit.27d51765",
	"v0.7.0+commit.9e61f92b",
	"v0.7.1+commit.f4a555be",
	"v0.7.2+commit.51b20bc0",
	"v0.7.3+commit.9bfce1f6",
	"v0.7.4+commit.3f05b770",
	"v0.7.5+commit.eb77ed08",
	"v0.7.6+commit.7338295f",
	"v0.8.0+commit.c7dfd78e",
	"v0.8.1+commit.df193b15",
	"v0.8.2+commit.661d1103",
	"v0.8.3+commit.8d00100c",
	"v0.8.4+commit.c7e474f2",
	"v0.8.5+commit.a4f2e591",
	"v0.8.6+commit.11564f7e",
	"v0.8.7+commit.e28d00a7",
	"v0.8.8+commit.dddeac2f",
	"v0.8.9+commit.e5eed63a",
	"v0.8.10+commit.fc410830",
	"v0.8.11+commit.d7f03943",
])

async function runSolc(config) {
	let tmpDir;
	try {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "Verifier"));
	} catch {
		throw new Error(serverErr + "cannot make temp dir for contract compile");
	}

	let srcFile = path.join(tmpDir, "in.sol");
	if (typeof config.flattenedSource !== 'string') {
		throw new Error(clientErr + 'flattenedSource not string');
	}
	fs.writeFileSync(srcFile, config.flattenedSource);

	let outDir = path.join(tmpDir, "out");
	let args = ["--bin", "--abi", "--input-file", srcFile,
		"--output-dir", outDir, "--evm-version", "istanbul"];

	if(config.optimizationUsed) {
		args.push("--optimize");
	}
	if(!isNaN(config.runs) && config.runs > 0 ) {
		args.push("--optimize-runs");
		args.push(config.runs);
	}
	if(!SolVersions.has(config.compilerVersion)) {
		throw new Error(clientErr + "invalid compiler version [" + config.compilerVersion + "]");
	}
	let exeFile = "solc-bin/solc-linux-amd64-"+config.compilerVersion;
	
	console.log("runCommand", exeFile, args)
	let [solcOut, solcErr] = await runCommand(exeFile, args)
	console.log("finished solc:", solcOut);
	if (solcErr.includes('Error:')) {
		throw new Error(clientErr + "contract compile failed: " + solcErr);
	}

	let hexCode;
	try {
		hexCode = fs.readFileSync(path.join(outDir, config.contractName+".bin"), {encoding: "utf8"});
	} catch (e) {
		throw new Error(clientErr + "contract compile failed");
	}
	let abiJson = fs.readFileSync(path.join(outDir, config.contractName+".abi"), {encoding: "utf8"});

	try {
		fs.rmSync(tmpDir, { recursive: true,  });
	} catch (e) {
		throw new Error(serverErr + "cannot remove temp dir")
	}
	return [hexCode, abi2solidity.default(abiJson)]
}

function printHex(txt) {
	for(let i=0; txt.length > 80; i++) {
		console.log(i, txt.substr(0, 80))
		txt = txt.substr(80)
	}
	console.log(txt)
}

/*
Verify contract specified by context.contractAddress with other fields,
if result is same, store the contract basic info in levelDB.
param:
context = {
		flattenedSource: fs.readFileSync("flatten.sol", {encoding: "utf8"}),
		optimizationUsed: bool,
		runs: 200,
		compilerVersion: "v0.8.10+commit.fc410830",
		contractAddress: "0x351264f24820C91317024B7748C98CA63d6a2781",
		contractName: "ExchangeHub",
		constructor: "constructor() public",
		constructorArguments: [],
}
return: bool, if same, return true, or false.
* */
export async function verifyContract(context) {
	let exist = true;
	try {
		await contractDB.get(context.contractAddress);
	} catch (e) {
		if (e.type !== 'NotFoundError') {
			throw new Error(serverErr + e.toString());
		}
		exist = false
	}
	if (exist) {
		return true;
	}
	let [hexCode, abiJson] = await runSolc(context);
	// console.log('---abi json---', abiJson);
	context.abi = abiJson;

	const factory = new ethers.ContractFactory([context.constructor], "0x"+hexCode);
	let tx;
	const args = context.constructorArguments;
	if(!args || args.length === 0) {
		tx = factory.getDeployTransaction();
	} else if(args.length === 1) {
		tx = factory.getDeployTransaction(args[0]);
	} else if(args.length === 2) {
		tx = factory.getDeployTransaction(args[0], args[1]);
	} else if(args.length === 3) {
		tx = factory.getDeployTransaction(args[0], args[1], args[2]);
	}
	const creationBytecode = ethers.utils.hexlify(tx.data);

	// console.log("creationBytecode", creationBytecode);

	let [deployedCode, errMsg] = await runCommand("./deploycode", [], creationBytecode.substr(2));
	let onChainCode = await provider.getCode(context.contractAddress);

	deployedCode = removeMetadataHashEncodeBytes(deployedCode.trim());
	onChainCode = removeMetadataHashEncodeBytes(onChainCode.trim().substr(2));
	console.log("deployed:", deployedCode);
	console.log("on-chain:", onChainCode);

	// printHex(deployedCode);
	// printHex(onChainCode.substr(2));
	let isSame =  deployedCode === onChainCode;
	if (isSame) {
		await contractDB.put(context.contractAddress, context);
		await contractDB.put(Math.floor(Date.now() / 1000).toString + context.contractAddress, "");
	}
	console.log('isSame:', isSame);
	return isSame
}

// https://docs.soliditylang.org/en/latest/metadata.html#encoding-of-the-metadata-hash-in-the-bytecode
// 0xa2
// 0x64 'i' 'p' 'f' 's' 0x58 0x22 <34 bytes IPFS hash>
// 0x64 's' 'o' 'l' 'c' 0x43 <3 byte version encoding>
// 0x00 0x33
function removeMetadataHashEncodeBytes(code) {
	const regex = /(a264697066735822)([0-9a-fA-F]{68})(64736f6c6343)([0-9a-fA-F]{6})(0033)$/;
	//const replacement = '$1xxxxxxxxxxxxxxx---ipfs-hash---xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx$3';
	return code.replace(regex, "");
}

/*
get contract context from levelDB, return context obj:
return:
if contract exist, return
context = {
		flattenedSource: fs.readFileSync("flatten.sol", {encoding: "utf8"}),
		optimizationUsed: bool,
		runs: 200,
		compilerVersion: "v0.8.10+commit.fc410830",
		contractAddress: "0x351264f24820C91317024B7748C98CA63d6a2781",
		contractName: "ExchangeHub",
		constructor: "constructor() public",
		constructorArguments: [],
}
if not exist or something error, return empty string "".
* */
export async function getContractContext(contractAddress) {
	let context = "";
	try {
		context = await contractDB.get(contractAddress);
	} catch (e) {
		if (e.type !== 'NotFoundError') {
			throw new Error(serverErr + e.toString());
		}
	}
	return context;
}

// return all contract addressed which first verified time between [start, end)。
export async function getContractAddressesWithTimeRange(start, end) {
	let contractSet = [];
	if (start > end) {
		throw new Error(clientErr + "start timestamp should less than end timestamp");
	}
	let stream;
	try {
		stream =  contractDB.createReadStream({ keys: true, values: false, gte: start, lte: end });
	} catch (e) {
		throw new Error(serverErr + e.toString());
	}
	for await (const key of stream) {
		contractSet.push(key);
	}
	return contractSet;
}

async function test() {
	let context = {
		flattenedSource: fs.readFileSync("flatten.sol", {encoding: "utf8"}),
		optimizationUsed: true,
		runs: 200,
		compilerVersion: "v0.8.10+commit.fc410830",
		contractAddress: "0x351264f24820C91317024B7748C98CA63d6a2781",
		contractName: "ExchangeHub",
		constructor: "constructor() public",
		constructorArguments: [],
	}
	await verifyContract(context)
}

async function main() {
	try {
		await test()
	} catch (e) {
		console.log(e.toString());
	}
}

// main()


