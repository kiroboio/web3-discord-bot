import { Contract } from "web3-eth-contract";
import { Web3Vault } from "./Web3Vault";

export class Vault {
  public static contract: { [key: string]: Contract | undefined } = {};
  public static setVaultContract = async ({ address, chainId }: { address: string, chainId: 1 | 4 }) => {
    if(this.contract.address) return;
    if(!address) return;
    this.contract.address = await  Web3Vault.getVaultContract({ address, chainId })
  }
}
