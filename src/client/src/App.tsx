import React from "react";
import discord from "./discord.png";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";
import { Vault } from "./Web3/Vault";
import detectEthereumProvider from '@metamask/detect-provider';
import { Web3Vault } from "./Web3/Web3Vault";
import { provider } from "web3-core";

type SendKiroParams = {
  addressTo: string;
  chainId: string;
  amount: string;
  channelId: string;
  type: "wallet" | "vault";
  url?: string;
};

const shortenAddress = (address?: string | null, length = 4): string => {
  if (!address) return '';
  if (address.length < length * 2 + 5) return address;
  
  const left = address.slice(0, length + 2);
  const right = address.slice(address.length - length);
  return `${left}...${right}`;
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


  useEffect(() => {
    const setProviderAsync = async() => {
      const metamaskProvider = await detectEthereumProvider() as provider;
      Web3Vault.setProvider(metamaskProvider)
    }

    setProviderAsync();
  }, [])

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
            url: sendKiroParams.url
          });
        },
        reject: (error: string) => {
          if (!socket) return;
          socket.emit("transactionSendFailed", {
            error,
            channelId: sendKiroParams.channelId,
            url: sendKiroParams.url
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
    // window.history.replaceState({}, document.title, "/");
  }, [tokenParam, HOST]);

  useEffect(() => {
    if (!userIdParam) return;
    if (userIdParam === userId) return;
    setUserId(userIdParam);
  }, [userIdParam, userId]);

  // @ts-expect-error
  ethereum?.request({ method: "eth_requestAccounts" })
    .then((accounts: string[]) => {
      const account = accounts[0];
      setAccount(account);
    });

  // @ts-expect-error
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
    if (!account) {
      return `Connect to metamask`;
    }
    if (account !== connectedAccount) {
      return `Connect ${shortenAddress(account)}`;
    }

    return `Your are connected to Discord Vault Guild`;
  };

  return (
    <div className="App">
      <header className="App-header">
        <button
          className={`Button ${
            account && account === connectedAccount 
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
