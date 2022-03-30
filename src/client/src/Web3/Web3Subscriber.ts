import { Web3Vault } from "./Web3Vault";

export class Web3Subscriber {

  public static subscribeOnNewBlock = async ({
    callback,
  }: {
    callback: (blockNumber: number) => void;
  }) => {
    const web3 =  await Web3Vault.getWeb3()
    const eth = web3.eth;
    eth
      .subscribe("newBlockHeaders")
      .on("data", (e) => {
        if (!e.number) return;
        callback(e.number);
      })
      .on("connected", async () => {})
      .on("error", (e) => console.error("subscribe error", e));
  };
}
