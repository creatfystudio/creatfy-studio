export interface ConversionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  note?: string;
}

// Formatos aceitos. HEIC/HEIF ficam de fora de propósito.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
const ACCEPTED_EXTENSIONS = ['jfif', 'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];

export function isAcceptedImageFile(file: File): boolean {
  // Se o navegador informou o tipo, ele decide.
  if (file.type) return ACCEPTED_TYPES.includes(file.type);
  // Se o tipo veio vazio, confere pela extensão.
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_EXTENSIONS.includes(ext);
}

const MAX_SIDE = 2048;

/**
 * Converte a imagem para PNG e reduz para no máximo 2048px no lado maior,
 * mantendo a proporção. Se a imagem não puder ser lida, lança erro.
 */
export async function convertImage(file: File): Promise<ConversionResult> {
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const targetFileName = `${baseName}.png`;
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);

    let width = img.naturalWidth;
    let height = img.naturalHeight;
    if (width > MAX_SIDE || height > MAX_SIDE) {
      if (width > height) {
        height = Math.round((height * MAX_SIDE) / width);
        width = MAX_SIDE;
      } else {
        width = Math.round((width * MAX_SIDE) / height);
        height = MAX_SIDE;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Falha ao gerar a imagem convertida.'));
      }, 'image/png');
    });

    return {
      blob,
      fileName: targetFileName,
      mimeType: 'image/png',
      note: file.type === 'image/png' ? 'PNG otimizado' : 'Convertido para PNG',
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir esta imagem. Tente outro arquivo.'));
    img.src = src;
  });
}