import express from 'express';
import bodyParser from 'body-parser';
import { verifyContract, getContractContext } from './verifier.js';

const app = express();

// parse application/json
app.use(bodyParser.json());

app.use((err, req, res, next) => {
  if (err) {
    console.log('Invalid Request data');
    res.send('Invalid Request data');
  } else {
    next();
  }
});

// Get Contract ABI for Verified Contract Source Codes
app.get('/get-abi/:addr', (req, res) => {
  // TODO
  res.send(`get-abi, addr: ${req.params.addr}`);
});

// Get Contract Source Code for Verified Contract Source Codes
app.get('/get-source-code/:addr', (req, res) => {
  // TODO
  res.send(`get-source-code, addr: ${req.params.addr}`);
});

// Check Source Code Verification Status
app.get('/get-verify-info/:addr', async (req, res) => {
  console.log(`/get-verify-info/${req.params.addr}`);
  try {
    const ctx = await getContractContext(req.params.addr);
    res.json({ status: "success", data: ctx });
  } catch (err) {
    res.json({ status: "error", message: err });
  }
});

// Verify Source Code
app.post('/verify-source-code', async (req, res) => {
  console.log('body:', req.body);
  const body = req.body;

  let errMsg;
  if (! body.contractAddress) {
    errMsg = 'missing contractAddress';
  } else if (! body.contractName) {
    errMsg = 'missing contractName';
  } else if (! body.flattenedSource) {
    errMsg = 'missing flattenedSource';
  } else if (! body.compilerVersion) {
    errMsg = 'missing compilerVersion';
  } else if (! body.optimizationUsed) {
    errMsg = 'missing optimizationUsed';
  } else if (! body.runs) {
    errMsg = 'missing runs';
  } else if (! body.constructor) {
    errMsg = 'missing constructor';
  } else if (! body.constructorArguments) {
    errMsg = 'missing constructorArguments';
  // } else if (! body.licenseType) {
  //   errMsg = 'missing licenseType';
  } 

  if (errMsg) {
  	res.json({ status: "error", message: errMsg });
  } else {
    try {      
      const ok = await verifyContract(body);
      res.json({ status: "success" });
    } catch (err) {
      res.json({ status: "error", message: err });
    }
  }

});

const port = process.env.PORT || 8765;
// console.log('port:', port);

app.listen(port, () =>
  console.log(`listening on port ${port}!`),
);
