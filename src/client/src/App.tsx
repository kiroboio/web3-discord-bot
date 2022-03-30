import React from "react";
import discord from "./discord.png";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";
import { Vault } from "../../_Web3/Vault";

type SendKiroParams = {
  addressTo: string;
  chainId: string;
  amount: string;
  channelId: string;
  type: "wallet" | "vault";
};

const App = () => {
  const ethereum = window.ethereum;
  const [account, setAccount] = useState<string | undefined>();
  const [connectedAccount, setConnectedAccount] = useState<
    string | undefined
  >();
  const [sendKiroParams, setSendKiroParams] = useState<
    SendKiroParams | undefined
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

  useEffect(() => {
    if (!sendKiroParams) return;
    if (!account) return;

    const sendKiroAsync = async () => {
      await Vault.setVaultContract({
        address: account,
        chainId: Number(sendKiroParams.chainId) as 1 | 4,
      });

      const params = {
        address: account,
        addressTo: sendKiroParams.addressTo,
        chainId: sendKiroParams.chainId,
        value: sendKiroParams.amount,
        resolve: (trxHash: string) => {
          if (!socket) return;
          socket.emit("transactionSendSuccess", {
            trxHash,
            channelId: sendKiroParams.channelId,
          });
        },
        reject: (error: string) => {
          if (!socket) return;
          socket.emit("transactionSendFailed", {
            error,
            channelId: sendKiroParams.channelId,
          });
        },
      }
      switch (sendKiroParams.type) {
        case "vault":
          await Vault.sendVaultKiroTransaction(params);
          break;

        case "wallet":
          await Vault.sendWalletKiroTransaction(params);
          break;
      }
      setSendKiroParams(undefined);
    };

    sendKiroAsync();
  }, [sendKiroParams, account, socket]);

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
    // @ts-expect-error: request exists
    ?.request({ method: "eth_requestAccounts" })
    .then((accounts: string[]) => {
      const account = accounts[0];
      setAccount(account);
    });

  // @ts-expect-error: on accountsChanged event exists
  ethereum?.on("accountsChanged", function (accounts: string[]) {
    const account = accounts[0];
    setAccount(account);
  });

  socket?.on("connectedAccount", (connectedAccount) => {
    if (!connectedAccount) return;
    setConnectedAccount(connectedAccount);
  });

  socket?.on("sendKiro", (sendKiroParams: SendKiroParams) => {
    setSendKiroParams(sendKiroParams);
  });

  const renderButtonText = () => {
    if (account !== connectedAccount) {
      return `Connect ${account}`;
    }
    if (isSendingKiro) {
      return `Send ${amount} Kiro to ${addressTo}`;
    }

    return `Your are connected to Discord Vault Guild`;
  };

  return (
    <div className="App">
      <header className="App-header">
        <button
          className={`Button ${
            account === connectedAccount && !isSendingKiro
              ? ""
              : "Button-active"
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
            {renderButtonText()}
          </p>
        </button>
      </header>
    </div>
  );
};

export default App;
