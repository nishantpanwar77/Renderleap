import { CommonModule, JsonPipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
} from '@angular/core';
import { FileTreeNode } from '../models/interface';
import { FileIconsService } from '../../services/file-icons.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-file-explorer',
  imports: [CommonModule, NgTemplateOutlet],
  templateUrl: './file-explorer.component.html',
  styleUrl: './file-explorer.component.scss',
})
export class FileExplorerComponent implements OnInit, OnChanges {
  @Input() files: FileTreeNode[] = [];
  @Output() fileSelected = new EventEmitter<FileTreeNode>();

  private fileIconService = inject(FileIconsService);
  private sanitizer = inject(DomSanitizer);

  fileTree: FileTreeNode[] = [];
  private expandedFolders = new Map<string, boolean>();

  ngOnInit() {
    this.initializeExpandedState();
  }

  ngOnChanges() {
    if (this.files && this.files.length > 0) {
      this.fileTree = [...this.files];
      this.initializeExpandedState();
    }
  }

  private initializeExpandedState() {
    this.expandedFolders.set('src', true);
    this.expandedFolders.set('src/app', true);

    // Uncomment below lines for default expands the directory, or modify according your project structure.
    // this.expandedFolders.set('src/assets', false);
    // this.expandedFolders.set('src/environments', false);
  }

  isExpanded(path: string): boolean {
    return this.expandedFolders.get(path) ?? false;
  }

  onNodeClick(node: FileTreeNode) {
    if (node.type === 'folder') {
      // Toggle folder
      const currentState = this.expandedFolders.get(node.path) ?? false;
      this.expandedFolders.set(node.path, !currentState);
    } else {
      // Emit file selection
      this.fileSelected.emit(node);
    }
  }

  getNodeIcon(node: FileTreeNode): SafeHtml {
    const iconSvg =
      node.type === 'folder'
        ? this.fileIconService.getFolderIcon(this.isExpanded(node.path))
        : this.fileIconService.getFileIcon(node.name);

    return this.sanitizer.bypassSecurityTrustHtml(iconSvg);
  }
}
