import {
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FileTreeNode } from '../models/interface';
import { WebContainerService } from '../../services/webcontainer.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EditorComponent } from '../editor/editor.component';
import { TerminalComponent } from '../terminal/terminal.component';
import { FileExplorerComponent } from '../file-explorer/file-explorer.component';
import { delay, of, Subscription } from 'rxjs';
import { FileIconsService } from '../../services/file-icons.service';
import {
  trigger,
  state,
  style,
  transition,
  animate,
  query,
  stagger,
} from '@angular/animations';
import { SettingsComponent } from '../../shared/settings/settings.component';

@Component({
  selector: 'app-web-wrapper',
  imports: [
    EditorComponent,
    TerminalComponent,
    FileExplorerComponent,
    SettingsComponent,
  ],
  templateUrl: './web-wrapper.component.html',
  styleUrl: './web-wrapper.component.scss',
  animations: [
    trigger('fabAnimation', [
      state(
        'closed',
        style({
          transform: 'scale(1) rotate(0deg)',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
        })
      ),
      state(
        'open',
        style({
          transform: 'scale(1.1) rotate(45deg)',
          boxShadow: '0 8px 25px rgba(99, 102, 241, 0.5)',
        })
      ),
      transition('closed <=> open', [
        animate('200ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ]),
    ]),
  ],
})
export class WebWrapperComponent implements OnInit {
  files: FileTreeNode[] = [];
  openTabs: any[] = [];
  currentFile: any = null;
  isServerRunning = false;
  previewUrl: string | null = null;
  safePreviewUrl: SafeResourceUrl | null = null;

  // Panel sizes
  leftPanelWidth = 200;
  rightPanelWidth = 600;
  bottomPanelHeight = 200;

  // Resize state
  private isResizing = false;
  private resizePanel: string | null = null;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;

  // Subscriptions
  private serverUrlSubscription: Subscription | null = null;
  private runningSubscription: Subscription | null = null;

  private webContainerService = inject(WebContainerService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private fileIconService = inject(FileIconsService);
  private menuOpen = signal<boolean>(false);
  isMenuOpen = computed(() => this.menuOpen());

  projectRunning = false;
  projectStopped = false;
  data = this.webContainerService.sharedObject;

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isMenuOpen()) {
      event.preventDefault();
      this.closeSidemenu();
    }
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const isMenuClick =
      target.closest('.sidemenu') || target.closest('.btns-transparent-icon');

    if (!isMenuClick && this.isMenuOpen()) {
      this.closeSidemenu();
    }
  }

  toggleSidemenu(): void {
    this.menuOpen.update((current) => !current);

    if (this.isMenuOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }

  closeSidemenu(): void {
    this.menuOpen.set(false);
    // document.body.style.overflow = 'auto';
  }

  async ngOnInit() {
    this.runningSubscription = this.webContainerService.isRunning.subscribe(
      (running) => {
        this.isServerRunning = running;
        this.projectRunning = false;
        this.projectStopped = false;
        this.cdr.detectChanges();
      }
    );

    this.serverUrlSubscription = this.webContainerService.serverUrl.subscribe(
      (url) => {
        if (url) {
          this.previewUrl = url;
          this.safePreviewUrl =
            this.sanitizer.bypassSecurityTrustResourceUrl(url);
        } else {
          this.previewUrl = null;
          this.safePreviewUrl = null;
        }
        this.cdr.detectChanges();
      }
    );

    await this.webContainerService.initialize();
    await this.loadAngularProject();
    await this.debugFileContent();

    // Add mouse event listeners for resize
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('touchmove', this.handleMouseMove);
    document.addEventListener('touchend', this.handleMouseUp);
  }

  ngOnDestroy() {
    this.serverUrlSubscription?.unsubscribe();
    this.runningSubscription?.unsubscribe();
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchmove', this.handleMouseMove);
    document.removeEventListener('touchend', this.handleMouseUp);
  }

  startResize(event: MouseEvent | TouchEvent, panel: string) {
    this.isResizing = true;
    this.resizePanel = panel;

    const clientX =
      event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY =
      event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    this.startX = clientX;
    this.startY = clientY;

    if (panel === 'left') {
      this.startWidth = this.leftPanelWidth;
    } else if (panel === 'right') {
      this.startWidth = this.rightPanelWidth;
    } else if (panel === 'bottom') {
      this.startHeight = this.bottomPanelHeight;
    }

    event.preventDefault();
  }

  private handleMouseMove = (event: MouseEvent | TouchEvent) => {
    if (!this.isResizing) return;

    const clientX =
      event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY =
      event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    if (this.resizePanel === 'left') {
      const diff = clientX - this.startX;
      this.leftPanelWidth = Math.max(
        200,
        Math.min(600, this.startWidth + diff)
      );
    } else if (this.resizePanel === 'right') {
      const diff = this.startX - clientX;
      this.rightPanelWidth = Math.max(
        300,
        Math.min(800, this.startWidth + diff)
      );
    } else if (this.resizePanel === 'bottom') {
      const diff = this.startY - clientY;
      this.bottomPanelHeight = Math.max(
        150,
        Math.min(600, this.startHeight + diff)
      );
    }
  };

  async debugFileContent() {
    // Test reading a file directly
    let testContent = await this.webContainerService.readFile('server.js');
    console.log('Test file content:', testContent);
  }

  private handleMouseUp = () => {
    this.isResizing = false;
    this.resizePanel = null;
  };

  async onFileSelected(file: FileTreeNode) {
    // Only process files, not folders
    if (file.type !== 'file') {
      console.log('Clicked on folder:', file.name);
      return;
    }

    console.log('Opening file:', file.path);

    // Check if tab already exists
    let existingTab = this.openTabs.find((tab) => tab.path === file.path);
    if (!existingTab) {
      this.openTabs.push(file);
    }

    // Set as current file - this triggers editor update
    this.currentFile = file;

    // Force change detection
    this.cdr.detectChanges();
    console.log('this.currentFile::', this.currentFile);
  }

  selectTab(file: any) {
    if (this.currentFile?.path !== file.path) {
      this.currentFile = file;
      this.cdr.detectChanges();
    }
  }

  closeTab(file: any, event: Event) {
    event.stopPropagation();
    const index = this.openTabs.findIndex((tab) => tab.path === file.path);
    if (index > -1) {
      this.openTabs.splice(index, 1);

      // If closing the current file, switch to another tab
      if (this.currentFile?.path === file.path) {
        this.currentFile =
          this.openTabs[index] || this.openTabs[index - 1] || null;
      }
    }
    // event.stopPropagation();
    // const index = this.openTabs.findIndex((tab) => tab.path === file.path);
    // if (index > -1) {
    //   this.openTabs.splice(index, 1);
    //   if (this.currentFile?.path === file.path) {
    //     this.currentFile =
    //       this.openTabs[index] || this.openTabs[index - 1] || null;
    //   }
    // }
  }

  async onContentChanged(content: string) {
    if (this.currentFile) {
      await this.webContainerService.writeFile(this.currentFile.path, content);
    }
  }

  async runProject() {
    this.projectRunning = true;
    await this.webContainerService.startServer();
  }

  async stopProject() {
    this.projectStopped = true;
    of(null)
      .pipe(delay(1000))
      .subscribe(async () => {
        await this.webContainerService.stopServer();
      });
  }

  onPreviewLoad() {
    console.log('Preview loaded successfully');
  }

  async loadAngularProject() {
    const angularFiles = {
      'package.json': {
        content: JSON.stringify(
          {
            name: 'angular-webcontainer-app',
            version: '0.0.0',
            scripts: {
              ng: 'ng',
              start: 'ng serve --host 0.0.0.0 --port 3000 --disable-host-check',
              build: 'ng build',
              watch: 'ng build --watch --configuration development',
            },
            private: true,
            dependencies: {
              '@angular/animations': '^17.0.0',
              '@angular/common': '^17.0.0',
              '@angular/compiler': '^17.0.0',
              '@angular/core': '^17.0.0',
              '@angular/forms': '^17.0.0',
              '@angular/platform-browser': '^17.0.0',
              '@angular/platform-browser-dynamic': '^17.0.0',
              '@angular/router': '^17.0.0',
              rxjs: '~7.8.0',
              tslib: '^2.3.0',
              'zone.js': '~0.14.2',
            },
            devDependencies: {
              '@angular-devkit/build-angular': '^17.0.0',
              '@angular/cli': '~17.0.0',
              '@angular/compiler-cli': '^17.0.0',
              '@types/node': '^20.0.0',
              typescript: '~5.2.2',
            },
          },
          null,
          2
        ),
      },

      'angular.json': {
        content: JSON.stringify(
          {
            $schema: './node_modules/@angular/cli/lib/config/schema.json',
            version: 1,
            cli: {
              analytics: false,
            },
            newProjectRoot: 'projects',
            projects: {
              app: {
                projectType: 'application',
                schematics: {},
                root: '',
                sourceRoot: 'src',
                prefix: 'app',
                architect: {
                  build: {
                    builder: '@angular-devkit/build-angular:browser',
                    options: {
                      outputPath: 'dist/app',
                      index: 'src/index.html',
                      main: 'src/main.ts',
                      polyfills: ['zone.js'],
                      tsConfig: 'tsconfig.app.json',
                      assets: ['src/favicon.ico'],
                      styles: ['src/styles.css'],
                      scripts: [],
                    },
                    configurations: {
                      production: {
                        budgets: [
                          {
                            type: 'initial',
                            maximumWarning: '500kb',
                            maximumError: '1mb',
                          },
                        ],
                        outputHashing: 'all',
                      },
                      development: {
                        buildOptimizer: false,
                        optimization: false,
                        vendorChunk: true,
                        extractLicenses: false,
                        sourceMap: true,
                        namedChunks: true,
                      },
                    },
                    defaultConfiguration: 'production',
                  },
                  serve: {
                    builder: '@angular-devkit/build-angular:dev-server',
                    configurations: {
                      production: {
                        buildTarget: 'app:build:production',
                      },
                      development: {
                        buildTarget: 'app:build:development',
                      },
                    },
                    defaultConfiguration: 'development',
                  },
                },
              },
            },
          },
          null,
          2
        ),
      },

      'tsconfig.json': {
        content: JSON.stringify(
          {
            compileOnSave: false,
            compilerOptions: {
              baseUrl: './',
              outDir: './dist/out-tsc',
              forceConsistentCasingInFileNames: true,
              strict: true,
              noImplicitOverride: true,
              noPropertyAccessFromIndexSignature: true,
              noImplicitReturns: true,
              noFallthroughCasesInSwitch: true,
              sourceMap: true,
              declaration: false,
              downlevelIteration: true,
              experimentalDecorators: true,
              moduleResolution: 'node',
              importHelpers: true,
              target: 'ES2022',
              module: 'ES2022',
              useDefineForClassFields: false,
              lib: ['ES2022', 'dom'],
            },
            angularCompilerOptions: {
              enableI18nLegacyMessageIdFormat: false,
              strictInjectionParameters: true,
              strictInputAccessModifiers: true,
              strictTemplates: true,
            },
          },
          null,
          2
        ),
      },

      'tsconfig.app.json': {
        content: JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: {
              outDir: './out-tsc/app',
              types: [],
            },
            files: ['src/main.ts'],
            include: ['src/**/*.d.ts'],
          },
          null,
          2
        ),
      },

      'src/index.html': {
        content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Angular WebContainer App</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>`,
      },

      'src/main.ts': {
        content: `import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));`,
      },

      'src/styles.css': {
        content: `/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}`,
      },

      'src/app/app.module.ts': {
        content: `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { TodoListComponent } from './components/todo-list/todo-list.component';
import { TodoItemComponent } from './components/todo-item/todo-item.component';
import { TodoService } from './services/todo.service';

@NgModule({
  declarations: [
    AppComponent,
    TodoListComponent,
    TodoItemComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [TodoService],
  bootstrap: [AppComponent]
})
export class AppModule { }`,
      },

      'src/app/app.component.ts': {
        content: `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: \`
    <div class="app-container">
      <header class="app-header">
        <h1>{{ title }}</h1>
        <p>Running on Angular {{ angularVersion }}</p>
      </header>
      
      <main class="app-main">
        <app-todo-list></app-todo-list>
      </main>
      
      <footer class="app-footer">
        <p>Built with ❤️ in WebContainer</p>
      </footer>
    </div>
  \`,
  styles: [\`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .app-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .app-header h1 {
      margin: 0;
      font-size: 2.5rem;
    }
    
    .app-header p {
      margin: 0.5rem 0 0 0;
      opacity: 0.9;
    }
    
    .app-main {
      flex: 1;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }
    
    .app-footer {
      background: #f5f5f5;
      text-align: center;
      padding: 1rem;
      color: #666;
    }
  \`]
})
export class AppComponent {
  title = 'Angular Todo App';
  angularVersion = '17.0.0';
}`,
      },

      'src/app/components/todo-list/todo-list.component.ts': {
        content: `import { Component, OnInit } from '@angular/core';
import { TodoService } from '../../services/todo.service';
import { Todo } from '../../models/todo.model';

@Component({
  selector: 'app-todo-list',
  template: \`
    <div class="todo-list">
      <div class="todo-input">
        <input 
          type="text" 
          [(ngModel)]="newTodoText"
          (keyup.enter)="addTodo()"
          placeholder="What needs to be done?"
          class="todo-input-field"
        >
        <button (click)="addTodo()" class="add-btn">Add</button>
      </div>
      
      <div class="todo-stats">
        <span>{{ getActiveTodos().length }} active</span>
        <span>{{ getCompletedTodos().length }} completed</span>
      </div>
      
      <div class="todo-items">
        <app-todo-item 
          *ngFor="let todo of todos" 
          [todo]="todo"
          (toggle)="toggleTodo($event)"
          (delete)="deleteTodo($event)">
        </app-todo-item>
      </div>
      
      <div class="todo-filters">
        <button 
          (click)="filter = 'all'" 
          [class.active]="filter === 'all'">
          All
        </button>
        <button 
          (click)="filter = 'active'" 
          [class.active]="filter === 'active'">
          Active
        </button>
        <button 
          (click)="filter = 'completed'" 
          [class.active]="filter === 'completed'">
          Completed
        </button>
      </div>
    </div>
  \`,
  styles: [\`
    .todo-list {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 2rem;
    }
    
    .todo-input {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .todo-input-field {
      flex: 1;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 4px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    
    .todo-input-field:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .add-btn {
      padding: 0.75rem 1.5rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .add-btn:hover {
      background: #5a64d8;
    }
    
    .todo-stats {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1rem;
      color: #666;
      font-size: 0.9rem;
    }
    
    .todo-items {
      margin-bottom: 1rem;
    }
    
    .todo-filters {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
    }
    
    .todo-filters button {
      padding: 0.5rem 1rem;
      background: transparent;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .todo-filters button:hover {
      background: #f5f5f5;
    }
    
    .todo-filters button.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }
  \`]
})
export class TodoListComponent implements OnInit {
  todos: Todo[] = [];
  newTodoText = '';
  filter: 'all' | 'active' | 'completed' = 'all';
  
  constructor(private todoService: TodoService) {}
  
  ngOnInit() {
    this.todos = this.todoService.getTodos();
  }
  
  addTodo() {
    if (this.newTodoText.trim()) {
      this.todoService.addTodo(this.newTodoText);
      this.newTodoText = '';
      this.todos = this.todoService.getTodos();
    }
  }
  
  toggleTodo(id: number) {
    this.todoService.toggleTodo(id);
    this.todos = this.todoService.getTodos();
  }
  
  deleteTodo(id: number) {
    this.todoService.deleteTodo(id);
    this.todos = this.todoService.getTodos();
  }
  
  getActiveTodos() {
    return this.todos.filter(todo => !todo.completed);
  }
  
  getCompletedTodos() {
    return this.todos.filter(todo => todo.completed);
  }
  
  get filteredTodos() {
    switch (this.filter) {
      case 'active':
        return this.getActiveTodos();
      case 'completed':
        return this.getCompletedTodos();
      default:
        return this.todos;
    }
  }
}`,
      },

      'src/app/components/todo-item/todo-item.component.ts': {
        content: `import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Todo } from '../../models/todo.model';

@Component({
  selector: 'app-todo-item',
  template: \`
    <div class="todo-item" [class.completed]="todo.completed">
      <input 
        type="checkbox" 
        [checked]="todo.completed"
        (change)="toggle.emit(todo.id)"
        class="todo-checkbox"
      >
      <span class="todo-text">{{ todo.text }}</span>
      <button (click)="delete.emit(todo.id)" class="delete-btn">×</button>
    </div>
  \`,
  styles: [\`
    .todo-item {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      border-bottom: 1px solid #e0e0e0;
      transition: all 0.2s;
    }
    
    .todo-item:hover {
      background: #f9f9f9;
    }
    
    .todo-item.completed .todo-text {
      text-decoration: line-through;
      color: #999;
    }
    
    .todo-checkbox {
      width: 20px;
      height: 20px;
      margin-right: 1rem;
      cursor: pointer;
    }
    
    .todo-text {
      flex: 1;
      font-size: 1rem;
    }
    
    .delete-btn {
      width: 30px;
      height: 30px;
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1.5rem;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .todo-item:hover .delete-btn {
      opacity: 1;
    }
    
    .delete-btn:hover {
      background: #cc0000;
    }
  \`]
})
export class TodoItemComponent {
  @Input() todo!: Todo;
  @Output() toggle = new EventEmitter<number>();
  @Output() delete = new EventEmitter<number>();
}`,
      },

      'src/app/services/todo.service.ts': {
        content: `import { Injectable } from '@angular/core';
import { Todo } from '../models/todo.model';

@Injectable({
  providedIn: 'root'
})
export class TodoService {
  private todos: Todo[] = [
    { id: 1, text: 'Learn Angular', completed: true },
    { id: 2, text: 'Build a WebContainer app', completed: false },
    { id: 3, text: 'Deploy to production', completed: false }
  ];
  private nextId = 4;
  
  getTodos(): Todo[] {
    return [...this.todos];
  }
  
  addTodo(text: string): void {
    this.todos.push({
      id: this.nextId++,
      text,
      completed: false
    });
  }
  
  toggleTodo(id: number): void {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }
  
  deleteTodo(id: number): void {
    this.todos = this.todos.filter(t => t.id !== id);
  }
}`,
      },

      'src/app/models/todo.model.ts': {
        content: `export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}`,
      },

      'src/favicon.ico': {
        content: '', // Empty file, just placeholder
      },

      '.gitignore': {
        content: `# See http://help.github.com/ignore-files/ for more about ignoring files.

# Compiled output
/dist
/tmp
/out-tsc
/bazel-out

# Node
/node_modules
npm-debug.log
yarn-error.log

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# Visual Studio Code
/.vscode/*
!/.vscode/settings.json
!/.vscode/tasks.json
!/.vscode/launch.json
!/.vscode/extensions.json
.history/*

# Miscellaneous
/.angular/cache
.sass-cache/
/connect.lock
/coverage
/libpeerconnection.log
testem.log
/typings

# System files
.DS_Store
Thumbs.db`,
      },

      'README.md': {
        content: `# Angular WebContainer Todo App

This is a fully functional Angular application running in WebContainer!

## Features

- ✅ Complete Angular 17 setup
- ✅ Todo list functionality
- ✅ Component-based architecture
- ✅ Services and dependency injection
- ✅ Two-way data binding with FormsModule
- ✅ TypeScript support

## Running the App

1. Click "Run Project" or type \`npm start\` in the terminal
2. Wait for dependencies to install
3. The Angular dev server will start on port 3000
4. Your app will appear in the preview pane

## Project Structure

\`\`\`
src/
├── app/
│   ├── components/
│   │   ├── todo-list/
│   │   └── todo-item/
│   ├── models/
│   │   └── todo.model.ts
│   ├── services/
│   │   └── todo.service.ts
│   ├── app.component.ts
│   └── app.module.ts
├── index.html
├── main.ts
└── styles.css
\`\`\`

## Commands

- \`npm start\` - Start the development server
- \`npm run build\` - Build for production
- \`ng generate component <name>\` - Generate new component
- \`ng generate service <name>\` - Generate new service

## WebContainer Features

This app demonstrates:
- Running Angular CLI in the browser
- Hot module replacement
- TypeScript compilation
- Component rendering
- Service injection
`,
      },
    };

    await this.webContainerService.writeFiles(angularFiles);
    this.files = this.webContainerService.getFileList();
  }
}
