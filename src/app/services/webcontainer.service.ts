import { Injectable, signal } from '@angular/core';
import { WebContainer } from '@webcontainer/api';
import { BehaviorSubject } from 'rxjs';
import { FileTreeNode } from '../components/models/interface';

@Injectable({
  providedIn: 'root',
})
export class WebContainerService {
  private _backgroundObject = signal<{ bgClass: string }>({
    bgClass: 'bg-one',
  });

  sharedObject = this._backgroundObject.asReadonly();

  updateObject(obj: any) {
    this._backgroundObject.set(obj);
  }

  public isServerRunning = signal(false);
  // Terminal streams
  // private terminalOutput$ = new BehaviorSubject<string>('');
  private commandHistory: string[] = [];
  private historyIndex = -1;

  private webcontainerInstance: WebContainer | null = null;
  private files: Map<string, any> = new Map();
  private serverProcess: any = null;

  // Observable states
  private terminalOutput$ = new BehaviorSubject<string>('');
  private isRunning$ = new BehaviorSubject<boolean>(false);
  private serverUrl$ = new BehaviorSubject<string | null>(null);

  // Public observables
  terminalOutput = this.terminalOutput$.asObservable();
  isRunning = this.isRunning$.asObservable();
  serverUrl = this.serverUrl$.asObservable();

  async initialize() {
    try {
      if (!this.webcontainerInstance) {
        this.webcontainerInstance = await WebContainer.boot();
        this.writeOutput('🚀 WebContainer Terminal Ready\n');
        this.writeOutput('Type your commands below:\n\n$ ');
      }
    } catch (error) {
      console.error('Failed to initialize WebContainer:', error);
      this.writeOutput('Error initializing WebContainer\n', 'error');
    }
  }

  private writeOutput(
    text: string,
    type: 'normal' | 'error' | 'success' = 'normal'
  ) {
    let output = text;

    // Simple color coding without ANSI codes (to avoid SES issues)
    if (type === 'error') {
      output = `[ERROR] ${text}`;
    } else if (type === 'success') {
      output = `[OK] ${text}`;
    }

    this.terminalOutput$.next(this.terminalOutput$.value + output);
  }

