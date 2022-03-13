import logo from "./logo.svg";
import { io } from "socket.io-client";
import "./App.css";

const App = () => {
  // @ts-expect-error: ethereum exist in browser with metamask
  const ethereum = window.ethereum;
  const user = {
    account: ethereum?.selectedAddress,
    sessionId: "",
  };

  const HOST = window.location.origin.replace(/^http/, "ws");
  const params = new URLSearchParams(window.location.search);
  const socket = io(HOST, { query: { token: params.get('token')} });
  window.history.replaceState({}, document.title, "/");
  ethereum
    ?.request({ method: "eth_requestAccounts" })
    .then((accounts: string[]) => {
      const account = accounts[0];
      user.account = account;
      if (!account) return;

      socket.emit("account", { account, sessionId: user.sessionId });
    });

  ethereum?.on("accountsChanged", function (accounts: string[]) {
    const account = accounts[0];
    user.account = account;
    if (!account) return;

    socket.emit("account", {
      account,
      sessionId: user.sessionId,
    });
  });

  socket.on("connect", () => {
    user.sessionId = socket.id;
    if (!user.account) return;
    socket.emit("account", {
      account: user.account,
      sessionId: user.sessionId,
    });
  });

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
      </header>
    </div>
  );
}

export default App;
