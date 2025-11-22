"use client";

import { SocketProvider } from "./context/socket";


export default function ClientProviders({ children }) {
  return <SocketProvider>{children}</SocketProvider>;
}