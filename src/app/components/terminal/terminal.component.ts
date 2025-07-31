import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebContainerService } from '../../services/webcontainer.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-terminal',
  imports: [],
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.scss',
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalElement') terminalElement!: ElementRef;

  private terminal!: Terminal;
  private fitAddon: FitAddon | null = null;
  private subscription: Subscription | null = null;
  private runningSubscription: Subscription | null = null;
  private currentLine = '';
  private cursorPosition = 0;
  private webContainerService = inject(WebContainerService);

  isServerRunning = false;

  ngAfterViewInit() {
    this.initializeTerminal();
    this.subscribeToOutput();
  }

  private initializeTerminal() {
    this.terminal = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
      },
      fontSize: 12,
      fontFamily: 'Consolas, Monaco, monospace',
      cursorBlink: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.terminalElement.nativeElement);

    setTimeout(() => {
      this.fitAddon?.fit();
    }, 100);

    // Handle user input
    this.terminal.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) {
        // Enter
        this.terminal.write('\r\n');
        this.webContainerService.executeCommand(this.currentLine);
        this.currentLine = '';
        this.cursorPosition = 0;
      } else if (code === 127) {
        // Backspace
        if (this.cursorPosition > 0) {
          this.currentLine = this.currentLine.slice(0, -1);
          this.cursorPosition--;
          this.terminal.write('\b \b');
        }
      } else if (code === 3) {
        // Ctrl+C
        this.terminal.write('^C\r\n');
        this.currentLine = '';
        this.cursorPosition = 0;
        // Send interrupt command
        this.webContainerService.executeCommand('SIGINT');
      } else if (data === '\u001b[A') {
        // Up arrow
        // TODO: Implement command history
      } else if (data === '\u001b[B') {
        // Down arrow
        // TODO: Implement command history
      } else if (code >= 32) {
        // Printable characters
        this.currentLine += data;
        this.cursorPosition++;
        this.terminal.write(data);
      }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.fitAddon?.fit();
    });
  }

  private subscribeToOutput() {
    let lastLength = 0;

    this.subscription = this.webContainerService.terminalOutput.subscribe(
      (output) => {
        if (this.terminal && output.length > lastLength) {
          const newContent = output.substring(lastLength);
          this.terminal.write(newContent.replace(/\n/g, '\r\n'));
          lastLength = output.length;
        }
      }
    );

    this.runningSubscription = this.webContainerService.isRunning.subscribe(
      (running) => {
        this.isServerRunning = running;
      }
    );
  }

  clearTerminal() {
    if (this.terminal) {
      this.terminal.clear();
      this.terminal.reset();
      this.webContainerService.executeCommand('clear');
    }
  }

  ngOnDestroy() {
    this.terminal?.dispose();
    this.subscription?.unsubscribe();
    this.runningSubscription?.unsubscribe();
  }
}
