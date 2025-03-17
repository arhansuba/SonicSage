// src/services/WalletAdapter.ts

import { Wallet } from '@coral-xyz/anchor';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction, 
  VersionedTransaction, 
  SendOptions,
  Keypair 
} from '@solana/web3.js';

/**
 * WalletAdapter class that adapts a Solana wallet-adapter-react wallet context
 * to be compatible with Anchor's wallet interface.
 */
export class WalletAdapter implements Wallet {
  private _wallet: WalletContextState;
  private _dummyKeypair: Keypair;

  constructor(wallet: WalletContextState) {
    this._wallet = wallet;
    // Create a dummy keypair for the payer property
    // This won't be used for actual signing, just to satisfy the interface
    this._dummyKeypair = Keypair.generate();
  }

  /**
   * Get the wallet's public key
   */
  get publicKey(): PublicKey {
    if (!this._wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    return this._wallet.publicKey;
  }

  /**
   * Required property for Anchor's Wallet interface
   * Note: This returns a dummy keypair and should never be used for actual signing
   */
  get payer(): Keypair {
    return this._dummyKeypair;
  }

  /**
   * Sign a transaction
   * @param tx Transaction to sign
   * @returns Signed transaction
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (!this._wallet.signTransaction) {
      throw new Error('Wallet does not support signing transactions');
    }
    return await this._wallet.signTransaction(tx);
  }

  /**
   * Sign multiple transactions
   * @param txs Transactions to sign
   * @returns Array of signed transactions
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    if (!this._wallet.signAllTransactions) {
      throw new Error('Wallet does not support signing multiple transactions');
    }
    return await this._wallet.signAllTransactions(txs);
  }

  /**
   * Sign an arbitrary message
   * @param message Message to sign
   * @returns Signature
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._wallet.signMessage) {
      throw new Error('Wallet does not support signing messages');
    }
    
    const signature = await this._wallet.signMessage(message);
    return signature;
  }

  /**
   * Check if wallet is connected
   */
  get isConnected(): boolean {
    return !!this._wallet.connected;
  }

  /**
   * Get the original wallet context
   */
  get walletContext(): WalletContextState {
    return this._wallet;
  }
}

/**
 * Helper function to create a WalletAdapter instance from a Solana wallet context
 * @param walletContext The wallet context from useWallet()
 * @returns WalletAdapter instance
 */
export function createWalletAdapter(walletContext: WalletContextState): WalletAdapter {
  return new WalletAdapter(walletContext);
}