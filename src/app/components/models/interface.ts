import { EditorState } from '@codemirror/state';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  expanded?: boolean;
}

export interface EditorTabState {
  content: string;
  state: EditorState;
  scrollPosition: { top: number; left: number };
  cursorPosition: number;
}
