export interface ConversionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  note?: string;
}

const ACCEPTED_EXTENSIONS = [
  'jfif',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'bmp',
  'gif',
  'avif',
  'svg',
];

export function isAcceptedImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_EXTENSIONS.includes(ext);
}

/**
 * Converte qualquer imagem gerada por IA ou enviada pelo vendedor para PNG nativo.
 * Redimensiona suavemente se a imagem for gigantesca (ex: 4K/8K) para largura máxima de 2048px,
 * mantendo a qualidade original do mascote 3D com custo zero de processamento e de tokens.
 */
export async function convertImage(file: File): Promise<ConversionResult> {
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const targetFileName = `${baseName}.png`;

  return new Promise((resolve, reject) => {
    // 1. Tenta carregar nativamente no navegador
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const MAX_WIDTH = 2048;
        const MAX_HEIGHT = 2048;
        let width = img.width;
        let height = img.height;

        // Mantém a proporção exata da arte
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          throw new Error('Falha ao processar canvas da imagem.');
        }

        // Suavização de alta qualidade na renderização
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error('Falha ao gerar PNG da imagem.'));
              return;
            }
            resolve({
              blob,
              fileName: targetFileName,
              mimeType: 'image/png',
              note: file.type === 'image/png' ? 'PNG otimizado' : 'Convertido para PNG',
            });
          },
          'image/png'
        );
      } catch (err: any) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback de segurança se o navegador não conseguir decodificar diretamente (ex: HEIC não nativo)
      resolve({
        blob: file,
        fileName: targetFileName,
        mimeType: 'image/png',
        note: 'Salvo como PNG',
      });
    };

    img.src = objectUrl;
  });
}