import { Editor, Value } from 'slate';
import mousetrap from 'mousetrap';
import BaseMarkPlugins, {
  clearTextFormatting,
} from '../../../src/components/composer-editor/base-mark-plugins';
import '../../../src/keymap-manager';

function editorWithFormatting() {
  return new Editor({
    value: Value.fromJSON({
      document: {
        nodes: [
          {
            object: 'block',
            type: 'div',
            nodes: [
              {
                object: 'text',
                leaves: [
                  {
                    text: 'red link',
                    marks: [
                      { type: 'bold' },
                      { type: 'color', data: { value: '#ff0000' } },
                      { type: 'link', data: { href: 'https://example.com/' } },
                    ],
                  },
                  {
                    text: ' blue',
                    marks: [{ type: 'italic' }, { type: 'color', data: { value: '#0000ff' } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    } as any),
    plugins: [],
    onChange: () => {},
  });
}

describe('Local composer fixes', () => {
  it('consumes shifted redo before Chromium can redo another field', () => {
    const editor = editorWithFormatting();
    spyOn(editor, 'redo');
    const event = new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true });
    spyOn(event, 'preventDefault');
    const next = jasmine.createSpy('next');
    BaseMarkPlugins[0].onKeyDown(event as any, editor, next);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(editor.redo).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('clears mixed formatting across a selection and preserves the link', () => {
    const editor = editorWithFormatting();
    editor.moveToRangeOfDocument();
    clearTextFormatting(editor);
    const marks = editor.value.document.getMarks();
    expect(marks.size).toBe(1);
    expect(marks.first().type).toBe('link');
    expect(marks.first().data.get('href')).toBe('https://example.com/');
    expect(editor.value.document.text).toBe('red link blue');
  });

  it('clears pending formatting at the caret and preserves the link', () => {
    const editor = editorWithFormatting();
    editor.moveTo(editor.value.document.getFirstText().key as any, 3);
    clearTextFormatting(editor);
    editor.insertText('X');
    const inserted = editor.value.document
      .getFirstText()
      .leaves.find((leaf) => leaf.text.includes('X'));
    expect(inserted.marks.size).toBe(1);
    expect(inserted.marks.first().type).toBe('link');
  });

  it('keeps undo and shifted redo inside Slate, including nested targets', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.setAttribute('data-slate-editor', 'true');
    const child = document.createElement('span');
    editor.appendChild(child);
    document.body.appendChild(editor);
    try {
      for (const target of [editor, child]) {
        const event = new KeyboardEvent('keydown');
        Object.defineProperty(event, 'target', { value: target });
        for (const combo of ['ctrl+z', 'ctrl+shift+z', 'command+shift+z', 'ctrl+y']) {
          expect(mousetrap.prototype.stopCallback(event, target, combo)).toBe(true);
        }
      }
    } finally {
      editor.remove();
    }
  });

  it('keeps global undo available when a checkbox is focused', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const event = new KeyboardEvent('keydown');
    Object.defineProperty(event, 'target', { value: checkbox });
    (event as any).isPropagationStopped = () => false;
    expect(mousetrap.prototype.stopCallback(event, checkbox, 'ctrl+z')).toBe(false);
  });
});
