declare module 'openclaw/plugin-sdk' {
  export interface OpenClawPluginApi {
    logger: {
      debug(msg: string): void;
      warn(msg: string): void;
      info?(msg: string): void;
      error?(msg: string): void;
    };
    pluginConfig: unknown;
    registerTool(tool: any, options?: any): void;
    on(event: string, handler: (event: Record<string, unknown>, context?: Record<string, unknown>) => unknown): void;
  }
}