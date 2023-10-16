const WalletButton = () => {
  const { ethereum } = window;
  const [showModal, setShowModal] = React.useState(false);

  const [addr, setAddr] = React.useState("");

  // update ui with loaded wallet
  if (ethereum) {
    ethereum.on("accountsChanged", (a) => setAddr(a.length ? a[0] : ""));
    ethereum.on("connect", (a) => setAddr(a.length ? a[0] : ""));
  }

  // load previously connected wallet
  React.useEffect(() => {
    if (ethereum) {
      ethereum
        .request({
          method: "eth_accounts",
        })
        .then((a) => setAddr(a[0]));
    }
  }, []);

  return (
    <>
      <ConnectWalletButton account={addr} />
    </>
  );
};

const ConnectWalletButton = (props) => {
  const { account } = props;
  return (
    <>
      <button
        onClick={async () => {
          connect("mm");
        }}
        className="wallet-button"
      >
        {account
          ? `${account.slice(0, 5)}...${account.slice(-5)}`
          : "Connect Wallet"}
      </button>
    </>
  );
};
