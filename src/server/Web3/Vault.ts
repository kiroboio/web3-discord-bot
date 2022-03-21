import { Contract } from "web3-eth-contract";
import { toBN } from "web3-utils";
import { weiToEther } from "./utils";
import { Web3Vault } from "./Web3Vault";

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

    return weiToEther(balanceBN.add(balanceVault).toString(), 18);
  };
}
