"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Web3Vault = void 0;
const Factory_json_1 = __importDefault(require("./abi/Factory.json"));
const Wallet_json_1 = __importDefault(require("./abi/Wallet.json"));
const web3_1 = __importDefault(require("web3"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const RPC_URLS = {
    "1": `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_KEY}`,
    "4": `wss://rinkeby.infura.io/ws/v3/${process.env.INFURA_KEY}`,
};
const vaultWalletAddress = {
    "1": "0xa82a423671379fD93f78eA4A37ABA73C019C6D3C",
    "4": "0xba232b47a7dDFCCc221916cf08Da03a4973D3A1D",
    notSupportedChainId: "0xba232b47a7dDFCCc221916cf08Da03a4973D3A1D",
};
class Web3Vault {
}
exports.Web3Vault = Web3Vault;
_a = Web3Vault;
Web3Vault.isValidAddress = (address) => {
    const isAddress = web3_1.default.utils.isAddress(address);
    if (!isAddress)
        return false;
    if (parseFloat(web3_1.default.utils.hexToNumberString(address)) === 0)
        return false;
    return isAddress;
};
Web3Vault.getVaultContractFactory = ({ chainId }) => {
    try {
        const factoryJsonAbi = Factory_json_1.default.abi;
        const contract = new _a.web3[String(chainId)].eth.Contract(factoryJsonAbi, vaultWalletAddress[String(chainId)]);
        return contract;
    }
    catch (e) {
        const error = e;
        throw new Error(error.message);
    }
};
Web3Vault.getVaultContract = ({ chainId, address, }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const onChainContract = _a.getVaultContractFactory({ chainId });
        const walletAccount = yield (onChainContract === null || onChainContract === void 0 ? void 0 : onChainContract.methods.getWallet(address).call());
        if (walletAccount && _a.isValidAddress(walletAccount)) {
            const walletJsonAbi = Wallet_json_1.default.abi;
            const contract = new _a.web3[String(chainId)].eth.Contract(walletJsonAbi, walletAccount);
            return contract;
        }
        else {
            console.error("vault wallet not found");
            return undefined;
        }
    }
    catch (err) {
        throw new Error(err);
    }
});
Web3Vault.provider = {
    "1": new web3_1.default.providers.WebsocketProvider(RPC_URLS[1]),
    "4": new web3_1.default.providers.WebsocketProvider(RPC_URLS[4])
};
Web3Vault.web3 = {
    "1": new web3_1.default(_a.provider["1"]),
    "4": new web3_1.default(_a.provider["4"]),
};
