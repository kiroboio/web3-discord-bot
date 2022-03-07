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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vault = void 0;
const Web3Vault_1 = require("./Web3Vault");
class Vault {
}
exports.Vault = Vault;
_a = Vault;
Vault.contract = {};
Vault.setVaultContract = ({ address, chainId }) => __awaiter(void 0, void 0, void 0, function* () {
    if (_a.contract.address)
        return;
    if (!address)
        return;
    const contract = yield Web3Vault_1.Web3Vault.getVaultContract({ address, chainId });
    _a.contract[address] = contract;
});
