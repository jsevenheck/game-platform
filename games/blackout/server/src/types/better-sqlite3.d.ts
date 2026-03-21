/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'better-sqlite3' {
  export interface Database {
    pragma(source: string, options?: any): any;
    prepare(source: string): Statement;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    exec(source: string): this;
    close(): this;
  }

  export interface Statement {
    run(...bindParameters: any[]): any;
    get(...bindParameters: any[]): any;
    all(...bindParameters: any[]): any[];
  }

  interface DatabaseConstructor {
    new (filename: string, options?: any): Database;
    (filename: string, options?: any): Database;
  }

  const Database: DatabaseConstructor;
  export default Database;
}
