import logo from "./logo.svg";
import { io } from "socket.io-client";
import "./App.css";
import { useRef } from "react";

const App = () => {
  // @ts-expect-error: ethereum exist in browser with metamask
  const ethereum = window.ethereum;



  const user = useRef<{
    account?: string;
    userId?: string;
  }>({
    account: undefined,
    userId: undefined,
  });

  const HOST = window.location.origin.replace(/^http/, "ws");
  const params = new URLSearchParams(window.location.search);
  const socket = io(HOST, { query: { token: params.get("token") } });

  user.current.userId = params.get("userId") as string;

  window.history.replaceState({}, document.title, "/");
  ethereum
    ?.request({ method: "eth_requestAccounts" })
    .then((accounts: string[]) => {
      const account = accounts[0];

      user.current.account = account;
      if (!account) return;

      socket.emit("account", { account, userId: user.current.userId });
    });

  ethereum?.on("accountsChanged", function (accounts: string[]) {
    const account = accounts[0];
    user.current.account = account;
    if (!account) return;

    socket.emit("account", {
      account,
      userId: user.current.userId,
    });
  });

  socket.on("connect", () => {
    if (! user.current.account) return;
    socket.emit("account", {
      account:  user.current.account,
      userId:  user.current.userId,
    });
  });

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
      </header>
    </div>
  );
};

export default App;
