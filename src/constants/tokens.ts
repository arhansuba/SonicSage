// src/constants/tokens.ts

/**
 * Token constants including addresses for Sonic, Solana, USDC, USDT, Bitcoin, Ethereum,
 * and other Solana-related tokens. Addresses are sourced from official Solana explorers,
 * documentation, or reputable public sources.
 */
export const TOKEN_ADDRESSES = {
    // Native Solana token (SOL)
    SOL: {
      symbol: "SOL",
      name: "Solana",
      address: "So11111111111111111111111111111111111111112", // Wrapped SOL address (SPL token)
      decimals: 9,
      blockchain: "Solana",
    },
  
    // Sonic token (assuming it's a Solana-based token; address may vary by context)
    SONIC: {
      symbol: "SONIC",
      name: "Sonic",
      address: "sonic2o23fQczR8s8tCag1bH4NxJzjJCrRjw8m89G8kW", // Placeholder; replace with actual Sonic token address if available
      decimals: 6,
      blockchain: "Solana",
      note: "Sonic token address may vary depending on the Sonic SVM context. Verify with official Sonic documentation.",
    },
  
    // USD Coin (USDC) on Solana
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Official USDC-SPL address on Solana
      decimals: 6,
      blockchain: "Solana",
    },
  
    // Tether (USDT) on Solana
    USDT: {
      symbol: "USDT",
      name: "Tether",
      address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // Official USDT-SPL address on Solana
      decimals: 6,
      blockchain: "Solana",
    },
  
    // Wrapped Bitcoin (WBTC) on Solana
    WBTC: {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      address: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // Wrapped BTC address on Solana
      decimals: 8,
      blockchain: "Solana",
    },
  
    // Wrapped Ethereum (WETH) on Solana
    WETH: {
      symbol: "WETH",
      name: "Wrapped Ethereum",
      address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // Wrapped ETH address on Solana
      decimals: 8,
      blockchain: "Solana",
    },
  
    // Additional Solana-related tokens
    SRM: {
      symbol: "SRM",
      name: "Serum",
      address: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt", // Serum token address on Solana
      decimals: 6,
      blockchain: "Solana",
    },
  
    RAY: {
      symbol: "RAY",
      name: "Raydium",
      address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // Raydium token address on Solana
      decimals: 6,
      blockchain: "Solana",
    },
  
    ORCA: {
      symbol: "ORCA",
      name: "Orca",
      address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", // Orca token address on Solana
      decimals: 6,
      blockchain: "Solana",
    },
  
    JUP: {
      symbol: "JUP",
      name: "Jupiter",
      address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedkjD7mNk", // Jupiter token address on Solana
      decimals: 6,
      blockchain: "Solana",
    },
  } as const;
  
  // Type definition for token keys
  export type TokenKey = keyof typeof TOKEN_ADDRESSES;
  
  // Utility function to get token details by symbol
  export const getTokenBySymbol = (symbol: string) => {
    return Object.values(TOKEN_ADDRESSES).find(
      (token) => token.symbol.toUpperCase() === symbol.toUpperCase()
    );
  };
  
  // Utility function to get token address by symbol
  export const getTokenAddress = (symbol: string): string | undefined => {
    const token = getTokenBySymbol(symbol);
    return token?.address;
  };

// Define an interface for token decimals
interface TokenDecimals {
  [key: string]: number;
}

/**
 * Token decimals mapped by symbol for easy access
 */
export const TOKEN_DECIMALS: TokenDecimals = {
    SOL: 9,
    SONIC: 6,
    USDC: 6,
    USDT: 6,
    WBTC: 8,
    WETH: 8,
    SRM: 6,
    RAY: 6,
    ORCA: 6,
    JUP: 6,
  } as const;
  
  // Example usage:
  // console.log(getTokenAddress("USDC")); // "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  // console.log(getTokenBySymbol("SOL")); // { symbol: "SOL", name: "Solana", address: "So11111111111111111111111111111111111111112", decimals: 9, blockchain: "Solana" }