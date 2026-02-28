declare module 'qz-tray' {
  const qz: {
    websocket: {
      isActive: () => boolean;
      connect: () => Promise<unknown>;
      disconnect: () => void;
    };
    printers: {
      find: (query?: string) => Promise<string[] | string>;
      getDefault: () => Promise<string>;
      details: () => Promise<unknown>;
    };
    configs: {
      create: (printer: string | object, options?: object) => { getPrinter: () => unknown; getOptions: () => unknown };
    };
    print: (config: unknown, data: unknown[]) => Promise<unknown>;
  };
  export default qz;
}
