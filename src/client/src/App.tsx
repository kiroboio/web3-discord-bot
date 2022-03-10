
import logo from "./logo.svg";
import { io } from "socket.io-client";
import "./App.css";

function App() {
  // @ts-expect-error: ethereum exist in browser with metamask
  const ethereum = window.ethereum
  console.log({ selectedAcc: ethereum?.selectedAddress })
  const user = {
    userId: "",
    account: ethereum?.selectedAddress,
    sessionId: "",
  };

  const socket = io();


 ethereum?.request({ method: "eth_requestAccounts" })
    .then((accounts: string[]) => {
      const account = accounts[0];
      user.account = account;
      console.log({ accounts, user })
      if (!account) return;

      socket.emit("account", { account, sessionId: user.sessionId });
    });
  
  ethereum?.on("accountsChanged", function (accounts: string[]) {
    const account = accounts[0];
    user.account = account;
    console.log({ accounts })
    if (!account) return;

    socket.emit("account", {
      account,
      sessionId: user.sessionId,
    });
  });

  socket.on("connect", () => {
    console.log("connect")
		user.sessionId = socket.id
	});

	// socket.on("userId", ({ userId }) => {
  //   user.userId = userId
  //   console.log("userId", { user })
	// 	if (!user.account) return;

	// 	socket.emit("account", { account: user.account, userId: user.userId, sessionId: user.sessionId });
	// })

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
      </header>
    </div>
  );
}

export default App;
