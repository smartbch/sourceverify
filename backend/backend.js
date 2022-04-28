import fs from 'fs';
import https from 'https';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import { verifyContract, getContractContext, getContractAddressesWithTimeRange } from './verifier.js';

const app = express();

app.use(bodyParser.json());   // parse application/json
app.use(cors({origin: '*'})); // allow any page to use this API

app.use((err, req, res, next) => {
  if (err) {
    console.log('Invalid Request data');
    res.send('Invalid Request data');
  } else {
    next();
  }
});

// Check Source Code Verification Status
app.get('/contract/info/:addr', async (req, res) => {
  console.log(`/contract/info/${req.params.addr}`);
  try {
    const info = await getContractContext(req.params.addr);
    if (info) {
      res.json({ status: "success", data: info });
    } else {
      res.json({ status: "error", message: "not verified" });
    }
  } catch (err) {
    res.json({ status: "error", message: err.toString() });
  }
});

app.get('/verified-contracts', async (req, res) => {
  const start = req.query.start;
  const end = req.query.end;
  console.log('/verified-contracts, start=', start, 'end=', end);
  if (!start) {
    res.json({ status: "error", message: 'missing query param: start' });
    return;
  }
  if (!end) {
    res.json({ status: "error", message: 'missing query param: end' });
    return;
  }

  try {
    const addrs = await getContractAddressesWithTimeRange(start, end);
    res.json({ status: "success", data: addrs });
  } catch (err) {
    res.json({ status: "error", message: err.toString() });
  }
});

// Verify Source Code
app.post('/contract/verify', async (req, res) => {
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
  // } else if (! body.optimizationUsed) {
  //   errMsg = 'missing optimizationUsed';
  } else if (body.optimizationUsed && !body.runs) {
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
      const ok = await verifyContract({
        contractAddress     : body.contractAddress,
        flattenedSource     : body.flattenedSource,
        contractName        : body.contractName,
        constructor         : body.constructor,
        constructorArguments: body.constructorArguments,
        compilerVersion     : body.compilerVersion,
        optimizationUsed    : body.optimizationUsed,
        runs                : body.runs,
        evmVersion          : body.evmVersion,
      });
      if (ok) {
        res.json({ status: "success" });
      } else {
        res.json({ status: "error", message: "failed to verify contract" });
      }
    } catch (err) {
      res.json({ status: "error", message: err.toString() });
    }
  }
});

const isHTTP = process.env.HTTP;
const port = process.env.PORT || 8080;
const httpsCertFile = process.env.HTTPS_CERT_FILE || "moeing_dev.crt";
const httpsCaFile   = process.env.HTTPS_CA_FILE   || "moeing_dev.ca-bundle";
const httpsKeyFile  = process.env.HTTPS_KEY_FILE  || "moeing_dev.key";

if (isHTTP) {
  app.listen(port, () =>
    console.log(`HTTP server listening on port ${port}!`),
  );
} else {
  const httpsOptions = {
    cert: fs.readFileSync(httpsCertFile),
    ca  : fs.readFileSync(httpsCaFile),
    key : fs.readFileSync(httpsKeyFile),
  };

  const httpsServer = https.createServer(httpsOptions, app)
  httpsServer.listen(port, function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log(`HTTPS server listening on port ${port}!`);
    }
  });
}
