declare const process: {
  cwd(): string;
};

declare module 'node:fs/promises' {
  export function access(path: string): Promise<void>;
}
