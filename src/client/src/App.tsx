import discord from "./discord.png";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";
import { Vault } from "./Web3/Vault";

const App = () => {
  // @ts-expect-error: ethereum exist in browser with metamask
  const ethereum = window.ethereum;
  const [account, setAccount] = useState<string | undefined>();
  const [connectedAccount, setConnectedAccount] = useState<
    string | undefined
  >();
  const [userId, setUserId] = useState<string | undefined>();
  const [socket, setSocket] = useState<Socket | undefined>();
  const HOST = window.location.origin.replace(/^http/, "ws");
  const params = new URLSearchParams(window.location.search);

  const tokenParam = params.get("token");
  const userIdParam = params.get("userId") as string;

  const addressTo = params.get("addressTo");
  const amount = params.get("amount");
  const chainId = params.get("chainId");

  const isSendingKiro = account && addressTo && chainId && amount;
  const sendVaultTokenTransaction = async() => {
    if (!isSendingKiro) return;
    await Vault.setVaultContract({ address: account, chainId: Number(chainId) as 1 | 4  });
    const res = await Vault.sendKiroTokenTransaction({
      address: account,
      addressTo: addressTo,
      chainId,
      value: amount,
    });

    console.log({ res })
  };

  useEffect(() => {
    if (!tokenParam) return;
    const socket = io(HOST, { query: { token: tokenParam } });
    setSocket(socket);
    window.history.replaceState({}, document.title, "/");
  }, [tokenParam, HOST]);

  useEffect(() => {
    if (!userIdParam) return;
    if (userIdParam === userId) return;
    setUserId(userIdParam);
  }, [userIdParam, userId]);

  ethereum
    ?.request({ method: "eth_requestAccounts" })
    .then((accounts: string[]) => {
      const account = accounts[0];
      setAccount(account);
    });

  ethereum?.on("accountsChanged", function (accounts: string[]) {
    const account = accounts[0];
    setAccount(account);
  });

  socket?.on("connectedAccount", (connectedAccount) => {
    if (!connectedAccount) return;
    setConnectedAccount(connectedAccount);
  });

  return (
    <div className="App">
      <header className="App-header">
        <button
          className={`Connect ${
            account === connectedAccount ? "" : "Connect-active"
          }`}
          onClick={() => {
            if (!socket) return;
            socket.emit("account", { account, userId });
          }}
        >
          <img src={discord} alt="discord icon"></img>
          <p
            style={{ padding: 4, color: "#fff", fontSize: 14, fontWeight: 800 }}
          >
            {account === connectedAccount ? `Connected` : `Connect ${account}`}
          </p>
        </button>
        {isSendingKiro ? (
          <button
            className={"Connect-active"}
            onClick={sendVaultTokenTransaction}
          >
            <img src={discord} alt="discord icon"></img>
            <p
              style={{
                padding: 4,
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              Send {amount} Kiro to {addressTo}
            </p>
          </button>
        ) : null}
      </header>
    </div>
  );
};

export default App;
