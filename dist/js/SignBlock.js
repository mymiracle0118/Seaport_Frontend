const SignBlock = () => {
  const { ethereum } = window;
  const [isLoading, setIsLoading] = React.useState(false);

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

  // spinner
  React.useEffect(() => {
    let target = document.getElementById("spinner");
    let spinner = new Spin.Spinner({
      lines: 8,
      length: 5,
      width: 2,
      radius: 5,
      color: "#fff",
    }).spin(target);
    if (target) target.appendChild(spinner.el);
  }, [isLoading]);

  return (
    <SignContainer>
      {addr ? (
        <button
          className="action-button"
          onClick={async () => {
            setIsLoading(true);
            await action(addr);
            setIsLoading(false);
            PopUpShow();
          }}
        >
          {isLoading ? (
            <div id="spinner"></div>
          ) : window.innerWidth < 815 ? (
            "Mint"
          ) : (
            "Mint"
          )}
        </button>
      ) : (
        <>
          <WalletButton />
        </>
      )}
    </SignContainer>
  );
};

const SignContainer = (props) => {
  const { children } = props;
  return (
    <>
      <div className="sign-container">{children}</div>
    </>
  );
};
