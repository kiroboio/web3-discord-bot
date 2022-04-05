import React from "react";
import discord from "./discord.png";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { useEffect, useState } from "react";
import { Vault } from "./Web3/Vault";
import detectEthereumProvider from "@metamask/detect-provider";
import { Web3Vault } from "./Web3/Web3Vault";
import { provider } from "web3-core";
import {
  observer,
  useAccount,
  Connectors,
} from "@kiroboio/web3-react-safe-transfer";
import { etherToWei } from "./Web3/utils";

type SendKiroParams = {
  addressTo: string;
  chainId: string;
  amount: string;
  channelId: string;
  type: "wallet" | "vault";
  url?: string;
  passcode?: string;
};

type GetTransactionsParams = {
  type: "DEPOSIT" | "COLLECT";
  channelId: string;
};

const shortenAddress = (address?: string | null, length = 4): string => {
  if (!address) return "";
  if (address.length < length * 2 + 5) return address;

  const left = address.slice(0, length + 2);
  const right = address.slice(address.length - length);
  return `${left}...${right}`;
};

const App = observer(() => {
  const {
    connect,
    address,
    deposit,
    setChainId,
    outgoing,
    incoming,
    retrieve,
    collect,
  } = useAccount();
  const [connectedAccount, setConnectedAccount] = useState<
    string | undefined
  >();
  const [getTransactionsParams, setGetTransactionsParams] = useState<
    GetTransactionsParams | undefined
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
    console.log("rerender");
    const setProviderAsync = async () => {
      const metamaskProvider = (await detectEthereumProvider()) as provider;
      Web3Vault.setProvider(metamaskProvider);
    };

    connect.run(Connectors.Injected);

    setProviderAsync();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("connectedAccount", (connectedAccount) => {
      if (!connectedAccount) return;
      setConnectedAccount(connectedAccount);
    });

    socket.on("sendKiro", (sendKiroParams: SendKiroParams) => {
      setSendKiroParams(sendKiroParams);
    });

    socket.on("getTransactions", (params: GetTransactionsParams) => {
      setGetTransactionsParams(params);
    });

    socket.on("retrieve", ({ id }: { id: string }) => {
      retrieve.run({
        id,
      });
    });

    socket.on(
      "collect",
      ({ id, passcode }: { id: string; passcode: string }) => {
        console.log({ id, passcode, }, "collect")
        collect.run({
          id,
          passcode,
        });
      }
    );

    return () => {
      socket.removeAllListeners();
    };
  }, [socket]);

  useEffect(() => {
    if (!sendKiroParams) return;
    if (!address) return;
    setChainId(Number(sendKiroParams.chainId));

    if (sendKiroParams.passcode) {
      deposit.run({
        to: sendKiroParams.addressTo,
        passcode: sendKiroParams.passcode,
        value: etherToWei(sendKiroParams.amount),
      });
      return;
    }
    const sendKiroAsync = async (sendParams: SendKiroParams) => {
      await Vault.setVaultContract({
        address,
        chainId: Number(sendKiroParams.chainId) as 1 | 4,
      });

      const params = {
        address,
        addressTo: sendParams.addressTo,
        chainId: sendParams.chainId,
        value: sendParams.amount,
        resolve: (trxHash: string) => {
          if (!socket) return;
          socket.emit("transactionSendSuccess", {
            trxHash,
            channelId: sendParams.channelId,
            url: sendParams.url,
          });
        },
        reject: (error: string) => {
          if (!socket) return;
          socket.emit("transactionSendFailed", {
            error,
            channelId: sendParams.channelId,
            url: sendParams.url,
          });
        },
      };
      switch (sendParams.type) {
        case "vault":
          await Vault.sendVaultKiroTransaction(params);
          break;

        case "wallet":
          await Vault.sendWalletKiroTransaction(params);
          break;
      }
    };

    sendKiroAsync(sendKiroParams);
    setSendKiroParams(undefined);
  }, [sendKiroParams, socket, address]);

  useEffect(() => {
    if (!getTransactionsParams) return;
    if (!socket) return;
    if (getTransactionsParams.type === "DEPOSIT") {
      const deposits: { id: string; to: string }[] = [];
      outgoing.list.forEach((trx) => {
        if (
          trx.state === "retrieved" ||
          trx.state === "retrieving" ||
          trx.state === "collected" ||
          trx.state === "rejected"
        )
          return;
        deposits.push({
          id: trx.id,
          to: trx.id,
        });
      });

      socket.emit("deposits", {
        deposits,
        channelId: getTransactionsParams.channelId,
      });
    }

    if (getTransactionsParams.type === "COLLECT") {
      const collects: { id: string; from: string }[] = [];
      incoming.list.forEach((trx) => {
        if (
          trx.state === "collected" ||
          trx.state === "collecting" ||
          trx.state === "retrieved"
        )
          return;
        collects.push({
          id: trx.id,
          from: trx.from,
        });
      });

      console.log({ emitCollects: collects, getTransactionsParams });
      socket.emit("collects", {
        collects,
        channelId: getTransactionsParams.channelId,
      });
    }

    setGetTransactionsParams(undefined);
  }, [getTransactionsParams]);

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

  const renderButtonText = () => {
    if (!address) {
      return `Connect to metamask`;
    }
    if (address !== connectedAccount) {
      return `Connect ${shortenAddress(address)}`;
    }

    return `Your are connected to Discord Vault Guild`;
  };

  return (
    <div className="App">
      <header className="App-header">
        <button
          className={`Button ${
            address && address === connectedAccount ? "" : "Button-active"
          }`}
          onClick={() => {
            if (!socket) return;
            socket.emit("account", { account: address, userId });
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
});

export default App;
