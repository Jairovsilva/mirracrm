export {};

declare global {
  interface Window {
    logout?: () => void;
  }
}
