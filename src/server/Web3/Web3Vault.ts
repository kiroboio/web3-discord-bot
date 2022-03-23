import FactoryJSON from "./abi/Factory.json";
import WalletJSON from "./abi/Wallet.json";
import erc20Abi from "./abi/erc20.json";
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

const kiroboAddress = {
  "1": "0xB1191F691A355b43542Bea9B8847bc73e7Abb137",
  "4": "0xb678e95f83af08e7598ec21533f7585e83272799",
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

  public static getKiroboTokenContract = ({ chainId }: { chainId: 1 | 4 }) => {
    const chainIdText = String(chainId);
    const erc20AbiItem = erc20Abi as AbiItem[];
    const tokenAddress = kiroboAddress[chainIdText];

    const contract = new this.web3[chainIdText].eth.Contract(
      erc20AbiItem,
      tokenAddress
    ) as unknown as Contract;

    return contract;
  };

  public static getVaultContract = async ({
    chainId,
    address,
  }: {
    chainId: 1 | 4;
    address: string;
  }) => {
    try {
      const onChainContract = this.getVaultContractFactory({ chainId });
      const walletAccount = await onChainContract?.methods
        .getWallet(address)
        .call();
      if (walletAccount && this.isValidAddress(walletAccount)) {
        const walletJsonAbi = WalletJSON.abi as AbiItem[];
        const contract = new this.web3[String(chainId)].eth.Contract(
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

  public static provider = {
    "1": new Web3.providers.WebsocketProvider(RPC_URLS[1]),
    "4": new Web3.providers.WebsocketProvider(RPC_URLS[4]),
  };
  public static web3 = {
    "1": new Web3(this.provider["1"]),
    "4": new Web3(this.provider["4"]),
  };
}
