import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { monadTestnet } from "./chain.js";

// Get a real project ID at https://cloud.walletconnect.com
const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const config = getDefaultConfig({
  appName: "Knockout Pools",
  projectId: WC_PROJECT_ID || "00000000000000000000000000000000", // placeholder
  chains: [monadTestnet],
  ssr: false,
});

const queryClient = new QueryClient();

const rainbowTheme = darkTheme({
  accentColor: "#6E54FF",
  accentColorForeground: "#fff",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

export function Web3Provider({ children }) {
  if (!WC_PROJECT_ID) {
    console.warn(
      "[Knockout Pools] VITE_WALLETCONNECT_PROJECT_ID not set. " +
      "Wallet connect will fail. Get a free project ID at https://cloud.walletconnect.com"
    );
  }
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
