import { Contract } from "web3-eth-contract";
import { toBN } from "web3-utils";
import { etherToWei, weiToEther } from "./utils";
import { kiroboAddress, Web3Vault } from "./Web3Vault";

export class Vault {
  public static contract: { [key: string]: Contract | undefined } = {};
  public static setVaultContract = async ({
    address,
    chainId,
  }: {
    address: string;
    chainId: 1 | 4;
  }) => {
    if (this.contract.address) return;
    if (!address) return;
    const contract = await Web3Vault.getVaultContract({ address, chainId });
    this.contract[address] = contract;
  };

  public static sendKiroTokenTransaction = async ({
    address,
    addressTo,
    chainId,
    value,
  }: {
    address: string;
    addressTo: string;
    value: string;
    chainId: string;
  }) => {
    const library = Web3Vault.web3[chainId as "1" | "4"];
    const onChainWalletContract = Vault.contract[address];

    if (!library || !onChainWalletContract) return;

    const valueInWei = etherToWei(value);

    const tokenAddress = kiroboAddress[chainId as "1" | "4"]
    const gas = toBN(
      await onChainWalletContract?.methods
        .transfer20(tokenAddress, addressTo, valueInWei)
        .estimateGas({ from: address })
    )
      .muln(1.2)
      .toNumber();

    await onChainWalletContract?.methods
      .transfer20(tokenAddress, addressTo, valueInWei)
      .send({ from: address, gas })
      .on("transactionHash", async (txHash: string) => {
        const receipt = await library?.eth?.getTransactionReceipt(txHash);

        return receipt;
      })
      .on("error", (err: Error) => {
        return err;
      });
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
    const kiroContract = Web3Vault.getKiroboTokenContract({ chainId });
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
