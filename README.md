![Renderleap Logo](https://raw.githubusercontent.com/nishantpanwar77/Renderleap/refs/heads/main/public/rlogo.png)

# Renderleap

A modern web-based IDE built with Angular 19, featuring WebContainer for browser-based Node.js execution, CodeMirror for code editing, and xterm.js for terminal emulation.

## Features

- **WebContainer Integration**: Run Node.js applications directly in the browser
- **CodeMirror Editor**: Syntax highlighting for JavaScript, HTML, CSS, and more
- **Xterm.js Terminal**: Full terminal emulation with theme support
- **File Explorer**: Navigate and edit project files
- **Live Preview**: See your applications running in real-time
- **Dark Theme**: Modern VS Code-inspired dark theme

## Prerequisites

- Node.js 18+
- npm or yarn
- Angular CLI 19

## Installation

1. Clone the repository:

```bash
git clone https://github.com/nishantpanwar77/Renderleap.git
cd renderleap
```

2. Install dependencies:

```bash
npm install
```

## Running the Application

### Development Mode

1. Start the Angular development server:

```bash
npm start
```

2. In a separate terminal, start the Node.js reverse proxy server:

```bash
npm run server
```

3. Open your browser and navigate to `http://localhost:4200`

### Production Build

1. Build the Angular application:

```bash
npm run build
```

2. Start the production server:

```bash
npm run server
```

3. Navigate to `http://localhost:3001`

## Project Structure

```
angular-webcontainer-ide/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── editor/
│   │   │   ├── terminal/
│   │   │   └── file-explorer/
│   │   ├── services/
│   │   │   └── webcontainer.service.ts
│   │   └── app.component.ts
│   ├── main.ts
│   ├── styles.css
│   └── index.html
├── server.js
├── package.json
├── angular.json
└── README.md
```

## Key Components

### WebContainerService

Manages WebContainer instance, file operations, and terminal output streaming.

### EditorComponent

CodeMirror-based code editor with syntax highlighting and auto-save functionality.

### TerminalComponent

Xterm.js terminal emulator connected to WebContainer's output stream.

### FileExplorerComponent

Simple file tree navigation for project files.

## Server Configuration

The Node.js server (`server.js`) provides:

- Static file serving for the Angular build
- Reverse proxy for WebContainer API requests
- CORS handling for development
- Health check endpoint

## Usage

1. **Creating Files**: Files are pre-loaded with a sample Express.js application
2. **Editing Code**: Click on any file in the explorer to open it in the editor
3. **Running Projects**: Click the "Run Project" button to install dependencies and start the server
4. **Terminal Output**: View npm install progress and server logs in the terminal
5. **Live Preview**: A preview window appears when the server is ready

## Technologies Used

- **Angular 19**: Modern web application framework
- **WebContainer API**: Browser-based Node.js runtime
- **CodeMirror 6**: Extensible code editor
- **xterm.js**: Terminal emulator
- **Express.js**: Node.js web server
- **http-proxy-middleware**: Reverse proxy for API requests

## Browser Support

- Chrome/Edge 89+
- Firefox 89+
- Safari 15+

WebContainer requires modern browser features including SharedArrayBuffer and Cross-Origin Isolation.

## Security Considerations

- WebContainer runs in a sandboxed environment
- No access to local file system
- Network requests are isolated
- Code execution is contained within the browser

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
# Renderleap
