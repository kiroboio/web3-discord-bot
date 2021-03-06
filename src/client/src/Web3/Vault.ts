import { Contract } from "web3-eth-contract";
import { toBN } from "web3-utils";
import { etherToWei, weiToEther } from "./utils";
import { kiroboAddress, Web3Vault } from "./Web3Vault";

type TrxParams = {
  address: string;
  addressTo: string;
  value: string;
  chainId: string;
  currency: "ETH" | "KIRO";
  resolve: (trxHash: string) => void;
  reject: (error: string) => void;
};
export class Vault {
  public static contract: { [key: string]: Contract | undefined } = {};
  public static setVaultContract = async ({
    address,
    chainId,
  }: {
    address: string;
    chainId: 1 | 4;
  }) => {
    if (Vault.contract.address) return;
    if (!address) return;
    const contract = await Web3Vault.getVaultContract({ address, chainId });
    Vault.contract[address] = contract;
  };

  public static sendWalletTransaction = async ({
    address,
    addressTo,
    chainId,
    value,
    currency,
    resolve,
    reject,
  }: TrxParams) => {
    const library = await Web3Vault.getWeb3();
    if (!library) return;

    const kiroContract = await Web3Vault.getKiroboTokenContract({
      chainId: Number(chainId) as 1 | 4,
    });

    const valueInWei = etherToWei(value);
    const gas = toBN(
      await kiroContract?.methods
        .transfer(addressTo, valueInWei)
        .estimateGas({ from: address })
    )
      .muln(1.2)
      .toNumber();

    const trx: { hash: string | undefined } = { hash: undefined };

    if (currency === "KIRO") {
      await kiroContract?.methods
        .transfer(addressTo, valueInWei)
        .send({ from: address, gas })
        .on("transactionHash", (txHash: string) => {
          trx.hash = txHash;
        })
        .on("error", (err: Error) => reject(err.message));
    } else {
      await library.eth
        .sendTransaction({
          from: address,
          gas,
          value: valueInWei,
          to: addressTo,
        })
        .on("transactionHash", (txHash: string) => {
          trx.hash = txHash;
        })
        .on("error", (err: Error) => reject(err.message));
    }
    if (!trx.hash) return reject("failed");
    const receipt = await library.eth.getTransactionReceipt(trx.hash);

    if (receipt) {
      resolve(receipt.transactionHash);
    }
  };

  public static sendVaultTransaction = async ({
    address,
    addressTo,
    chainId,
    value,
    currency,
    resolve,
    reject,
  }: TrxParams) => {
    const library = await Web3Vault.getWeb3();
    const onChainWalletContract = Vault.contract[address];

    if (!library || !onChainWalletContract) return;

    const valueInWei = etherToWei(value);

    const tokenAddress = kiroboAddress[chainId as "1" | "4"];
    const gas = toBN(
      await onChainWalletContract?.methods
        .transfer20(tokenAddress, addressTo, valueInWei)
        .estimateGas({ from: address })
    )
      .muln(1.2)
      .toNumber();
    const trx: { hash: string | undefined } = { hash: undefined };
    if(currency === "KIRO") {
      await onChainWalletContract?.methods
        .transfer20(tokenAddress, addressTo, valueInWei)
        .send({ from: address, gas })
        .on("transactionHash", async (txHash: string) => {
          trx.hash = txHash;
        })
        .on("error", (err: Error) => {
          reject(err.message);
        });
    } else {
      const sendEther = onChainWalletContract?.methods.sendEther(addressTo, valueInWei);
      const data = sendEther.encodeABI();
      await library.eth
        .sendTransaction({
          from: address,
          gas,
          value: valueInWei,
          to: addressTo,
          data
        })
        .on("transactionHash", (txHash: string) => {
          trx.hash = txHash;
        })
        .on("error", (err: Error) => reject(err.message));
    } 
      if (!trx.hash) return reject("failed");
      const receipt = await library?.eth?.getTransactionReceipt(trx.hash);
      if (receipt) {
        resolve(receipt.transactionHash);
      }
    };

  public static getKiroBalance = async ({
    address,
    chainId,
    vaultAddress,
  }: {
    address: string;
    vaultAddress?: string;
    chainId: 1 | 4;
  }) => {
    const kiroContract = await Web3Vault.getKiroboTokenContract({ chainId });
    const balance: string = await kiroContract.methods
      .balanceOf(address)
      .call();
    let vaultBalance = "0";
    if (vaultAddress) {
      vaultBalance = await kiroContract.methods.balanceOf(vaultAddress).call();
    }
    const balanceBN = toBN(balance);
    const balanceVault = toBN(vaultBalance);

    return {
      total: weiToEther(balanceBN.add(balanceVault).toString(), 18),
      wallet: weiToEther(balanceBN.toString()),
      vault: weiToEther(balanceVault.toString()),
    };
  };
}
