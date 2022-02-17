# API Docs



Base URL:  https://moeing.dev:8080/

Endpoints:

| Path                    | Method | Description       |
| ----------------------- | ------ | ----------------- |
| contract/verify         | POST   | Verify contract   |
| contract/info/{address} | GET    | Get contract info |
|                         |        |                   |

 

## contract/verify

POST to this endpoint to verify the specific contract. Request body: JSON, fields:

| Field                | Type    | Required | Description                            |
| -------------------- | ------- | -------- | -------------------------------------- |
| contractAddress      | String  | Yes      | The address of contract to be verified |
| flattenedSource      | String  | Yes      | The flattened source code              |
| contractName         | String  | Yes      | The name of the main contract          |
| constructor          | String  | Yes      | The signature of constructor           |
| constructorArguments | Array   | Yes      | The arguments of constructor           |
| compilerVersion      | String  | Yes      | The version of Solidity compiler       |
| optimizationUsed     | Boolean | No       | If compiler optimization is used       |
| runs                 | Number  | No       | The number of optimization runs        |

Bellow is an example request body:

```json
{
  "contractAddress":"0x351264f24820C91317024B7748C98CA63d6a2781",
  "flattenedSource": "...",
  "contractName":"ExampleERC20",
  "constructor":"constructor(string memory name, string memory symbol) public",
  "constructorArguments":["ExampleCoin", "EXC"],
  "compilerVersion":"v0.8.10+commit.fc410830",
  "optimizationUsed":true,
  "runs":200
}
```

Response: JSON, fields:

| Field   | Type   | Required | Description          |
| ------- | ------ | -------- | -------------------- |
| status  | String | Yes      | "success" or "error" |
| message | String | No       | Error message        |



## contract/info

Get contract verification info. Example request:

```
 https://moeing.dev:8080/contract/info/0x351264f24820C91317024B7748C98CA63d6a2781
```

Response: JSON, fields:

| Field   | Type   | Required | Description                            |
| ------- | ------ | -------- | -------------------------------------- |
| status  | String | Yes      | "success" or "error"                   |
| message | String | No       | Error message                          |
| data    | Object | No       | Same as body posted to contract/verify |

Example response:

```json
{
  "status": "success",
  "data": {
    "contractAddress":"0x351264f24820C91317024B7748C98CA63d6a2781",
    "flattenedSource": "...",
    "contractName":"ExampleERC20",
    "constructor":"constructor(string memory name, string memory symbol) public",
    "constructorArguments":["ExampleCoin", "EXC"],
    "compilerVersion":"v0.8.10+commit.fc410830",
    "optimizationUsed":true,
    "runs":200
  }
}
```

