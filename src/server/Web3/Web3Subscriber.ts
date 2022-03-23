import { Web3Vault } from "../Web3/Web3Vault";

export class Web3Subscriber {

  public static subscribeOnNewBlock = ({
    chainId,
    callback,
  }: {
    chainId: "1" | "4";
    callback: (blockNumber: number) => void;
  }) => {
    const eth = Web3Vault.web3[chainId].eth;
    eth
      .subscribe("newBlockHeaders")
      .on("data", (e) => {
        if (!e.number) return;
        callback(e.number);
      })
      .on("connected", async () => {})
      .on("error", (e) => console.log("subscribe error", e));
  };
}
