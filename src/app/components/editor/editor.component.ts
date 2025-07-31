import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { WebContainerService } from '../../services/webcontainer.service';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorTabState } from '../models/interface';

@Component({
  selector: 'app-editor',
  imports: [],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() currentFile: any;
  @Output() contentChanged = new EventEmitter<string>();
  @ViewChild('editorElement') editorElement!: ElementRef;

  private isLoading = false;
  private editorView: EditorView | null = null;
  private updateTimeout: any;
  private isInitialized = false;
  private tabStates = new Map<string, EditorTabState>();
  private loadedFiles = new Set<string>();

  isSaving = false;

  constructor(private webContainerService: WebContainerService) {}

  ngAfterViewInit() {
    this.initializeEditor();
    this.isInitialized = true;

    // Load content if file is already set
    if (this.currentFile) {
      setTimeout(() => this.handleFileChange(), 0);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['currentFile'] && this.isInitialized) {
      const currentFile = changes['currentFile'].currentValue;
      const previousFile = changes['currentFile'].previousValue;

      // Save previous file state before switching
      if (previousFile && this.editorView) {
        this.saveTabState(previousFile.path);
      }

      // Handle the new file
      if (currentFile) {
        this.handleFileChange();
      } else if (!currentFile && this.editorView) {
        // Clear editor when no file is selected
        this.clearEditor();
      }
    }
  }

  private initializeEditor() {
    if (this.editorView) return;

    const startState = EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        oneDark,
        EditorView.lineWrapping,
        this.createUpdateListener(),
      ],
    });

    this.editorView = new EditorView({
      state: startState,
      parent: this.editorElement.nativeElement,
    });
  }

  private createUpdateListener() {
    return EditorView.updateListener.of((update) => {
      // Don't emit changes while loading
      if (update.docChanged && this.currentFile && !this.isLoading) {
        clearTimeout(this.updateTimeout);
        this.isSaving = true;

        this.updateTimeout = setTimeout(() => {
          const content = update.state.doc.toString();

          // Never save the loading placeholder
          if (content.includes('// Loading file content...')) {
            this.isSaving = false;
            return;
          }

          this.contentChanged.emit(content);

          // Update cached content
          if (this.tabStates.has(this.currentFile.path)) {
            const state = this.tabStates.get(this.currentFile.path)!;
            state.content = content;
          }

          this.isSaving = false;
        }, 500);
      }
    });
  }

  private async handleFileChange() {
    if (!this.editorView || !this.currentFile) return;

    const filePath = this.currentFile.path;

    // Check if we have a cached state for this file
    if (this.tabStates.has(filePath)) {
      // Restore the cached state
      this.restoreTabState(filePath);
    } else {
      // First time opening this file - load from WebContainer
      await this.loadFileContent();
    }
  }

  private async loadFileContent() {
    if (!this.editorView || !this.currentFile) return;

    try {
      this.isLoading = true; // Set loading flag

      // Only show loading message if file hasn't been loaded before
      if (!this.loadedFiles.has(this.currentFile.path)) {
        this.editorView.dispatch({
          changes: {
            from: 0,
            to: this.editorView.state.doc.length,
            insert: '// Loading file content...',
          },
        });
      }

      // Read file content from WebContainer
      const content = await this.webContainerService.readFile(
        this.currentFile.path
      );

      // Get appropriate language extension
      const langExtension = this.getLanguageExtension(this.currentFile.name);

      // Create new state with the file content and language support
      const newState = EditorState.create({
        doc: content || '',
        extensions: [
          basicSetup,
          oneDark,
          langExtension,
          EditorView.lineWrapping,
          this.createUpdateListener(),
        ],
      });

      // Replace the entire editor state
      this.editorView.setState(newState);

      // Mark file as loaded
      this.loadedFiles.add(this.currentFile.path);

      // Save the initial state
      this.saveTabState(this.currentFile.path);

      // Focus the editor
      this.editorView.focus();

      this.isLoading = false; // Clear loading flag
    } catch (error) {
      console.error('Error loading file:', error);

      // Show error in editor
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: `// Error loading file: ${error}\n// Please try again or check if the file exists.`,
        },
      });

      this.isLoading = false; // Clear loading flag
    }
  }

  private saveTabState(filePath: string) {
    if (!this.editorView) return;

    const state = this.editorView.state;
    const scrollDOM = this.editorView.scrollDOM;

    this.tabStates.set(filePath, {
      content: state.doc.toString(),
      state: state,
      scrollPosition: {
        top: scrollDOM.scrollTop,
        left: scrollDOM.scrollLeft,
      },
      cursorPosition: state.selection.main.head,
    });
  }

  private restoreTabState(filePath: string) {
    if (!this.editorView || !this.tabStates.has(filePath)) return;

    const tabState = this.tabStates.get(filePath)!;

    // Get appropriate language extension for syntax highlighting
    const langExtension = this.getLanguageExtension(this.currentFile.name);

    // Create new state with cached content but fresh extensions
    const newState = EditorState.create({
      doc: tabState.content,
      extensions: [
        basicSetup,
        oneDark,
        langExtension,
        EditorView.lineWrapping,
        this.createUpdateListener(),
      ],
      selection: { anchor: tabState.cursorPosition },
    });

    // Set the state
    this.editorView.setState(newState);

    // Restore scroll position after a short delay
    setTimeout(() => {
      if (this.editorView) {
        this.editorView.scrollDOM.scrollTop = tabState.scrollPosition.top;
        this.editorView.scrollDOM.scrollLeft = tabState.scrollPosition.left;
        this.editorView.focus();
      }
    }, 0);
  }

  private clearEditor() {
    if (!this.editorView) return;

    this.editorView.dispatch({
      changes: {
        from: 0,
        to: this.editorView.state.doc.length,
        insert: '',
      },
    });
  }

  private getLanguageExtension(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const name = fileName.toLowerCase();

    // Check by filename first
    if (
      name === 'package.json' ||
      name === 'tsconfig.json' ||
      name === 'angular.json'
    ) {
      return json();
    }

    // Then by extension
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'mjs':
        return javascript({ jsx: true });
      case 'ts':
      case 'tsx':
        return javascript({ jsx: true, typescript: true });
      case 'html':
      case 'htm':
        return html();
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return css();
      case 'json':
        return json();
      case 'md':
      case 'markdown':
        return markdown();
      default:
        // Default to JavaScript for unknown file types
        return javascript();
    }
  }

  ngOnDestroy() {
    // Save current file state before destroying
    if (this.currentFile && this.editorView) {
      this.saveTabState(this.currentFile.path);
    }

    if (this.editorView) {
      this.editorView.destroy();
    }
    clearTimeout(this.updateTimeout);

    // Clear caches
    this.tabStates.clear();
    this.loadedFiles.clear();
  }
}
