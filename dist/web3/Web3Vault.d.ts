import { Contract } from "web3-eth-contract";
export declare class Web3Vault {
    static isValidAddress: (address: string) => boolean;
    static getVaultContractFactory: ({ chainId }: {
        chainId: 1 | 4;
    }) => Contract;
    static getVaultContract: ({ chainId, address, }: {
        chainId: 1 | 4;
        address: string;
    }) => Promise<Contract | undefined>;
    private static provider;
    private static web3;
}
