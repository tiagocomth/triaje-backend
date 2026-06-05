import { createRequire } from 'node:module';
import mammoth from 'mammoth';
import AppError from '../../utils/AppError.js';

// pdf-parse is CommonJS and its index has a debug side-effect when imported
// as the package root; require the library entry point directly to avoid it.
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const PDF_MIME = 'application/pdf';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Collapse excessive whitespace while keeping line structure readable. */
function normalize(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parsePdf(buffer) {
  const { text } = await pdfParse(buffer);
  return text;
}

async function parseDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/**
 * Extracts plain text from a PDF or DOCX buffer.
 *
 * @param {Buffer} buffer    Raw file bytes
 * @param {string} mimeType  One of the two accepted MIME types
 * @returns {Promise<string>} Normalized extracted text
 * @throws {AppError} 415 for unsupported types, 422 when extraction fails
 */
export async function extractText(buffer, mimeType) {
  let raw;
  try {
    if (mimeType === PDF_MIME) {
      raw = await parsePdf(buffer);
    } else if (mimeType === DOCX_MIME) {
      raw = await parseDocx(buffer);
    } else {
      throw new AppError(415, `Unsupported file type: ${mimeType}`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unprocessable('Failed to extract text from document', {
      code: 'PARSE_FAILED',
      cause: err,
    });
  }

  const text = normalize(raw || '');
  if (!text) {
    throw AppError.unprocessable(
      'Document contains no extractable text (it may be a scanned image)',
      { code: 'EMPTY_DOCUMENT' },
    );
  }
  return text;
}

export default { extractText };
