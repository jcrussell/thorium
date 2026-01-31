import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDropzone } from './uploaddropzone';

function createMockFile(name: string, size: number): File {
  const file = new File([new Array(size).fill('a').join('')], name);
  Object.defineProperty(file, 'path', { value: name });
  return file;
}

function renderDropzone(props: Partial<React.ComponentProps<typeof UploadDropzone>> = {}) {
  const defaultProps = {
    width: '100%',
    onChange: vi.fn(),
    selectedFiles: [] as { path: string; size: number }[],
    ...props,
  };
  return {
    ...render(<UploadDropzone {...defaultProps} />),
    onChange: defaultProps.onChange,
  };
}

async function selectFile(file: File) {
  const user = userEvent.setup();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, file);
}

describe('UploadDropzone', () => {
  describe('instructions', () => {
    it('shows drag and drop instructions', () => {
      renderDropzone();

      expect(screen.getByText(/drag and drop some files or click to select/i)).toBeInTheDocument();
    });

    it('shows file size limit', () => {
      renderDropzone();

      expect(screen.getByText(/files must be < 10GB/i)).toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('notifies parent when file is selected', async () => {
      const { onChange } = renderDropzone();
      const file = createMockFile('sample.exe', 1024);

      await selectFile(file);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'sample.exe' })]));
      });
    });

    it('notifies parent when multiple files are selected', async () => {
      const user = userEvent.setup();
      const { onChange } = renderDropzone();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, [createMockFile('file1.exe', 100), createMockFile('file2.dll', 200)]);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ name: 'file1.exe' }), expect.objectContaining({ name: 'file2.dll' })]),
        );
      });
    });

    it('clears errors when files are accepted', async () => {
      const onError = vi.fn();
      renderDropzone({ onError });

      await selectFile(createMockFile('valid.exe', 1024));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith([]);
      });
    });
  });

  describe('displaying files', () => {
    it('shows pre-selected files passed via prop', () => {
      renderDropzone({
        selectedFiles: [{ path: 'existing.exe', size: 2048 }],
      });

      expect(screen.getByText(/existing\.exe/)).toBeInTheDocument();
      expect(screen.getByText(/2048 bytes/)).toBeInTheDocument();
    });

    it('shows accepted files after selection', async () => {
      renderDropzone();

      await selectFile(createMockFile('uploaded.bin', 4096));

      await waitFor(() => {
        expect(screen.getByText(/uploaded\.bin/)).toBeInTheDocument();
        expect(screen.getByText('Accepted Files')).toBeInTheDocument();
      });
    });
  });
});
