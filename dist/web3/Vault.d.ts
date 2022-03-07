import { Contract } from "web3-eth-contract";
export declare class Vault {
    static contract: {
        [key: string]: Contract | undefined;
    };
    static setVaultContract: ({ address, chainId }: {
        address: string;
        chainId: 1 | 4;
    }) => Promise<void>;
}
