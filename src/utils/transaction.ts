/**
 * Transaction utility functions
 */

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    VersionedTransaction,
    ComputeBudgetProgram,
    SendTransactionError
  } from '@solana/web3.js';
  import bs58 from 'bs58';
  import { JUPITER_SETTINGS } from '../constants/config';
  
  /**
   * Add priority fee to a transaction
   * @param transaction Transaction to add priority fee to
   * @param priorityFeeLamports Priority fee in microlamports
   * @returns Transaction with priority fee
   */
  export function addPriorityFee(
    transaction: Transaction,
    priorityFeeLamports = JUPITER_SETTINGS.MAX_PRIORITY_FEE_LAMPORTS
  ): Transaction {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeLamports
      })
    );
    
    return transaction;
  }
  
  /**
   * Set compute unit limit for a transaction
   * @param transaction Transaction to set compute limit for
   * @param computeUnitLimit Compute unit limit
   * @returns Transaction with compute limit set
   */
  export function setComputeLimit(
    transaction: Transaction,
    computeUnitLimit: number
  ): Transaction {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnitLimit
      })
    );
    
    return transaction;
  }
  
  /**
   * Send transaction with retry logic
   * @param connection Solana connection
   * @param transaction Transaction to send
   * @param signers Signers for the transaction
   * @param maxRetries Maximum number of retries
   * @returns Transaction signature
   */
  export async function sendWithRetry(
    connection: Connection,
    transaction: Transaction | VersionedTransaction,
    signers: Keypair[],
    maxRetries = 3
  ): Promise<string> {
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        // For regular Transaction
        if (transaction instanceof Transaction) {
          // Update blockhash before each attempt
          transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          transaction.feePayer = signers[0].publicKey;
          
          // Sign transaction
          if (signers.length > 0) {
            transaction.sign(...signers);
          }
          
          // Send transaction
          const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: true }
          );
          
          // Wait for confirmation
          const confirmation = await connection.confirmTransaction({
            signature,
            blockhash: transaction.recentBlockhash as string,
            lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
          }, 'confirmed');
          
          if (confirmation.value.err) {
            throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
          }
          
          return signature;
        } else {
          // For VersionedTransaction, which is already signed
          const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: true }
          );
          
          // Wait for confirmation
          const confirmation = await connection.confirmTransaction(signature, 'confirmed');
          
          if (confirmation.value.err) {
            throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
          }
          
          return signature;
        }
      } catch (error) {
        attempts++;
        
        if (attempts >= maxRetries) {
          if (error instanceof SendTransactionError) {
            console.error('Transaction error:', error.logs);
          }
          throw error;
        }
        
        // Exponential backoff
        const delay = 1000 * Math.pow(2, attempts);
        console.log(`Attempt ${attempts} failed, retrying in ${delay}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Maximum retries exceeded');
  }
  
  /**
   * Deserialize a base64 encoded transaction
   * @param transactionBase64 Base64 encoded transaction
   * @returns Deserialized transaction
   */
  export function deserializeTransaction(transactionBase64: string): VersionedTransaction {
    return VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
  }
  
  /**
   * Serialize a transaction to base64
   * @param transaction Transaction to serialize
   * @returns Base64 encoded transaction
   */
  export function serializeTransaction(transaction: VersionedTransaction): string {
    return Buffer.from(transaction.serialize()).toString('base64');
  }
  
  /**
   * Sign a transaction with private key
   * @param transaction Transaction to sign
   * @param privateKey Private key as base58 string
   * @returns Signed transaction
   */
  export function signTransaction(
    transaction: VersionedTransaction,
    privateKey: string
  ): VersionedTransaction {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    transaction.sign([keypair]);
    return transaction;
  }