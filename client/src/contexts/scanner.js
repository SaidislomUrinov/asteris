import { createContext, useContext } from "react";

export const ScannerContext = createContext(null);

export const useScanner = () => useContext(ScannerContext);