  async executeCommand(command: string) {
    if (!this.webcontainerInstance || !command.trim()) {
      this.writeOutput('$ ');
      return;
    }

    // Handle SIGINT (Ctrl+C)
    if (command === 'SIGINT') {
      if (this.serverProcess) {
        await this.stopServer();
      }
      this.writeOutput('$ ');
      return;
    }

    // // Echo command
    // this.writeOutput(`$ ${command}\n`);

    // Handle built-in commands
    if (command === 'clear') {
      this.terminalOutput$.next('$ ');
      return;
    }

    if (command === 'help') {
      this.writeOutput(`
Available commands:
  npm install     - Install dependencies
  npm start       - Start the server
  npm run <cmd>   - Run npm scripts
  clear          - Clear terminal
  help           - Show this help
  ls             - List files
  pwd            - Print working directory
  exit/stop      - Stop the server

$ `);
      return;
    }

    // Handle server commands
    if (command === 'npm start' || command === 'npm run start') {
      await this.startServer();
      return;
    }

    if (command === 'exit' || command === 'stop') {
      await this.stopServer();
      this.writeOutput('$ ');
      return;
    }

    // Execute general commands
    try {
      const [cmd, ...args] = command.split(' ');
      const process = await this.webcontainerInstance.spawn(cmd, args);

      process.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.writeOutput(data);
          },
        })
      );

      await process.exit;
      this.writeOutput('\n$ ');
    } catch (error: any) {
      this.writeOutput(`Command failed: ${error.message}\n$ `, 'error');
    }
  }

  async startServer() {
    if (this.serverProcess) {
      this.writeOutput('Server is already running!\n$ ', 'error');
      return;
    }

    try {
      this.writeOutput('Installing dependencies...\n');

      // Install dependencies
      const installProcess = await this.webcontainerInstance!.spawn('npm', [
        'install',
      ]);

      installProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.writeOutput(data);
          },
        })
      );

      await installProcess.exit;

      this.writeOutput('\nStarting Angular development server...\n');

      // Start Angular dev server
      this.serverProcess = await this.webcontainerInstance!.spawn('npm', [
        'start',
      ]);

      this.serverProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.writeOutput(data);
          },
        })
      );

      // Listen for server ready
      this.webcontainerInstance!.on('server-ready', (port, url) => {
        this.isRunning$.next(true);
        this.serverUrl$.next(url);
        this.writeOutput(
          `\n✅ Angular dev server is running at ${url}\n$ `,
          'success'
        );
      });

      // Handle server exit
      this.serverProcess.exit.then(() => {
        this.isRunning$.next(false);
        this.serverUrl$.next(null);
        this.serverProcess = null;
      });
    } catch (error: any) {
      this.writeOutput(`Failed to start server: ${error.message}\n$ `, 'error');
      this.serverProcess = null;
      this.isRunning$.next(false);
    }
  }

  async stopServer() {
    if (!this.serverProcess) {
      this.writeOutput('No server is running\n');
      return;
    }

    try {
      this.writeOutput('Stopping server...\n');
      await this.serverProcess.kill();
      this.serverProcess = null;
      this.isRunning$.next(false);
      this.serverUrl$.next(null);
      this.writeOutput('Server stopped\n', 'success');
    } catch (error: any) {
      this.writeOutput(`Failed to stop server: ${error.message}\n`, 'error');
    }
  }

  // File operations (keep existing)
  async writeFiles(files: Record<string, { content: string }>) {
    if (!this.webcontainerInstance) return;

    for (const [path, file] of Object.entries(files)) {
      const dirs = path.split('/').slice(0, -1);
      if (dirs.length > 0) {
        const dirPath = dirs.join('/');
        try {
          await this.webcontainerInstance.fs.mkdir(dirPath, {
            recursive: true,
          });
        } catch (e) {
          // Directory might already exist
        }
      }

      await this.writeFile(path, file.content);
    }
  }

  async writeFile(path: string, content: string) {
    if (!this.webcontainerInstance) return;
    await this.webcontainerInstance.fs.writeFile(path, content);
    this.files.set(path, { path, content });
  }

  async readFile(path: string): Promise<string> {
    if (!this.webcontainerInstance) return '';
    try {
      return await this.webcontainerInstance.fs.readFile(path, 'utf-8');
    } catch (error) {
      console.error('Error reading file:', error);
      return '';
    }
  }

  getFileList(): FileTreeNode[] {
    const fileTree: { [key: string]: any } = {};

    Array.from(this.files.entries()).forEach(([filePath]) => {
      const parts = filePath.split('/');
      let current = fileTree;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = {
            name: part,
            path: filePath,
            type: 'file',
          };
        } else {
          if (!current[part]) {
            current[part] = {
              name: part,
              path: parts.slice(0, index + 1).join('/'),
              type: 'folder',
              children: {},
            };
          }
          current = current[part].children;
        }
      });
    });

    const convertToArray = (obj: { [key: string]: any }): FileTreeNode[] => {
      return Object.values(obj)
        .map((item): FileTreeNode => {
          if (item.type === 'folder' && item.children) {
            return {
              name: item.name,
              path: item.path,
              type: 'folder',
              children: convertToArray(item.children),
            };
          }
          return {
            name: item.name,
            path: item.path,
            type: item.type,
          };
        })
        .sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
    };

    return convertToArray(fileTree);
  }

  private writeToTerminal(
    text: string,
    type: 'info' | 'error' | 'success' | 'command' | 'output' = 'output'
  ) {
    const timestamp = new Date().toLocaleTimeString();
    let formattedText = text;

    // Apply formatting based on type
    switch (type) {
      case 'error':
        formattedText = `\x1b[31m${text}\x1b[0m`; // Red
        break;
      case 'success':
        formattedText = `\x1b[32m${text}\x1b[0m`; // Green
        break;
      case 'info':
        formattedText = `\x1b[36m${text}\x1b[0m`; // Cyan
        break;
      case 'command':
        formattedText = `\x1b[33m$ ${text}\x1b[0m`; // Yellow
        break;
    }

    this.terminalOutput$.next(this.terminalOutput$.value + formattedText);
  }

  private showPrompt() {
    this.writeToTerminal('$ ', 'command');
  }

  clearTerminal() {
    this.terminalOutput$.next('');
    this.showPrompt();
  }

  // Get command from history
  getPreviousCommand(): string | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.commandHistory[this.historyIndex];
    }
    return null;
  }

  getNextCommand(): string | null {
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      return this.commandHistory[this.historyIndex];
    } else if (this.historyIndex === this.commandHistory.length - 1) {
      this.historyIndex = this.commandHistory.length;
      return '';
    }
    return null;
  }

  async runCommand(command: string): Promise<void> {
    if (!this.webcontainerInstance) return;

    const process = await this.webcontainerInstance.spawn(
      command.split(' ')[0],
      command.split(' ').slice(1)
    );

    process.output.pipeTo(
      new WritableStream({
        write: (data) => {
          this.terminalOutput$.next(this.terminalOutput$.value + data);
        },
      })
    );

    // Wait for the process to exit
    await process.exit;
  }

  async runProject(): Promise<string | null> {
    if (!this.webcontainerInstance) return null;

    try {
      // Install dependencies
      this.terminalOutput$.next('Installing dependencies...\n');
      await this.runCommand('npm install');

      // Start the server
      this.terminalOutput$.next('Starting server...\n');
      const serverProcess = await this.webcontainerInstance.spawn('node', [
        'server.js',
      ]);

      serverProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.terminalOutput$.next(this.terminalOutput$.value + data);
          },
        })
      );

      // Wait for server to be ready
      const result = await new Promise<string>((resolve) => {
        this.webcontainerInstance!.on('server-ready', (port, url) => {
          resolve(url);
        });
      });

      return result;
    } catch (error) {
      console.error('Error running project:', error);
      this.terminalOutput$.next(`Error: ${error}\n`);
      return null;
    }
  }

  getTerminalStream() {
    return this.terminalOutput$;
  }
}
