import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base } from "@reown/appkit/networks";
import { DATA_SUFFIX } from "./buildercode";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "";

if (!projectId) {
  console.warn("NEXT_PUBLIC_REOWN_PROJECT_ID is not set — AppKit wallet connect will not work.");
}

export const networks = [base];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
  dataSuffix: DATA_SUFFIX,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
