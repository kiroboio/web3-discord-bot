import FactoryJSON from "./abi/Factory.json";
import WalletJSON from "./abi/Wallet.json";
import { AbiItem } from "web3-utils";
import { Contract } from "web3-eth-contract";
import Web3 from "web3";
import { config } from "dotenv";
config();

const RPC_URLS = {
  "1": `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_KEY}`,
  "4": `wss://rinkeby.infura.io/ws/v3/${process.env.INFURA_KEY}`,
};

const vaultWalletAddress = {
  "1": "0xa82a423671379fD93f78eA4A37ABA73C019C6D3C",
  "4": "0xba232b47a7dDFCCc221916cf08Da03a4973D3A1D",
  notSupportedChainId: "0xba232b47a7dDFCCc221916cf08Da03a4973D3A1D",
};

export class Web3Vault {
  public static isValidAddress = (address: string) => {
    const isAddress = Web3.utils.isAddress(address);
    if (!isAddress) return false;
    if (parseFloat(Web3.utils.hexToNumberString(address)) === 0) return false;
    return isAddress;
  };

  public static getVaultContractFactory = ({ chainId }: { chainId: 1 | 4 }) => {
    try {
      const factoryJsonAbi = FactoryJSON.abi as AbiItem[];
      const contract = new this.web3[String(chainId)].eth.Contract(
        factoryJsonAbi,
        vaultWalletAddress[String(chainId)]
      ) as unknown as Contract;

      return contract;
    } catch (e) {
      const error = e as Error;
      throw new Error(error.message);
    }
  };

  public static getVaultContract = async ({
    chainId,
    address,
  }: {
    chainId: 1 | 4;
    address: string;
  }) => {
    try {
      console.log({ address });
      const onChainContract = this.getVaultContractFactory({ chainId });
      console.log({ onChainContract });
      const walletAccount = await onChainContract?.methods
        .getWallet(address)
        .call();
      if (walletAccount && this.isValidAddress(walletAccount)) {
        const walletJsonAbi = WalletJSON.abi as AbiItem[];
        const contract =  new this.web3[String(chainId)].eth.Contract(
          walletJsonAbi,
          walletAccount
        ) as unknown as Contract;

        return contract;
      } else {
        console.error("vault wallet not found");
        return undefined;
      }
    } catch (err) {
      throw new Error(err as string);
    }
  };

  private static provider = {
    "1": new Web3.providers.WebsocketProvider(RPC_URLS[1]),
    "4": new Web3.providers.WebsocketProvider(RPC_URLS[4])
  }
  private static web3 = {
    "1": new Web3(this.provider["1"]),
    "4": new Web3(this.provider["4"]),
  }

}
