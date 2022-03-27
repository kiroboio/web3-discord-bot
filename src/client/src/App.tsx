import discord from "./discord.png";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";

const App = () => {
  // @ts-expect-error: ethereum exist in browser with metamask
  const ethereum = window.ethereum;
  const [account, setAccount] = useState<string | undefined>();
  const [connectedAccount, setConnectedAccount] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const [socket, setSocket] = useState<Socket | undefined>();
  const HOST = window.location.origin.replace(/^http/, "ws");
  const params = new URLSearchParams(window.location.search);
  
  const tokenParam = params.get("token");
  const userIdParam = params.get("userId") as string;
  
  
  useEffect(() => {
    if(!tokenParam) return;
    const socket = io(HOST, { query: { token: tokenParam } });
    setSocket(socket);
    window.history.replaceState({}, document.title, "/");
  }, [tokenParam, HOST])
  
  useEffect(() => {
    if(!userIdParam) return;
    if(userIdParam === userId) return;
    setUserId(userIdParam)
  }, [userIdParam, userId])
  
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

  return (
    <div className="App">
      <header className="App-header">
        <button
          className={`Connect ${account === connectedAccount ? "" : "Connect-active"}`}
          onClick={() => {
            if(!socket) return;
            
            socket.emit("account", { account, userId });
            setConnectedAccount(account);
          }}
        >
          <img src={discord} alt="discord icon"></img>
          <p
            style={{ padding: 4, color: "#fff", fontSize: 14, fontWeight: 800 }}
          >
            { account === connectedAccount ? `Connected` : `Connect ${account}`}
          </p>
        </button>
      </header>
    </div>
  );
};

export default App;
