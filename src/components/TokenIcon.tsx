import React, { useState, useEffect } from 'react';

interface TokenIconProps {
  mint: string;
  size?: number;
  className?: string;
}

/**
 * Component to display token icons
 */
const TokenIcon: React.FC<TokenIconProps> = ({ 
  mint, 
  size = 24, 
  className = '' 
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchTokenIcon = async () => {
      try {
        // Load from token list using mint address
        const iconUrl = `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mint}/logo.png`;
        setImgSrc(iconUrl);
      } catch (error) {
        console.error("Error fetching token icon:", error);
        setHasError(true);
      }
    };

    setHasError(false);
    fetchTokenIcon();
  }, [mint]);

  const handleImageError = () => {
    // If logo.png fails, try to use a generic fallback based on mint
    const coinGeckoFallback = `https://api.coingecko.com/api/v3/coins/${mint.toLowerCase()}`; 
    setImgSrc(coinGeckoFallback);
    setHasError(true);
  };

  // If we still have an error after trying fallbacks, render placeholder
  const renderPlaceholder = () => {
    const initials = mint.substring(0, 2).toUpperCase();
    const backgroundColor = stringToColor(mint);
    
    return (
      <div 
        className={`flex items-center justify-center rounded-full text-white ${className}`}
        style={{ 
          width: size, 
          height: size, 
          backgroundColor,
          fontSize: size / 2,
          lineHeight: `${size}px`
        }}
      >
        {initials}
      </div>
    );
  };

  // Generate a deterministic color from a string
  const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 45%)`;
  };

  if (hasError || !imgSrc) {
    return renderPlaceholder();
  }

  return (
    <img
      src={imgSrc}
      alt={`${mint} icon`}
      className={`rounded-full ${className}`}
      width={size}
      height={size}
      onError={handleImageError}
    />
  );
};

export default TokenIcon;